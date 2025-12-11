// sayon-backend/routes/branches.js
const express = require('express');
const bcrypt = require('bcrypt');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// Middleware: Only Admin can manage branches
const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
    next();
};

// 1. GET /api/branches - List all branches
router.get('/branches', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;
    try {
        // We still use the 'staff_users' table, but we treat them as branches
        const query = 'SELECT user_id, username, name, role, created_at FROM staff_users ORDER BY created_at DESC';
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ error: 'Failed to fetch branch list.' });
    }
});

// 2. POST /api/branches - Create a new Branch Login
router.post('/branches', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;
    const { username, password, name, role } = req.body;

    if (!username || !password || !name) {
        return res.status(400).json({ error: 'Username, password, and branch name are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const userRole = role || 'branch';

        const query = `
            INSERT INTO staff_users (username, password_hash, name, role)
            VALUES ($1, $2, $3, $4)
            RETURNING user_id, username, name, role, created_at;
        `;
        
        const { rows } = await pool.query(query, [username, hashedPassword, name, userRole]);
        res.status(201).json(rows[0]);

    } catch (error) {
        if (error.code === '23505') { 
            return res.status(409).json({ error: 'Branch ID (username) already exists.' });
        }
        console.error('Error creating branch:', error);
        res.status(500).json({ error: 'Failed to create new branch.' });
    }
});

// 3. DELETE /api/branches/:id - Remove a Branch
router.delete('/branches/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    if (parseInt(id) === req.user.userId) {
        return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    try {
        const query = 'DELETE FROM staff_users WHERE user_id = $1';
        const result = await pool.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Branch not found.' });
        }
        res.json({ message: 'Branch deleted successfully.' });

    } catch (error) {
        console.error('Error deleting branch:', error);
        res.status(500).json({ error: 'Failed to delete branch.' });
    }
});

module.exports = router;