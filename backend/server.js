const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc'); // ★ เพิ่มบรรทัดนี้
const timezone = require('dayjs/plugin/timezone'); // ★ เพิ่มบรรทัดนี้
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

dayjs.extend(utc); // ★ เพิ่มบรรทัดนี้
dayjs.extend(timezone); // ★ เพิ่มบรรทัดนี้

const saltRounds = 10;
const app = express();
const port = process.env.PORT || 3001;

// --- Middlewares ---
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://akhathaimassage.de',
    'https://www.akhathaimassage.de'
  ]
}));
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
        const { rows } = await db.query("SELECT * FROM services WHERE is_active = TRUE");
        res.status(200).json(rows);
    } catch (error) {
        console.error('❌ Error fetching services:', error);
        res.status(500).json({ error: 'Failed to fetch services.' });
    }
});

app.get('/api/therapists', async (req, res) => {
    try {
        const { rows } = await db.query("SELECT id, full_name FROM therapists WHERE is_active = TRUE");
        res.status(200).json(rows);
    } catch (error) {
        console.error('❌ Error fetching therapists:', error);
        res.status(500).json({ error: 'Failed to fetch therapists.' });
    }
});

app.get('/api/availability', async (req, res) => {
    try {
        const { date, serviceId, therapistId } = req.query;
        if (!date || !serviceId || !therapistId) return res.status(200).json([]);
        
        const servicesResult = await db.query('SELECT duration_minutes FROM services WHERE id = $1', [serviceId]);
        if (servicesResult.rows.length === 0) return res.status(200).json([]);
        const durationMinutes = servicesResult.rows[0].duration_minutes;

        const schedulesResult = await db.query('SELECT start_time, end_time FROM therapist_schedules WHERE therapist_id = $1 AND day_of_week = $2', [therapistId, dayjs(date).day()]);
        if (schedulesResult.rows.length === 0) return res.status(200).json([]);
        const workingHours = { start: schedulesResult.rows[0].start_time, end: schedulesResult.rows[0].end_time };
        
        const bookingsResult = await db.query('SELECT start_datetime, end_datetime FROM bookings WHERE therapist_id = $1 AND DATE(start_datetime) = $2 AND status != $3', [therapistId, date, 'cancelled']);
        const existingBookings = bookingsResult.rows;

        const availableSlots = [];
        // ★ แก้ไขตรงนี้: กำหนด Timezone ให้ถูกต้อง
        const germanTimezone = "Europe/Berlin";
        let slotTime = dayjs.tz(`${date} ${workingHours.start}`, germanTimezone);
        const endTime = dayjs.tz(`${date} ${workingHours.end}`, germanTimezone);
        const interval = 30;

        while (slotTime.isBefore(endTime)) {
            const potentialEndTime = slotTime.add(durationMinutes, 'minute');
            if (potentialEndTime.isAfter(endTime)) break;
            const isOverlapping = existingBookings.some(booking => {
                const bookingStart = dayjs(booking.start_datetime);
                const bookingEnd = dayjs(booking.end_datetime);
                return slotTime.isBefore(bookingEnd) && potentialEndTime.isAfter(bookingStart);
            });
            if (!isOverlapping) availableSlots.push(slotTime.format('HH:mm'));
            slotTime = slotTime.add(interval, 'minute');
        }
        res.status(200).json(availableSlots);
    } catch (error) {
        console.error('❌ Error fetching availability:', error);
        res.status(500).json({ error: 'Failed to fetch availability.' });
    }
});

