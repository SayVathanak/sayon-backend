// sayon-backend/routes/menu.js
const express = require('express');
const router = express.Router();

// GET /api/menu - Public endpoint for POS
router.get('/menu', async (req, res) => {
    const pool = req.app.locals.pool;
    try {
        // 💡 CRITICAL FIX: Make sure 'options' and 'description' are selected!
        const query = `
            SELECT 
                p.product_id, 
                p.name, 
                p.price, 
                p.category_id, 
                p.image_url, 
                p.is_available,
                p.options,      -- <--- This was likely missing
                p.description,
                c.name as category_name
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            WHERE p.is_available = true
            ORDER BY p.category_id, p.product_id
        `;
        
        const { rows } = await pool.query(query);

        // Group by Category for the frontend
        const menu = {};
        rows.forEach(item => {
            if (!menu[item.category_name]) {
                menu[item.category_name] = [];
            }
            menu[item.category_name].push(item);
        });

        res.json(menu);

    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ error: 'Failed to fetch menu.' });
    }
});

module.exports = router;