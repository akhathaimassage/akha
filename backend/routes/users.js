const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const verifyToken = require('../middlewares/auth');
const verifyAdmin = require('../middlewares/admin');

const saltRounds = 10;

// Require authentication and admin role for all user management endpoints
router.use(verifyToken);
router.use(verifyAdmin);

// Admin: Get all admin users
router.get('/api/users', async (req, res) => {
    try {
        const { rows } = await db.query("SELECT id, username, created_at FROM admin_users ORDER BY username");
        res.status(200).json(rows);
    } catch (error) { 
        console.error('❌ Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' }); 
    }
});

// Admin: Create a new admin user
router.post('/api/users', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
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

// Admin: Delete an admin user
router.delete('/api/users/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM admin_users WHERE id = $1", [req.params.id]);
        res.status(200).json({ success: true, message: 'User deleted' });
    } catch (error) { 
        console.error('❌ Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' }); 
    }
});

module.exports = router;
