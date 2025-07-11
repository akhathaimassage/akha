const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');
const dayjs = require('dayjs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const saltRounds = 10;
const app = express();
const port = process.env.PORT || 3001;

// --- Middlewares ---
app.use(cors());
  origin: [
    'http://localhost:5173', // สำหรับตอนพัฒนา
    'https://akhathaimassage.de' // ★ ใส่ Domain จริงของคุณที่นี่
  ]
app.use(express.json());

// --- Middleware to Verify JWT Token ---
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// ★ สร้าง Transporter สำหรับส่งอีเมล ★
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});



// =============================================
// Public Endpoints (สำหรับลูกค้า)
// =============================================

app.get('/api/services', async (req, res) => {
    try {
        const [services] = await db.query("SELECT * FROM services WHERE is_active = TRUE");
        res.status(200).json(services);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch services.' });
    }
});

app.get('/api/therapists', async (req, res) => {
    try {
        const [therapists] = await db.query("SELECT id, full_name FROM therapists WHERE is_active = TRUE");
        res.status(200).json(therapists);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch therapists.' });
    }
});

app.get('/api/availability', async (req, res) => {
    try {
        const { date, serviceId, therapistId } = req.query;
        if (!date || !serviceId || !therapistId) return res.status(200).json([]);
        const [services] = await db.query('SELECT duration_minutes FROM services WHERE id = ?', [serviceId]);
        if (services.length === 0) return res.status(200).json([]);
        const durationMinutes = services[0].duration_minutes;
        const [schedules] = await db.query('SELECT start_time, end_time FROM therapist_schedules WHERE therapist_id = ? AND day_of_week = ?', [therapistId, dayjs(date).day()]);
        if (schedules.length === 0) return res.status(200).json([]);
        const workingHours = { start: schedules[0].start_time, end: schedules[0].end_time };
        const [existingBookings] = await db.query('SELECT start_datetime, end_datetime FROM bookings WHERE therapist_id = ? AND DATE(start_datetime) = ? AND status != ?', [therapistId, date, 'cancelled']);
        const availableSlots = [];
        let slotTime = dayjs(`${date} ${workingHours.start}`);
        const endTime = dayjs(`${date} ${workingHours.end}`);
        const interval = 30;
        while (slotTime.isBefore(endTime)) {
            const potentialEndTime = slotTime.add(durationMinutes, 'minute');
            if (potentialEndTime.isAfter(endTime)) break;
            const isOverlapping = existingBookings.some(booking => slotTime.isBefore(dayjs(booking.end_datetime)) && potentialEndTime.isAfter(dayjs(booking.start_datetime)));
            if (!isOverlapping) availableSlots.push(slotTime.format('HH:mm'));
            slotTime = slotTime.add(interval, 'minute');
        }
        res.status(200).json(availableSlots);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch availability.' });
    }
});