app.post('/api/bookings', async (req, res) => {
    const { serviceId, therapistId, date, time, customerName, customerEmail, customerPhone } = req.body;
    if (!serviceId || !therapistId || !date || !time || !customerName || !customerPhone) {
        return res.status(400).json({ error: 'Missing required booking information.' });
    }
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const servicesResult = await connection.query('SELECT name, duration_minutes, price FROM services WHERE id = $1', [serviceId]);
        if (servicesResult.rows.length === 0) throw new Error('Service not found.');
        
        const { name: serviceName, duration_minutes: durationMinutes, price } = servicesResult.rows[0];
        
        // ★ แก้ไขตรงนี้: กำหนด Timezone ให้ถูกต้อง
        const germanTimezone = "Europe/Berlin";
        const startDateTime = dayjs.tz(`${date} ${time}`, germanTimezone);
        const endDateTime = startDateTime.add(durationMinutes, 'minute');

        // แปลงเป็น UTC เพื่อบันทึกลง DB
        const startDateTimeForDB = startDateTime.utc().format('YYYY-MM-DD HH:mm:ss');
        const endDateTimeForDB = endDateTime.utc().format('YYYY-MM-DD HH:mm:ss');

        const existingBookingsResult = await connection.query('SELECT id FROM bookings WHERE therapist_id = $1 AND status != $2 AND ($3 < end_datetime AND $4 > start_datetime) FOR UPDATE', [therapistId, 'cancelled', startDateTimeForDB, endDateTimeForDB]);
        if (existingBookingsResult.rows.length > 0) {
            await connection.query('ROLLBACK');
            return res.status(409).json({ error: 'This time slot is no longer available.' });
        }
        
        let customerId;
        if (customerEmail && customerEmail.trim() !== '') {
            let customersResult = await connection.query('SELECT id FROM customers WHERE email = $1', [customerEmail]);
            if (customersResult.rows.length > 0) {
                customerId = customersResult.rows[0].id;
                await connection.query("UPDATE customers SET full_name = $1, phone_number = $2 WHERE id = $3", [customerName, customerPhone, customerId]);
            } else {
                const result = await connection.query('INSERT INTO customers (full_name, email, phone_number) VALUES ($1, $2, $3) RETURNING id', [customerName, customerEmail, customerPhone]);
                customerId = result.rows[0].id;
            }
        } else {
            let customersResult = await connection.query('SELECT id FROM customers WHERE phone_number = $1', [customerPhone]);
            if (customersResult.rows.length > 0) {
                customerId = customersResult.rows[0].id;
                await connection.query("UPDATE customers SET full_name = $1 WHERE id = $2", [customerName, customerId]);
            } else {
                const result = await connection.query('INSERT INTO customers (full_name, phone_number) VALUES ($1, $2) RETURNING id', [customerName, customerPhone]);
                customerId = result.rows[0].id;
            }
        }

        await connection.query('INSERT INTO bookings (customer_id, therapist_id, service_id, start_datetime, end_datetime, status, price_at_booking) VALUES ($1, $2, $3, $4, $5, $6, $7)', [customerId, therapistId, serviceId, startDateTimeForDB, endDateTimeForDB, 'confirmed', price]);
        
        const therapistsResult = await connection.query('SELECT full_name FROM therapists WHERE id = $1', [therapistId]);
        const therapistName = therapistsResult.rows[0]?.full_name || 'N/A';
        
        await connection.query('COMMIT');
        
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
        if(connection) await connection.query('ROLLBACK');
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

        const { rows } = await db.query("SELECT * FROM admin_users WHERE username = $1", [username]);
        if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials.' });
        
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

        const tokenPayload = { id: user.id, username: user.username };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.status(200).json({ message: 'Login successful!', token });
    } catch (error) {
        console.error('❌ Error during login:', error);
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
        const query = `
            SELECT b.id, b.start_datetime, b.end_datetime, 
                   s.name AS service_name, s.duration_minutes, 
                   t.id AS therapist_id, t.full_name AS therapist_name, 
                   c.full_name AS customer_name 
            FROM bookings AS b 
            JOIN services AS s ON b.service_id = s.id 
            JOIN therapists AS t ON b.therapist_id = t.id 
            JOIN customers AS c ON b.customer_id = c.id 
            WHERE DATE(b.start_datetime) = $1 AND b.status = 'confirmed' 
            ORDER BY b.start_datetime;`;
        const { rows } = await db.query(query, [date]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('❌ Error fetching schedule bookings:', error);
        res.status(500).json({ error: 'An error occurred fetching schedule bookings' });
    }
});

// --- Therapist Management ---
app.get('/api/therapists/all', verifyToken, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM therapists ORDER BY id");
        res.status(200).json(rows);
    } catch (error) { 
        console.error('❌ Error fetching all therapists:', error);
        res.status(500).json({ error: 'Failed to fetch therapists' }); 
    }
});

app.post('/api/therapists', verifyToken, async (req, res) => {
    try {
        const { full_name } = req.body;
        if (!full_name) return res.status(400).json({ error: 'Full name is required' });
        const result = await db.query("INSERT INTO therapists (full_name) VALUES ($1) RETURNING id", [full_name]);
        res.status(201).json({ id: result.rows[0].id, full_name, is_active: true });
    } catch (error) { 
        console.error('❌ Error creating therapist:', error);
        res.status(500).json({ error: 'Failed to create therapist' }); 
    }
});

app.put('/api/therapists/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { full_name, is_active } = req.body;
    if (full_name === undefined && is_active === undefined) return res.status(400).json({ error: 'No update data provided' });
    
    let query = "UPDATE therapists SET ";
    const params = [];
    let paramIndex = 1;

    if (full_name !== undefined) { 
        query += `full_name = $${paramIndex++}`; 
        params.push(full_name); 
    }
    if (is_active !== undefined) { 
        if (params.length > 0) query += ", "; 
        query += `is_active = $${paramIndex++}`; 
        params.push(is_active); 
    }
    query += ` WHERE id = $${paramIndex++}`;
    params.push(id);
    
    try {
        await db.query(query, params);
        res.status(200).json({ success: true, message: 'Therapist updated' });
    } catch (error) { 
        console.error('❌ Error updating therapist:', error);
        res.status(500).json({ error: 'Failed to update therapist' }); 
    }
});

