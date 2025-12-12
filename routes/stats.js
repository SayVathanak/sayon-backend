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
        const revenueQuery = `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue FROM orders`;
        
        // 2. Count Total Orders
        const ordersQuery = `SELECT COUNT(*) AS total_orders FROM orders`;
        
        // 3. Find Top Selling Product
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
        const query = `
            SELECT 
                u.name AS branch_name, 
                COUNT(o.order_id) AS total_orders, 
                COALESCE(SUM(o.total_amount), 0) AS total_revenue
            FROM staff_users u
            LEFT JOIN orders o ON u.user_id = o.user_id
            WHERE u.role != 'admin'  
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

router.get('/stats/sales-report', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;
    const { period, branch_id } = req.query;

    try {
        let dateFilter = '';
        const params = [];
        let paramIndex = 1;

        // 1. Determine Date Range
        if (period === 'today') {
            // 💡 FIX: Changed 'created_at' to 'order_date'
            dateFilter = `AND o.order_date >= CURRENT_DATE`;
        } else if (period === 'week') {
            dateFilter = `AND o.order_date >= NOW() - INTERVAL '1 WEEK'`;
        } else if (period === 'month') {
            dateFilter = `AND o.order_date >= NOW() - INTERVAL '1 MONTH'`;
        }

        // 2. Determine Branch Filter
        let branchFilter = '';
        if (branch_id && branch_id !== 'all') {
            branchFilter = `AND o.user_id = $${paramIndex}`;
            params.push(branch_id);
            paramIndex++;
        }

        // 3. Query: Join Orders -> Items -> Products
        // 💡 FIX: Changed 'oi.price' to 'p.price' because price is in the products table
        const query = `
            SELECT 
                p.name as product_name,
                SUM(oi.quantity) as total_quantity,
                SUM(p.price * oi.quantity) as total_revenue
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            JOIN products p ON oi.product_id = p.product_id
            WHERE 1=1 
            ${dateFilter}
            ${branchFilter}
            GROUP BY p.name
            ORDER BY total_quantity DESC
        `;

        const { rows } = await pool.query(query, params);
        res.json(rows);

    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.status(500).json({ error: 'Failed to load sales report.' });
    }
});

module.exports = router;