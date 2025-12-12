const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

// Middleware: Admin Check
const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
    next();
};

// 1. GET ALL CATEGORIES (Public or Protected)
router.get('/categories', authenticateToken, async (req, res) => {
    const pool = req.app.locals.pool;
    try {
        const query = 'SELECT * FROM categories ORDER BY category_id ASC';
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

// 2. CREATE CATEGORY (Admin Only)
router.post('/categories', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: 'Category name is required' });

    try {
        const query = 'INSERT INTO categories (name) VALUES ($1) RETURNING *';
        const result = await pool.query(query, [name]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ error: 'Failed to add category.' });
    }
});

// 3. UPDATE CATEGORY (Admin Only)
router.patch('/categories/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { name } = req.body;

    try {
        const query = 'UPDATE categories SET name = $1 WHERE category_id = $2 RETURNING *';
        const result = await pool.query(query, [name, id]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found' });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category.' });
    }
});

// 4. DELETE CATEGORY (Admin Only)
router.delete('/categories/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    try {
        // Check if products exist in this category first
        const checkQuery = 'SELECT 1 FROM products WHERE category_id = $1 LIMIT 1';
        const checkRes = await pool.query(checkQuery, [id]);

        if (checkRes.rowCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category. It contains products. Please delete or move products first.' 
            });
        }

        const deleteQuery = 'DELETE FROM categories WHERE category_id = $1';
        const result = await pool.query(deleteQuery, [id]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found' });

        res.json({ message: 'Category deleted successfully.' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category.' });
    }
});

module.exports = router;