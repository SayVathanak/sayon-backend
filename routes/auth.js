// sayon-backend/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Gets the pool connection from the Express application local storage
    const pool = req.app.locals.pool; 

    try {
        // 💡 FIX 1: Select the 'role' column from the database
        const userRes = await pool.query('SELECT user_id, password_hash, name, role FROM staff_users WHERE username = $1', [username]);
        const user = userRes.rows[0];

        if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

        // 💡 FIX 2: Use the dynamic 'user.role' from the database for the JWT payload
        const payload = { userId: user.user_id, name: user.name, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

        // 💡 FIX 3: Send the role back in the user object for the frontend store (auth.js)
        return res.json({ 
            token: token, 
            user: { id: user.user_id, name: user.name, role: user.role } 
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

module.exports = { 
    router, // Export the router
};