app.delete('/api/therapists/:id/permanent', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const bookingsResult = await db.query("SELECT id FROM bookings WHERE therapist_id = $1 AND start_datetime >= CURRENT_DATE", [id]);
        if (bookingsResult.rows.length > 0) return res.status(409).json({ error: `Cannot delete. This therapist has ${bookingsResult.rows.length} upcoming booking(s).` });
        
        await db.query("DELETE FROM therapist_schedules WHERE therapist_id = $1", [id]);
        await db.query("DELETE FROM therapists WHERE id = $1", [id]);
        res.status(200).json({ success: true, message: 'Therapist permanently deleted.' });
    } catch (error) { 
        console.error('❌ Error deleting therapist:', error);
        res.status(500).json({ error: 'Failed to delete therapist' }); 
    }
});

// --- Service Management ---
app.get('/api/services/all', verifyToken, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM services ORDER BY name, duration_minutes");
        res.status(200).json(rows);
    } catch (error) {
        console.error('❌ Error fetching all services:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});
app.post('/api/services', verifyToken, async (req, res) => {
    const { name, duration_minutes, price } = req.body;
    if (!name || !duration_minutes || !price) return res.status(400).json({ error: 'All fields are required' });
    try {
        const result = await db.query("INSERT INTO services (name, duration_minutes, price) VALUES ($1, $2, $3) RETURNING id", [name, duration_minutes, price]);
        res.status(201).json({ id: result.rows[0].id, name, duration_minutes, price, is_active: true });
    } catch (error) { 
        console.error('❌ Error creating service:', error);
        res.status(500).json({ error: 'Failed to create service' }); 
    }
});
app.put('/api/services/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { name, duration_minutes, price, is_active } = req.body;
    
    const fields = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); params.push(name); }
    if (duration_minutes !== undefined) { fields.push(`duration_minutes = $${paramIndex++}`); params.push(duration_minutes); }
    if (price !== undefined) { fields.push(`price = $${paramIndex++}`); params.push(price); }
    if (is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); params.push(is_active); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    
    const query = `UPDATE services SET ${fields.join(', ')} WHERE id = $${paramIndex++}`;
    params.push(id);
    
    try {
        await db.query(query, params);
        res.status(200).json({ success: true, message: 'Service updated' });
    } catch (error) { 
        console.error('❌ Error updating service:', error);
        res.status(500).json({ error: 'Failed to update service' }); 
    }
});
app.delete('/api/services/:id', verifyToken, async (req, res) => {
    try {
        await db.query("UPDATE services SET is_active = FALSE WHERE id = $1", [req.params.id]);
        res.status(200).json({ success: true, message: 'Service deactivated' });
    } catch (error) { 
        console.error('❌ Error deactivating service:', error);
        res.status(500).json({ error: 'Failed to deactivate service' }); 
    }
});

// --- Therapist Schedule Management ---
app.get('/api/therapists/:therapistId/schedules', verifyToken, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM therapist_schedules WHERE therapist_id = $1 ORDER BY day_of_week", [req.params.therapistId]);
        res.status(200).json(rows);
    } catch (error) { 
        console.error('❌ Error fetching schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' }); 
    }
});
app.post('/api/schedules', verifyToken, async (req, res) => {
    const { therapist_id, day_of_week, start_time, end_time } = req.body;
    if (!therapist_id || day_of_week === undefined || !start_time || !end_time) return res.status(400).json({ error: 'Missing data' });
    try {
        const query = `
            INSERT INTO therapist_schedules (therapist_id, day_of_week, start_time, end_time) 
            VALUES ($1, $2, $3, $4) 
            ON CONFLICT (therapist_id, day_of_week) 
            DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time`;
        await db.query(query, [therapist_id, day_of_week, start_time, end_time]);
        res.status(201).json({ success: true, message: 'Schedule saved' });
    } catch (error) { 
        console.error('❌ Error saving schedule:', error);
        res.status(500).json({ error: 'Failed to save schedule' }); 
    }
});
app.delete('/api/schedules/:scheduleId', verifyToken, async (req, res) => {
    try {
        await db.query("DELETE FROM therapist_schedules WHERE id = $1", [req.params.scheduleId]);
        res.status(200).json({ success: true, message: 'Schedule deleted' });
    } catch (error) { 
        console.error('❌ Error deleting schedule:', error);
        res.status(500).json({ error: 'Failed to delete schedule' }); 
    }
});

