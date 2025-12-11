// sayon-backend/routes/stats.js
const express = require('express');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// Middleware to ensure only admin can see stats
const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
    next();
};

router.get('/stats', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;

    try {
        // 1. Calculate Total Revenue (Sum of all orders)
        // COALESCE(..., 0) ensures we return 0 instead of null if table is empty
        const revenueQuery = `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue FROM orders`;
        
        // 2. Count Total Orders
        const ordersQuery = `SELECT COUNT(*) AS total_orders FROM orders`;
        
        // 3. Find Top Selling Product
        // Joins order_items with products, sums quantity, and picks the top 1
        const topProductQuery = `
            SELECT p.name, SUM(oi.quantity) as total_sold 
            FROM order_items oi 
            JOIN products p ON oi.product_id = p.product_id 
            GROUP BY p.name 
            ORDER BY total_sold DESC 
            LIMIT 1
        `;

        // Execute all queries in parallel for speed
        const [revenueRes, ordersRes, topProductRes] = await Promise.all([
            pool.query(revenueQuery),
            pool.query(ordersQuery),
            pool.query(topProductQuery)
        ]);

        const stats = {
            totalSales: parseFloat(revenueRes.rows[0].total_revenue),
            totalOrders: parseInt(ordersRes.rows[0].total_orders),
            topProduct: topProductRes.rows.length > 0 ? topProductRes.rows[0].name : 'N/A'
        };

        res.json(stats);

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to load dashboard stats.' });
    }
});

router.get('/stats/branches', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;

    try {
        // This query joins Orders with Staff (Branches) and groups the results
        const query = `
            SELECT 
                u.name AS branch_name, 
                COUNT(o.order_id) AS total_orders, 
                COALESCE(SUM(o.total_amount), 0) AS total_revenue
            FROM staff_users u
            LEFT JOIN orders o ON u.user_id = o.user_id
            WHERE u.role != 'admin'  -- We don't want to compare the Admin account
            GROUP BY u.user_id, u.name
            ORDER BY total_revenue DESC;
        `;

        const { rows } = await pool.query(query);
        res.json(rows);

    } catch (error) {
        console.error('Error fetching branch stats:', error);
        res.status(500).json({ error: 'Failed to load branch leaderboard.' });
    }
});

module.exports = router;