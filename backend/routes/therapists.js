const express = require('express');
const router = express.Router();
const db = require('../db');
const dayjs = require('dayjs');
const verifyToken = require('../middlewares/auth');

// Public: Fetch therapists with schedules
router.get('/api/therapists', async (req, res) => {
    try {
        const therapistsResult = await db.query(`
            SELECT id, full_name 
            FROM therapists 
            WHERE is_active = TRUE 
              AND is_deleted = FALSE 
              AND show_on_website = TRUE 
            ORDER BY display_order ASC, id ASC
        `);
        const therapists = therapistsResult.rows;

        if (therapists.length === 0) {
            return res.status(200).json([]);
        }

        const schedulesResult = await db.query("SELECT therapist_id, day_of_week FROM therapist_schedules");
        const schedules = schedulesResult.rows;

        const therapistsWithSchedules = therapists.map(therapist => {
            const therapistSchedules = schedules
                .filter(s => s.therapist_id === therapist.id)
                .map(s => s.day_of_week);

            return {
                ...therapist,
                work_days: therapistSchedules
            };
        });

        res.status(200).json(therapistsWithSchedules);

    } catch (error) {
        console.error('❌ Error fetching therapists with schedules:', error);
        res.status(500).json({ error: 'Failed to fetch therapists.' });
    }
});

// Admin: Get all therapists
router.get('/api/therapists/all', verifyToken, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM therapists WHERE is_deleted = FALSE ORDER BY display_order ASC, id ASC");
        res.status(200).json(rows);
    } catch (error) { 
        console.error('❌ Error fetching all therapists:', error);
        res.status(500).json({ error: 'Failed to fetch therapists' }); 
    }
});

// Admin: Create new therapist
router.post('/api/therapists', verifyToken, async (req, res) => {
    try {
        const { full_name, show_on_website = true, display_order = 99, require_timesheet = false } = req.body;
        if (!full_name) return res.status(400).json({ error: 'Full name is required' });
        
        const result = await db.query(
            "INSERT INTO therapists (full_name, show_on_website, display_order, require_timesheet) VALUES ($1, $2, $3, $4) RETURNING id", 
            [full_name, show_on_website, display_order, require_timesheet]
        );
        res.status(201).json({ id: result.rows[0].id, full_name, is_active: true, show_on_website, display_order, require_timesheet });
    } catch (error) { 
        console.error('❌ Error creating therapist:', error);
        res.status(500).json({ error: 'Failed to create therapist' }); 
    }
});

// Admin: Update therapist
router.put('/api/therapists/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { full_name, is_active, show_on_website, display_order, require_timesheet } = req.body;
    
    if (full_name === undefined && is_active === undefined && show_on_website === undefined && display_order === undefined && require_timesheet === undefined) {
        return res.status(400).json({ error: 'No update data provided' });
    }
    
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
    if (show_on_website !== undefined) { 
        if (params.length > 0) query += ", "; 
        query += `show_on_website = $${paramIndex++}`; 
        params.push(show_on_website); 
    }
    if (display_order !== undefined) { 
        if (params.length > 0) query += ", "; 
        query += `display_order = $${paramIndex++}`; 
        params.push(display_order); 
    }
    if (require_timesheet !== undefined) { 
        if (params.length > 0) query += ", "; 
        query += `require_timesheet = $${paramIndex++}`; 
        params.push(require_timesheet); 
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

// Admin: Soft delete therapist
router.delete('/api/therapists/:id/permanent', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const bookingsResult = await db.query("SELECT id FROM bookings WHERE therapist_id = $1 AND start_datetime >= CURRENT_DATE", [id]);
        if (bookingsResult.rows.length > 0) {
            return res.status(409).json({ error: `Cannot delete. This therapist has ${bookingsResult.rows.length} upcoming booking(s).` });
        }
        
        await db.query("DELETE FROM therapist_schedules WHERE therapist_id = $1", [id]);
        
        // Soft delete: is_deleted = TRUE, is_active = FALSE, show_on_website = FALSE
        await db.query("UPDATE therapists SET is_deleted = TRUE, is_active = FALSE, show_on_website = FALSE WHERE id = $1", [id]);
        
        res.status(200).json({ success: true, message: 'Therapist soft-deleted successfully.' });
    } catch (error) { 
        console.error('❌ Error deleting therapist:', error);
        res.status(500).json({ error: 'Failed to delete therapist' }); 
    }
});

// Admin: Get therapist schedules
router.get('/api/therapists/:therapistId/schedules', verifyToken, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM therapist_schedules WHERE therapist_id = $1 ORDER BY day_of_week", [req.params.therapistId]);
        res.status(200).json(rows);
    } catch (error) { 
        console.error('❌ Error fetching schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' }); 
    }
});

// Admin: Save/update schedule
router.post('/api/schedules', verifyToken, async (req, res) => {
    const { therapist_id, day_of_week, start_time, end_time } = req.body;
    if (!therapist_id || day_of_week === undefined || !start_time || !end_time) {
        return res.status(400).json({ error: 'Missing data' });
    }
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

// Admin: Delete schedule
router.delete('/api/schedules/:scheduleId', verifyToken, async (req, res) => {
    try {
        await db.query("DELETE FROM therapist_schedules WHERE id = $1", [req.params.scheduleId]);
        res.status(200).json({ success: true, message: 'Schedule deleted' });
    } catch (error) { 
        console.error('❌ Error deleting schedule:', error);
        res.status(500).json({ error: 'Failed to delete schedule' }); 
    }
});

module.exports = router;