// --- Booking Management ---
app.get('/api/bookings/all', verifyToken, async (req, res) => {
    try {
        const { therapistName, timeFilter } = req.query;

        let bookingsQuery = `SELECT b.*, c.full_name as customer_name, c.email, c.phone_number, s.name as service_name, t.full_name as therapist_name 
                             FROM bookings b
                             LEFT JOIN customers c ON b.customer_id = c.id
                             LEFT JOIN services s ON b.service_id = s.id
                             LEFT JOIN therapists t ON b.therapist_id = t.id`;
        
        const whereClauses = [];
        const params = [];
        let paramIndex = 1;

        if (timeFilter === 'upcoming') {
            whereClauses.push(`b.start_datetime >= CURRENT_DATE`);
        } else if (timeFilter === 'past') {
            whereClauses.push(`b.start_datetime < CURRENT_DATE`);
        }
        
        if (therapistName) {
            whereClauses.push(`t.full_name ILIKE $${paramIndex++}`);
            params.push(`%${therapistName}%`);
        }

        if (whereClauses.length > 0) {
            bookingsQuery += " WHERE " + whereClauses.join(" AND ");
        }
        bookingsQuery += " ORDER BY b.start_datetime DESC";
        
        const { rows } = await db.query(bookingsQuery, params);
        res.status(200).json(rows);

    } catch (error) {
        console.error('❌ Error fetching all bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

app.delete('/api/bookings/:id', verifyToken, async (req, res) => {
    try {
        await db.query("DELETE FROM bookings WHERE id = $1", [req.params.id]);
        res.status(200).json({ success: true, message: 'Booking deleted' });
    } catch (error) { 
        console.error('❌ Error deleting booking:', error);
        res.status(500).json({ error: 'Failed to delete booking' }); 
    }
});

// --- User Management ---
app.get('/api/users', verifyToken, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT id, username, created_at FROM admin_users ORDER BY username");
        res.status(200).json(rows);
    } catch (error) { 
        console.error('❌ Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' }); 
    }
});
app.post('/api/users', verifyToken, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    try {
        const password_hash = await bcrypt.hash(password, saltRounds);
        const result = await db.query("INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) RETURNING id", [username, password_hash]);
        res.status(201).json({ id: result.rows[0].id, username });
    } catch (error) {
        console.error('❌ Error creating user:', error);
        if (error.code === '23505') { // Unique violation in PostgreSQL
            return res.status(409).json({ error: 'This username is already taken.' });
        }
        res.status(500).json({ error: 'Failed to create user' });
    }
});
app.delete('/api/users/:id', verifyToken, async (req, res) => {
    try {
        await db.query("DELETE FROM admin_users WHERE id = $1", [req.params.id]);
        res.status(200).json({ success: true, message: 'User deleted' });
    } catch (error) { 
        console.error('❌ Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' }); 
    }
});

// --- Reports / Dashboard Endpoints ---
app.get('/api/reports/revenue-summary', verifyToken, async (req, res) => {
    const { year } = req.query;
    try {
        let query = `
            SELECT 
                EXTRACT(YEAR FROM start_datetime) as year,
                EXTRACT(MONTH FROM start_datetime) as month,
                SUM(price_at_booking) as total_revenue
            FROM bookings
            WHERE status = 'confirmed'
        `;
        const params = [];
        let paramIndex = 1;

        if (year) {
            query += ` AND EXTRACT(YEAR FROM start_datetime) = $${paramIndex++}`;
            params.push(year);
        }

        query += ' GROUP BY 1, 2 ORDER BY 1, 2;';
        
        const { rows } = await db.query(query, params);
        res.status(200).json(rows);
    } catch (error) {
        console.error('❌ Error fetching revenue summary:', error);
        res.status(500).json({ error: 'Failed to fetch revenue summary' });
    }
});

app.get('/api/reports/therapist-performance', verifyToken, async (req, res) => {
    const { year, month } = req.query;
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
        let paramIndex = 1;

        if (year) {
            query += ` AND EXTRACT(YEAR FROM b.start_datetime) = $${paramIndex++}`;
            params.push(year);
        }
        if (month) {
            query += ` AND EXTRACT(MONTH FROM b.start_datetime) = $${paramIndex++}`;
            params.push(month);
        }

        query += ' GROUP BY t.full_name ORDER BY total_revenue DESC;';

        const { rows } = await db.query(query, params);
        res.status(200).json(rows);
    } catch (error) {
        console.error('❌ Error fetching therapist performance:', error);
        res.status(500).json({ error: 'Failed to fetch therapist performance' });
    }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});