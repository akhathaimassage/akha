const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middlewares/auth');

// Public: Fetch active services
router.get('/api/services', async (req, res) => {
    try {
        const { rows } = await db.query("SELECT id, name, duration_minutes, price, discounted_price, is_active FROM services WHERE is_active = TRUE");
        res.status(200).json(rows);
    } catch (error) {
        console.error('❌ Error fetching services:', error);
        res.status(500).json({ error: 'Failed to fetch services.' });
    }
});

// Admin: Get all services
router.get('/api/services/all', verifyToken, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM services ORDER BY name, duration_minutes");
        res.status(200).json(rows);
    } catch (error) {
        console.error('❌ Error fetching all services:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

// Admin: Create service
router.post('/api/services', verifyToken, async (req, res) => {
    const { name, duration_minutes, price, discounted_price } = req.body;
    if (!name || !duration_minutes || !price) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    try {
        const query = "INSERT INTO services (name, duration_minutes, price, discounted_price) VALUES ($1, $2, $3, $4) RETURNING *";
        const params = [name, duration_minutes, price, discounted_price || null];
        const result = await db.query(query, params);
        res.status(201).json(result.rows[0]);
    } catch (error) { 
        console.error('❌ Error creating service:', error);
        res.status(500).json({ error: 'Failed to create service' }); 
    }
});

// Admin: Bulk update service discounts
router.put('/api/services/bulk-update', verifyToken, async (req, res) => {
    const { ids, discounted_price } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Service IDs must be a non-empty array.' });
    }

    const newPrice = discounted_price === '' || discounted_price === null ? null : parseFloat(discounted_price);

    try {
        const query = `
            UPDATE services 
            SET discounted_price = $1 
            WHERE id = ANY($2::int[])
        `;
        
        const result = await db.query(query, [newPrice, ids]);

        res.status(200).json({ success: true, message: `${result.rowCount} services updated successfully.` });
    } catch (error) {
        console.error('❌ Error during bulk service update:', error);
        res.status(500).json({ error: 'Failed to perform bulk update.' });
    }
});

// Admin: Update service details
router.put('/api/services/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { name, duration_minutes, price, is_active, discounted_price } = req.body;
    
    const fields = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); params.push(name); }
    if (duration_minutes !== undefined) { fields.push(`duration_minutes = $${paramIndex++}`); params.push(duration_minutes); }
    if (price !== undefined) { fields.push(`price = $${paramIndex++}`); params.push(price); }
    if (is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); params.push(is_active); }
    if (discounted_price !== undefined) { 
        fields.push(`discounted_price = $${paramIndex++}`); 
        params.push(discounted_price === '' ? null : discounted_price);
    }

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

// Admin: Deactivate service (Soft delete)
router.delete('/api/services/:id', verifyToken, async (req, res) => {
    try {
        await db.query("UPDATE services SET is_active = FALSE WHERE id = $1", [req.params.id]);
        res.status(200).json({ success: true, message: 'Service deactivated' });
    } catch (error) { 
        console.error('❌ Error deactivating service:', error);
        res.status(500).json({ error: 'Failed to deactivate service' }); 
    }
});

// Admin: Permanently delete service
router.delete('/api/services/:id/permanent', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const bookingsResult = await db.query(
            "SELECT id FROM bookings WHERE service_id = $1 AND start_datetime >= CURRENT_DATE", 
            [id]
        );

        if (bookingsResult.rows.length > 0) {
            return res.status(409).json({ 
                error: `Cannot delete. This service is used in ${bookingsResult.rows.length} upcoming booking(s).` 
            });
        }
        
        await db.query("DELETE FROM services WHERE id = $1", [id]);
        res.status(200).json({ success: true, message: 'Service permanently deleted.' });

    } catch (error) { 
        console.error('❌ Error permanently deleting service:', error);
        res.status(500).json({ error: 'Failed to permanently delete service.' }); 
    }
});

module.exports = router;
