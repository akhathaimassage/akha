const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }

        console.log("Login attempt received: username =", username, "password length =", password ? password.length : 0);
        const { rows } = await db.query("SELECT * FROM admin_users WHERE username = $1", [username]);
        console.log("Database user lookup result rows count:", rows.length);
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const tokenPayload = { id: user.id, username: user.username, role: user.role || 'admin' };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.status(200).json({ message: 'Login successful!', token });
    } catch (error) {
        console.error('❌ Error during login:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

module.exports = router;