app.post('/api/bookings', async (req, res) => {
    // ★ โค้ดที่แก้ไขและรวมส่วนส่งอีเมลเข้ามาแล้ว ★
    const { serviceId, therapistId, date, time, customerName, customerEmail, customerPhone } = req.body;
    if (!serviceId || !therapistId || !date || !time || !customerName || !customerPhone) {
        return res.status(400).json({ error: 'Missing required booking information.' });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [services] = await connection.query('SELECT name, duration_minutes, price FROM services WHERE id = ?', [serviceId]);
        if (services.length === 0) throw new Error('Service not found.');
        
        const { name: serviceName, duration_minutes: durationMinutes, price } = services[0];
        const startDateTime = dayjs(`${date} ${time}`);
        const endDateTime = startDateTime.add(durationMinutes, 'minute');
        const startDateTimeForDB = startDateTime.format('YYYY-MM-DD HH:mm:ss');
        const endDateTimeForDB = endDateTime.format('YYYY-MM-DD HH:mm:ss');

        const [existingBookings] = await connection.query('SELECT id FROM bookings WHERE therapist_id = ? AND status != ? AND (? < end_datetime AND ? > start_datetime) FOR UPDATE', [therapistId, 'cancelled', startDateTimeForDB, endDateTimeForDB]);
        if (existingBookings.length > 0) {
            await connection.rollback();
            return res.status(409).json({ error: 'This time slot is no longer available.' });
        }
        
        let customerId;
        if (customerEmail && customerEmail.trim() !== '') {
            let [customers] = await connection.query('SELECT id FROM customers WHERE email = ?', [customerEmail]);
            if (customers.length > 0) {
                customerId = customers[0].id;
                await connection.query("UPDATE customers SET full_name = ?, phone_number = ? WHERE id = ?", [customerName, customerPhone, customerId]);
            } else {
                const [result] = await connection.query('INSERT INTO customers (full_name, email, phone_number) VALUES (?, ?, ?)', [customerName, customerEmail, customerPhone]);
                customerId = result.insertId;
            }
        } else {
            let [customers] = await connection.query('SELECT id FROM customers WHERE phone_number = ?', [customerPhone]);
            if (customers.length > 0) {
                customerId = customers[0].id;
                await connection.query("UPDATE customers SET full_name = ? WHERE id = ?", [customerName, customerId]);
            } else {
                const [result] = await connection.query('INSERT INTO customers (full_name, phone_number) VALUES (?, ?)', [customerName, customerPhone]);
                customerId = result.insertId;
            }
        }

        await connection.query('INSERT INTO bookings (customer_id, therapist_id, service_id, start_datetime, end_datetime, status, price_at_booking) VALUES (?, ?, ?, ?, ?, ?, ?)', [customerId, therapistId, serviceId, startDateTimeForDB, endDateTimeForDB, 'confirmed', price]);
        
        const [therapists] = await connection.query('SELECT full_name FROM therapists WHERE id = ?', [therapistId]);
        const therapistName = therapists[0]?.full_name || 'N/A';
        
        await connection.commit();
        
        // ส่งอีเมลหลังจาก commit สำเร็จ
        if (customerEmail && customerEmail.trim() !== '') {
            const mailOptions = {
                from: `"Akha Thai Massage" <${process.env.EMAIL_USER}>`,
                to: customerEmail,
                subject: 'Booking Confirmation',
                html: `<h1>Thank you, ${customerName}!</h1><p>Your booking is confirmed for ${serviceName} with ${therapistName} on ${dayjs(date).format('DD MMMM YYYY')} at ${time}.</p>`
            };
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) console.error('❌ Error sending email:', error);
                else console.log('✅ Email sent:', info.response);
            });
        }
        
        res.status(201).json({ success: true, message: 'Booking confirmed successfully!' });

    } catch (error) {
        if(connection) await connection.rollback();
        console.error('❌ Error creating booking:', error);
        res.status(500).json({ error: 'Failed to create booking.' });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// Authentication Endpoint
// =============================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });

        const [users] = await db.query("SELECT * FROM admin_users WHERE username = ?", [username]);
        if (users.length === 0) return res.status(401).json({ message: 'Invalid credentials.' });
        
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

        const tokenPayload = { id: user.id, username: user.username };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.status(200).json({ message: 'Login successful!', token });
    } catch (error) {
        res.status(500).json({ message: 'Server error during login.' });
    }
});


// =============================================
// Protected Admin Endpoints
// =============================================

// --- Schedule Page ---
app.get('/api/admin/bookings_by_date', verifyToken, async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date query parameter is required.' });
    try {
        const query = `SELECT b.id, b.start_datetime, b.end_datetime, s.name AS service_name, s.duration_minutes, t.id AS therapist_id, t.full_name AS therapist_name, c.full_name AS customer_name FROM bookings AS b JOIN services AS s ON b.service_id = s.id JOIN therapists AS t ON b.therapist_id = t.id JOIN customers AS c ON b.customer_id = c.id WHERE DATE(b.start_datetime) = ? AND b.status = 'confirmed' ORDER BY b.start_datetime;`;
        const [bookings] = await db.query(query, [date]);
        res.status(200).json(bookings);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred fetching schedule bookings' });
    }
});

// --- Therapist Management ---
app.get('/api/therapists/all', verifyToken, async (req, res) => {
    try {
        const [therapists] = await db.query("SELECT * FROM therapists ORDER BY id");
        res.status(200).json(therapists);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch therapists' }); }
});

app.post('/api/therapists', verifyToken, async (req, res) => {
    try {
        const { full_name } = req.body;
        if (!full_name) return res.status(400).json({ error: 'Full name is required' });
        const [result] = await db.query("INSERT INTO therapists (full_name) VALUES (?)", [full_name]);
        res.status(201).json({ id: result.insertId, full_name, is_active: true });
    } catch (error) { res.status(500).json({ error: 'Failed to create therapist' }); }
});

app.put('/api/therapists/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { full_name, is_active } = req.body;
    if (full_name === undefined && is_active === undefined) return res.status(400).json({ error: 'No update data provided' });
    let query = "UPDATE therapists SET ";
    const params = [];
    if (full_name !== undefined) { query += "full_name = ?"; params.push(full_name); }
    if (is_active !== undefined) { if (params.length > 0) query += ", "; query += "is_active = ?"; params.push(is_active); }
    query += " WHERE id = ?";
    params.push(id);
    try {
        await db.query(query, params);
        res.status(200).json({ success: true, message: 'Therapist updated' });
    } catch (error) { res.status(500).json({ error: 'Failed to update therapist' }); }
});

