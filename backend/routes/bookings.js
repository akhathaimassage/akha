const express = require('express');
const router = express.Router();
const db = require('../db');
const dayjs = require('dayjs');
const verifyToken = require('../middlewares/auth');
const transporter = require('../config/email');

// Public: Get slot availability for booking
router.get('/api/availability', async (req, res) => {
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
        let slotTime = dayjs(`${date} ${workingHours.start}`);
        const endTime = dayjs(`${date} ${workingHours.end}`);
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

// Public: Create customer booking
router.post('/api/bookings', async (req, res) => {
    const { serviceId, therapistId, date, time, customerName, customerEmail, customerPhone } = req.body;
    if (!serviceId || !therapistId || !date || !time || !customerName || !customerPhone) {
        return res.status(400).json({ error: 'Missing required booking information.' });
    }
    
    if (!customerPhone || customerPhone.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number format.' });
    }

    try {
        await db.query('BEGIN');

        const servicesResult = await db.query('SELECT name, duration_minutes, price, discounted_price FROM services WHERE id = $1', [serviceId]);
        if (servicesResult.rows.length === 0) throw new Error('Service not found.');
        
        const service = servicesResult.rows[0];
        const { name: serviceName, duration_minutes: durationMinutes } = service;
        
        const priceAtBooking = service.discounted_price || service.price;
        
        const startDateTime = dayjs(`${date} ${time}`);
        const endDateTime = startDateTime.add(durationMinutes, 'minute');
        const startDateTimeForDB = startDateTime.format('YYYY-MM-DD HH:mm:ss');
        const endDateTimeForDB = endDateTime.format('YYYY-MM-DD HH:mm:ss');

        const existingBookingsResult = await db.query('SELECT id FROM bookings WHERE therapist_id = $1 AND status != $2 AND ($3 < end_datetime AND $4 > start_datetime) FOR UPDATE', [therapistId, 'cancelled', startDateTimeForDB, endDateTimeForDB]);
        if (existingBookingsResult.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(409).json({ error: 'This time slot is no longer available.' });
        }
        
        let customerId;
        if (customerEmail && customerEmail.trim() !== '') {
            let customersResult = await db.query('SELECT id FROM customers WHERE email = $1', [customerEmail]);
            if (customersResult.rows.length > 0) {
                customerId = customersResult.rows[0].id;
                await db.query("UPDATE customers SET full_name = $1, phone_number = $2 WHERE id = $3", [customerName, customerPhone, customerId]);
            } else {
                const result = await db.query('INSERT INTO customers (full_name, email, phone_number) VALUES ($1, $2, $3) RETURNING id', [customerName, customerEmail, customerPhone]);
                customerId = result.rows[0].id;
            }
        } else {
            let customersResult = await db.query('SELECT id FROM customers WHERE phone_number = $1', [customerPhone]);
            if (customersResult.rows.length > 0) {
                customerId = customersResult.rows[0].id;
                await db.query("UPDATE customers SET full_name = $1 WHERE id = $2", [customerName, customerId]);
            } else {
                const result = await db.query('INSERT INTO customers (full_name, phone_number) VALUES ($1, $2) RETURNING id', [customerName, customerPhone]);
                customerId = result.rows[0].id;
            }
        }
        
        await db.query('INSERT INTO bookings (customer_id, therapist_id, service_id, start_datetime, end_datetime, status, price_at_booking) VALUES ($1, $2, $3, $4, $5, $6, $7)', [customerId, therapistId, serviceId, startDateTimeForDB, endDateTimeForDB, 'confirmed', priceAtBooking]);
        
        const therapistsResult = await db.query('SELECT full_name FROM therapists WHERE id = $1', [therapistId]);
        const therapistName = therapistsResult.rows[0]?.full_name || 'N/A';
        
        await db.query('COMMIT');
        
        if (customerEmail && customerEmail.trim() !== '') {
            const formattedDate = dayjs(date).format('DD.MM.YYYY');
            const mailSubject = `Akha Thai Massage - Buchungsbestätigung: ${serviceName}`;

            const plainText = `Hallo ${customerName},

Vielen Dank für Ihre Buchung bei Akha Thai Massage!
Ihre Buchung wurde erfolgreich bestätigt.

IHRE BUCHUNGSDETAILS:
--------------------------------------------------
• Behandlung: ${serviceName} (${durationMinutes} Min.)
• Masseurin:  ${therapistName}
• Datum:      ${formattedDate}
• Uhrzeit:    ${time} Uhr
• Preis:      ${priceAtBooking} €
--------------------------------------------------

STANDORT & ANFAHRT:
Akha Thai Massage
Hauptstraße 31, 79761 Tiengen, Deutschland
Telefon: +49 (0) 7741 9695546
Mobil / WhatsApp: +49 (0) 151 51 646 555
E-Mail: info@akhathaimassage.de
Öffnungszeiten: Mo - Sa: 09:00 - 19:00 Uhr | So: Geschlossen

WICHTIGER HINWEIS:
Falls Sie Ihren Termin verschieben oder stornieren müssen, bitten wir Sie, uns mindestens 24 Stunden vorher telefonisch oder per WhatsApp zu benachrichtigen.

Wir freuen uns sehr auf Ihren Besuch!

Herzliche Grüße,
Ihr Akha Thai Massage Team
https://akhathaimassage.de`;

            const htmlContent = `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${mailSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f1ea; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f1ea; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a2f; padding: 35px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; color: #ffffff; letter-spacing: 1px; font-weight: 600;">Akha Thai Massage</h1>
              <p style="margin: 6px 0 0 0; color: #d4af37; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Traditionelle Thaimassage in Tiengen</p>
            </td>
          </tr>

          <!-- Confirmation Badge -->
          <tr>
            <td style="padding: 30px 30px 10px 30px; text-align: center;">
              <div style="display: inline-block; background-color: #e8f5e9; color: #2e7d32; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; border: 1px solid #c8e6c9;">
                ✓ Buchung bestätigt
              </div>
              <h2 style="margin: 18px 0 8px 0; color: #1e3a2f; font-size: 22px;">Vielen Dank, ${customerName}!</h2>
              <p style="margin: 0; color: #555555; font-size: 15px; line-height: 1.5;">
                Wir haben Ihren Termin erfolgreich eingetragen. Hier sind Ihre Buchungsdetails:
              </p>
            </td>
          </tr>

          <!-- Booking Details Card -->
          <tr>
            <td style="padding: 20px 30px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #faf8f5; border-radius: 12px; border: 1px solid #eee8df; padding: 20px;">
                <tr>
                  <td style="padding: 8px 12px; color: #777777; font-size: 14px; border-bottom: 1px solid #eee8df; width: 35%;">Behandlung</td>
                  <td style="padding: 8px 12px; color: #1e3a2f; font-size: 15px; font-weight: 600; border-bottom: 1px solid #eee8df;">${serviceName} (${durationMinutes} Min.)</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; color: #777777; font-size: 14px; border-bottom: 1px solid #eee8df;">Masseurin</td>
                  <td style="padding: 8px 12px; color: #1e3a2f; font-size: 15px; font-weight: 600; border-bottom: 1px solid #eee8df;">${therapistName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; color: #777777; font-size: 14px; border-bottom: 1px solid #eee8df;">Datum</td>
                  <td style="padding: 8px 12px; color: #1e3a2f; font-size: 15px; font-weight: 600; border-bottom: 1px solid #eee8df;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; color: #777777; font-size: 14px; border-bottom: 1px solid #eee8df;">Uhrzeit</td>
                  <td style="padding: 8px 12px; color: #c58e1b; font-size: 16px; font-weight: 700; border-bottom: 1px solid #eee8df;">${time} Uhr</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; color: #777777; font-size: 14px;">Preis</td>
                  <td style="padding: 8px 12px; color: #1e3a2f; font-size: 16px; font-weight: 700;">${priceAtBooking} €</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contact & Location Box -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="background-color: #f1f8f5; border-left: 4px solid #1e3a2f; padding: 16px 20px; border-radius: 6px;">
                <p style="margin: 0 0 6px 0; color: #1e3a2f; font-weight: 600; font-size: 14px;">📍 Standort & Kontakt:</p>
                <p style="margin: 0; color: #444444; font-size: 13px; line-height: 1.6;">
                  Hauptstraße 31, 79761 Tiengen, Deutschland<br>
                  Telefon: <a href="tel:+4977419695546" style="color: #1e3a2f; font-weight: 600; text-decoration: none;">+49 (0) 7741 9695546</a><br>
                  WhatsApp: <a href="https://wa.me/4915151646555" style="color: #25d366; font-weight: 600; text-decoration: none;">+49 (0) 151 51 646 555</a><br>
                  Öffnungszeiten: Mo - Sa: 09:00 - 19:00 Uhr
                </p>
              </div>
            </td>
          </tr>

          <!-- Notice / Policy -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="margin: 0; color: #777777; font-size: 12px; line-height: 1.5; text-align: center;">
                <em>Haben Sie Fragen oder müssen Sie den Termin absagen? Bitte kontaktieren Sie uns rechtzeitig per Telefon oder WhatsApp.</em>
              </p>
            </td>
          </tr>

          <!-- Footer / Impressum -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0 0 5px 0; color: #888888; font-size: 12px; font-weight: 600;">
                Akha Thai Massage
              </p>
              <p style="margin: 0; color: #999999; font-size: 11px; line-height: 1.4;">
                Hauptstraße 31, 79761 Waldshut-Tiengen, Deutschland<br>
                E-Mail: <a href="mailto:info@akhathaimassage.de" style="color: #777777;">info@akhathaimassage.de</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

            const mailOptions = {
                from: `"Akha Thai Massage" <${process.env.EMAIL_USER}>`,
                replyTo: `"Akha Thai Massage" <${process.env.EMAIL_USER}>`,
                to: customerEmail,
                subject: mailSubject,
                text: plainText,
                html: htmlContent
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) console.error('❌ Error sending email:', error);
                else console.log('✅ Email sent:', info.response);
            });
        }
        
        res.status(201).json({ 
            success: true, 
            message: 'Booking confirmed successfully!',
            booking: {
                customerName,
                customerEmail,
                serviceName,
                durationMinutes,
                therapistName,
                date: dayjs(date).format('DD.MM.YYYY'),
                time,
                price: priceAtBooking
            }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('❌ Error creating booking:', error);
        res.status(500).json({ error: 'Failed to create booking.' });
    }
});

// Admin: Get bookings for a specific date
router.get('/api/admin/bookings_by_date', verifyToken, async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date query parameter is required.' });

    // Restrict staff users from viewing past dates
    if (req.user && req.user.role === 'staff') {
        const isPastDate = dayjs(date).isBefore(dayjs(), 'day');
        if (isPastDate) {
            return res.status(403).json({ error: 'Forbidden: Staff cannot view bookings of past dates.' });
        }
    }

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

// Admin: Fetch all bookings (with search/filters)
router.get('/api/bookings/all', verifyToken, async (req, res) => {
    try {
        const { therapistName, timeFilter, year, month } = req.query;

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

        if (year && year !== 'all') {
            whereClauses.push(`EXTRACT(YEAR FROM b.start_datetime) = $${paramIndex++}`);
            params.push(parseInt(year, 10));
        }

        if (month && month !== 'all') {
            whereClauses.push(`EXTRACT(MONTH FROM b.start_datetime) = $${paramIndex++}`);
            params.push(parseInt(month, 10));
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

// Admin: Delete a booking
router.delete('/api/bookings/:id', verifyToken, async (req, res) => {
    try {
        await db.query("DELETE FROM bookings WHERE id = $1", [req.params.id]);
        res.status(200).json({ success: true, message: 'Booking deleted' });
    } catch (error) { 
        console.error('❌ Error deleting booking:', error);
        res.status(500).json({ error: 'Failed to delete booking' }); 
    }
});

// Admin: Update a booking
router.put('/api/bookings/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { 
        serviceId, 
        therapistId, 
        start_datetime, 
        status, 
        price_at_booking,
        customerName,
        customerPhone,
        customerEmail
    } = req.body;

    if (!serviceId || !therapistId || !start_datetime || !customerName || !customerPhone) {
        return res.status(400).json({ error: 'Missing required booking information.' });
    }

    try {
        await db.query('BEGIN');

        // 1. Get customer_id associated with this booking
        const bookingCheck = await db.query('SELECT customer_id FROM bookings WHERE id = $1', [id]);
        if (bookingCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Booking not found.' });
        }
        const customerId = bookingCheck.rows[0].customer_id;

        // 2. Update customer details
        await db.query(
            'UPDATE customers SET full_name = $1, phone_number = $2, email = $3 WHERE id = $4',
            [customerName, customerPhone, customerEmail || null, customerId]
        );

        // 3. Get service duration to compute end_datetime
        const serviceRes = await db.query('SELECT duration_minutes FROM services WHERE id = $1', [serviceId]);
        if (serviceRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Service not found.' });
        }
        const durationMinutes = serviceRes.rows[0].duration_minutes;

        // Compute end_datetime using dayjs
        const start = dayjs(start_datetime);
        const end = start.add(durationMinutes, 'minute');
        const startStr = start.format('YYYY-MM-DD HH:mm:ss');
        const endStr = end.format('YYYY-MM-DD HH:mm:ss');

        // 4. Overlap check - only if start_datetime is in the future
        // Past bookings skip overlap check for easier accounting adjustments.
        const isFuture = start.isAfter(dayjs());
        if (isFuture && status !== 'cancelled') {
            const overlapResult = await db.query(
                `SELECT id FROM bookings 
                 WHERE therapist_id = $1 
                   AND id != $2 
                   AND status != 'cancelled' 
                   AND ($3 < end_datetime AND $4 > start_datetime)`,
                [therapistId, id, startStr, endStr]
            );
            if (overlapResult.rows.length > 0) {
                await db.query('ROLLBACK');
                return res.status(409).json({ error: 'This time slot is already booked for this therapist.' });
            }
        }

        // 5. Update the booking details
        await db.query(
            `UPDATE bookings 
             SET service_id = $1, therapist_id = $2, start_datetime = $3, end_datetime = $4, status = $5, price_at_booking = $6
             WHERE id = $7`,
            [serviceId, therapistId, startStr, endStr, status, price_at_booking, id]
        );

        await db.query('COMMIT');
        res.status(200).json({ success: true, message: 'Booking updated successfully.' });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('❌ Error updating booking:', error);
        res.status(500).json({ error: 'Failed to update booking.' });
    }
});

// --- Reports / Dashboard Endpoints ---
router.get('/api/reports/revenue-summary', verifyToken, async (req, res) => {
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

router.get('/api/reports/therapist-performance', verifyToken, async (req, res) => {
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

module.exports = router;
