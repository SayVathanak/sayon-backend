// sayon-backend/routes/menu.js

const express = require('express');
// 💡 NOTE: We no longer import the pool directly to avoid circular dependency
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// GET /api/menu - Requires authentication
router.get('/menu', authenticateToken, async (req, res) => {
    
    // 💡 FIX: Access the pool from app.locals, which was set up in server.js
    const pool = req.app.locals.pool; 
    
    try {
        const query = `
            SELECT
                c.name AS category_name,
                p.product_id,
                p.name AS product_name,
                p.price,
                p.description,
                p.image_url
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            WHERE p.is_available = TRUE
            ORDER BY c.sort_order, p.product_id;
        `;
        
        // This line caused the error when 'pool' was undefined:
        const { rows } = await pool.query(query);

        // Reformat data for easier frontend consumption (Group by category)
        const menu = rows.reduce((acc, row) => {
            const category = row.category_name;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push({
                product_id: row.product_id,
                name: row.product_name,
                price: parseFloat(row.price), // Ensure price is a number
                description: row.description,
                image_url: row.image_url
            });
            return acc;
        }, {});

        res.json(menu);
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ error: 'Failed to fetch menu data' });
    }
});

module.exports = router;