app.delete('/api/therapists/:id/permanent', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [bookings] = await db.query("SELECT id FROM bookings WHERE therapist_id = ? AND start_datetime >= CURDATE()", [id]);
        if (bookings.length > 0) return res.status(409).json({ error: `Cannot delete. This therapist has ${bookings.length} upcoming booking(s).` });
        await db.query("DELETE FROM therapist_schedules WHERE therapist_id = ?", [id]);
        await db.query("DELETE FROM therapists WHERE id = ?", [id]);
        res.status(200).json({ success: true, message: 'Therapist permanently deleted.' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete therapist' }); }
});

// --- Service Management ---
app.get('/api/services/all', verifyToken, async (req, res) => {
    try {
        const [services] = await db.query("SELECT * FROM services ORDER BY name, duration_minutes");
        res.status(200).json(services);
    } catch (error) {
        console.error('❌ Error fetching all services:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});
app.post('/api/services', verifyToken, async (req, res) => {
    const { name, duration_minutes, price } = req.body;
    if (!name || !duration_minutes || !price) return res.status(400).json({ error: 'All fields are required' });
    try {
        const [result] = await db.query("INSERT INTO services (name, duration_minutes, price) VALUES (?, ?, ?)", [name, duration_minutes, price]);
        res.status(201).json({ id: result.insertId, name, duration_minutes, price, is_active: true });
    } catch (error) { res.status(500).json({ error: 'Failed to create service' }); }
});
app.put('/api/services/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { name, duration_minutes, price, is_active } = req.body;
    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push("name = ?"); params.push(name); }
    if (duration_minutes !== undefined) { fields.push("duration_minutes = ?"); params.push(duration_minutes); }
    if (price !== undefined) { fields.push("price = ?"); params.push(price); }
    if (is_active !== undefined) { fields.push("is_active = ?"); params.push(is_active); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const query = `UPDATE services SET ${fields.join(', ')} WHERE id = ?`;
    params.push(id);
    try {
        await db.query(query, params);
        res.status(200).json({ success: true, message: 'Service updated' });
    } catch (error) { res.status(500).json({ error: 'Failed to update service' }); }
});
app.delete('/api/services/:id', verifyToken, async (req, res) => {
    try {
        await db.query("UPDATE services SET is_active = FALSE WHERE id = ?", [req.params.id]);
        res.status(200).json({ success: true, message: 'Service deactivated' });
    } catch (error) { res.status(500).json({ error: 'Failed to deactivate service' }); }
});

// --- Therapist Schedule Management ---
app.get('/api/therapists/:therapistId/schedules', verifyToken, async (req, res) => {
    try {
        const [schedules] = await db.query("SELECT * FROM therapist_schedules WHERE therapist_id = ? ORDER BY day_of_week", [req.params.therapistId]);
        res.status(200).json(schedules);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch schedules' }); }
});
app.post('/api/schedules', verifyToken, async (req, res) => {
    const { therapist_id, day_of_week, start_time, end_time } = req.body;
    if (!therapist_id || day_of_week === undefined || !start_time || !end_time) return res.status(400).json({ error: 'Missing data' });
    try {
        const query = `INSERT INTO therapist_schedules (therapist_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time)`;
        await db.query(query, [therapist_id, day_of_week, start_time, end_time]);
        res.status(201).json({ success: true, message: 'Schedule saved' });
    } catch (error) { res.status(500).json({ error: 'Failed to save schedule' }); }
});
app.delete('/api/schedules/:scheduleId', verifyToken, async (req, res) => {
    try {
        await db.query("DELETE FROM therapist_schedules WHERE id = ?", [req.params.scheduleId]);
        res.status(200).json({ success: true, message: 'Schedule deleted' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete schedule' }); }
});

// --- Booking Management ---
app.get('/api/bookings/all', verifyToken, async (req, res) => {
    try {
        const { therapistName, timeFilter } = req.query;

        // --- สร้าง Query หลักสำหรับ bookings ---
        let bookingsQuery = `SELECT * FROM bookings`;
        const whereClauses = [];
        const params = [];

        if (therapistName) {
            // เราไม่สามารถ filter ชื่อ therapist ที่นี่ได้โดยตรงแล้ว แต่เราจะกรองทีหลัง
        }
        if (timeFilter === 'upcoming') {
            whereClauses.push("start_datetime >= CURDATE()");
        } else if (timeFilter === 'past') {
            whereClauses.push("start_datetime < CURDATE()");
        }

        if (whereClauses.length > 0) {
            bookingsQuery += " WHERE " + whereClauses.join(" AND ");
        }
        bookingsQuery += " ORDER BY start_datetime DESC";

        // 1. ดึงข้อมูลการจองทั้งหมดออกมาก่อน
        const [bookings] = await db.query(bookingsQuery, params);

        if (bookings.length === 0) {
            return res.status(200).json([]);
        }

        // 2. รวบรวม ID ทั้งหมดที่ต้องใช้
        const customerIds = [...new Set(bookings.map(b => b.customer_id))];
        const serviceIds = [...new Set(bookings.map(b => b.service_id))];
        const therapistIds = [...new Set(bookings.map(b => b.therapist_id))];

        // 3. ดึงข้อมูลที่เกี่ยวข้องทั้งหมดในครั้งเดียว
        const [customers] = await db.query("SELECT id, full_name, email, phone_number FROM customers WHERE id IN (?)", [customerIds]);
        const [services] = await db.query("SELECT id, name as service_name, duration_minutes FROM services WHERE id IN (?)", [serviceIds]);
        const [therapists] = await db.query("SELECT id, full_name as therapist_name FROM therapists WHERE id IN (?)", [therapistIds]);

        // 4. สร้าง Map เพื่อให้ค้นหาข้อมูลได้ง่าย
        const customersMap = new Map(customers.map(c => [c.id, c]));
        const servicesMap = new Map(services.map(s => [s.id, s]));
        const therapistsMap = new Map(therapists.map(t => [t.id, t]));

        // 5. นำข้อมูลทั้งหมดมาประกอบร่างกัน
        let combinedBookings = bookings.map(booking => ({
            ...booking,
            customer_name: customersMap.get(booking.customer_id)?.full_name,
            email: customersMap.get(booking.customer_id)?.email,
            phone_number: customersMap.get(booking.customer_id)?.phone_number,
            service_name: servicesMap.get(booking.service_id)?.service_name,
            therapist_name: therapistsMap.get(booking.therapist_id)?.therapist_name,
        }));
        
        // กรองด้วยชื่อพนักงาน (ถ้ามี) หลังจากประกอบร่างแล้ว
        if (therapistName) {
            combinedBookings = combinedBookings.filter(b => 
                b.therapist_name && b.therapist_name.toLowerCase().includes(therapistName.toLowerCase())
            );
        }

        res.status(200).json(combinedBookings);

    } catch (error) {
        console.error('❌ Error fetching all bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

app.delete('/api/bookings/:id', verifyToken, async (req, res) => {
    try {
        await db.query("DELETE FROM bookings WHERE id = ?", [req.params.id]);
        res.status(200).json({ success: true, message: 'Booking deleted' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete booking' }); }
});

// --- User Management ---
app.get('/api/users', verifyToken, async (req, res) => {
    try {
        const [users] = await db.query("SELECT id, username, created_at FROM admin_users ORDER BY username");
        res.status(200).json(users);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch users' }); }
});
app.post('/api/users', verifyToken, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    try {
        const password_hash = await bcrypt.hash(password, saltRounds);
        const [result] = await db.query("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)", [username, password_hash]);
        res.status(201).json({ id: result.insertId, username });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This username is already taken.' });
        res.status(500).json({ error: 'Failed to create user' });
    }
});
app.delete('/api/users/:id', verifyToken, async (req, res) => {
    try {
        await db.query("DELETE FROM admin_users WHERE id = ?", [req.params.id]);
        res.status(200).json({ success: true, message: 'User deleted' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete user' }); }
});

// --- Reports / Dashboard Endpoints ---

// GET Revenue Summary
app.get('/api/reports/revenue-summary', verifyToken, async (req, res) => {
    const { year } = req.query; // รับค่า 'year' จาก query

    try {
        let query = `
            SELECT 
                YEAR(start_datetime) as year,
                MONTH(start_datetime) as month,
                SUM(price_at_booking) as total_revenue
            FROM bookings
            WHERE status = 'confirmed'
        `;
        const params = [];

        if (year) {
            query += ' AND YEAR(start_datetime) = ?';
            params.push(year);
        }

        query += ' GROUP BY YEAR(start_datetime), MONTH(start_datetime) ORDER BY year, month;';
        
        const [summary] = await db.query(query, params);
        res.status(200).json(summary);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch revenue summary' });
    }
});

// GET Therapist Performance
app.get('/api/reports/therapist-performance', verifyToken, async (req, res) => {
    const { year, month } = req.query; // รับค่า 'year' และ 'month'

    try {
        let query = `
            SELECT 
                t.full_name as therapist_name,
                COUNT(b.id) as booking_count,
                SUM(b.price_at_booking) as total_revenue
            FROM bookings b
            JOIN therapists t ON b.therapist_id = t.id
            WHERE b.status = 'confirmed'
        `;
        const params = [];

        if (year) {
            query += ' AND YEAR(b.start_datetime) = ?';
            params.push(year);
        }
        if (month) {
            query += ' AND MONTH(b.start_datetime) = ?';
            params.push(month);
        }

        query += ' GROUP BY b.therapist_id ORDER BY total_revenue DESC;';

        const [summary] = await db.query(query, params);
        res.status(200).json(summary);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch therapist performance' });
    }

    



});

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});