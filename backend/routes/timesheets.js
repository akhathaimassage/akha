const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middlewares/auth');
const verifyAdmin = require('../middlewares/admin');

// Require authentication and admin role for all timesheet endpoints
router.use(verifyToken);
router.use(verifyAdmin);

// Admin: Get timesheets for a therapist and month/year
router.get('/api/admin/timesheets', async (req, res) => {
    const { therapistId, year, month } = req.query;
    if (!therapistId || !year || !month) {
        return res.status(400).json({ error: 'Missing required query parameters: therapistId, year, month.' });
    }
    try {
        const query = `
            SELECT id, work_date::text as work_date_str, start_time::text as start_time_str, end_time::text as end_time_str, break_minutes, notes 
            FROM therapist_timesheets 
            WHERE therapist_id = $1 
              AND EXTRACT(YEAR FROM work_date) = $2 
              AND EXTRACT(MONTH FROM work_date) = $3
            ORDER BY work_date ASC;
        `;
        const { rows } = await db.query(query, [therapistId, parseInt(year, 10), parseInt(month, 10)]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('❌ Error fetching timesheets:', error);
        res.status(500).json({ error: 'Failed to fetch timesheet records.' });
    }
});

// Admin: Save/Update individual day timesheet record
router.post('/api/admin/timesheets', async (req, res) => {
    const { therapistId, work_date, start_time, end_time, break_minutes = 0, notes = '' } = req.body;
    if (!therapistId || !work_date || !start_time || !end_time) {
        return res.status(400).json({ error: 'Missing required timesheet fields.' });
    }
    try {
        const query = `
            INSERT INTO therapist_timesheets (therapist_id, work_date, start_time, end_time, break_minutes, notes, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            ON CONFLICT (therapist_id, work_date) 
            DO UPDATE SET 
              start_time = EXCLUDED.start_time, 
              end_time = EXCLUDED.end_time, 
              break_minutes = EXCLUDED.break_minutes, 
              notes = EXCLUDED.notes,
              updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const { rows } = await db.query(query, [therapistId, work_date, start_time, end_time, break_minutes, notes]);
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('❌ Error saving timesheet:', error);
        res.status(500).json({ error: 'Failed to save timesheet record.' });
    }
});

// Admin: Bulk populate standard working hours
router.post('/api/admin/timesheets/bulk', async (req, res) => {
    const { therapistId, timesheets } = req.body;
    if (!therapistId || !Array.isArray(timesheets) || timesheets.length === 0) {
        return res.status(400).json({ error: 'Missing required parameters for bulk operations.' });
    }
    try {
        await db.query('BEGIN');
        
        const query = `
            INSERT INTO therapist_timesheets (therapist_id, work_date, start_time, end_time, break_minutes, notes, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            ON CONFLICT (therapist_id, work_date) 
            DO UPDATE SET 
              start_time = EXCLUDED.start_time, 
              end_time = EXCLUDED.end_time, 
              break_minutes = EXCLUDED.break_minutes, 
              notes = EXCLUDED.notes,
              updated_at = CURRENT_TIMESTAMP;
        `;

        for (const t of timesheets) {
            await db.query(query, [therapistId, t.work_date, t.start_time, t.end_time, t.break_minutes || 0, t.notes || '']);
        }

        await db.query('COMMIT');
        res.status(200).json({ success: true, message: `Successfully saved ${timesheets.length} timesheet records.` });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('❌ Error saving bulk timesheets:', error);
        res.status(500).json({ error: 'Failed to bulk save timesheet records.' });
    }
});

// Admin: Delete a timesheet record
router.delete('/api/admin/timesheets/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("DELETE FROM therapist_timesheets WHERE id = $1", [id]);
        res.status(200).json({ success: true, message: 'Timesheet record deleted.' });
    } catch (error) {
        console.error('❌ Error deleting timesheet record:', error);
        res.status(500).json({ error: 'Failed to delete timesheet record.' });
    }
});

module.exports = router;
