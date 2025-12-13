// sayon-backend/routes/stats.js
const express = require('express');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// Middleware
const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
    next();
};

// --- HELPER: Build Date & Branch Filters ---
// UPDATED: Now accepts the entire query object to check for start/end dates
const buildFilters = (query) => {
    const { period, branch_id, start_date, end_date } = query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // 1. Date Filter
    if (period === 'today') {
        whereClause += ` AND order_date >= CURRENT_DATE`;
    } else if (period === 'week') {
        whereClause += ` AND order_date >= NOW() - INTERVAL '1 WEEK'`;
    } else if (period === 'month') {
        whereClause += ` AND order_date >= NOW() - INTERVAL '1 MONTH'`;
    } else if (period === 'custom' && start_date && end_date) {
        // --- NEW CUSTOM LOGIC ---
        // We add two parameters: Start Date and End Date
        whereClause += ` AND order_date >= $${paramIndex}`;
        params.push(start_date);
        paramIndex++;

        whereClause += ` AND order_date <= $${paramIndex}`;
        params.push(end_date);
        paramIndex++;
    }

    // 2. Branch Filter
    if (branch_id && branch_id !== 'all') {
        whereClause += ` AND user_id = $${paramIndex}`;
        params.push(branch_id);
        paramIndex++;
    }

    return { whereClause, params, paramIndex };
};

// 1. GET DASHBOARD CARDS (Revenue, Orders)
router.get('/stats', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;

    try {
        // Pass the full req.query so we can see start_date/end_date
        const { whereClause, params } = buildFilters(req.query);

        const query = `
            SELECT 
                COALESCE(SUM(total_amount), 0) AS total_revenue,
                COUNT(*) AS total_orders
            FROM orders
            ${whereClause}
        `;

        const { rows } = await pool.query(query, params);
        
        res.json({
            totalSales: parseFloat(rows[0].total_revenue),
            totalOrders: parseInt(rows[0].total_orders)
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to load stats.' });
    }
});

// 2. GET SALES REPORT (Table)
router.get('/stats/sales-report', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;
    const { period, branch_id, start_date, end_date } = req.query;

    try {
        // We have to build the filter manually here because of the JOIN aliases (o.order_date, o.user_id)
        let dateFilter = '';
        const params = [];
        let paramIndex = 1;

        if (period === 'today') {
            dateFilter = `AND o.order_date >= CURRENT_DATE`;
        } else if (period === 'week') {
            dateFilter = `AND o.order_date >= NOW() - INTERVAL '1 WEEK'`;
        } else if (period === 'month') {
            dateFilter = `AND o.order_date >= NOW() - INTERVAL '1 MONTH'`;
        } else if (period === 'custom' && start_date && end_date) {
            // Custom Range for Joined Table
            dateFilter = `AND o.order_date >= $${paramIndex} AND o.order_date <= $${paramIndex + 1}`;
            params.push(start_date);
            params.push(end_date);
            paramIndex += 2;
        }

        let branchFilter = '';
        if (branch_id && branch_id !== 'all') {
            branchFilter = `AND o.user_id = $${paramIndex}`;
            params.push(branch_id);
        }

        const query = `
            SELECT 
                p.name as product_name,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.item_total) as total_revenue
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            JOIN products p ON oi.product_id = p.product_id
            WHERE 1=1 
            ${dateFilter}
            ${branchFilter}
            GROUP BY p.name
            ORDER BY total_quantity DESC
            LIMIT 10
        `;

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error sales report:', error);
        res.status(500).json({ error: 'Failed to load report.' });
    }
});

// 3. GET BRANCH PERFORMANCE (Leaderboard)
router.get('/stats/branches', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;
    const { period, branch_id, start_date, end_date } = req.query;

    try {
        let dateFilter = '';
        const params = [];
        let paramIndex = 1;

        if (period === 'today') {
            dateFilter = `AND o.order_date >= CURRENT_DATE`;
        } else if (period === 'week') {
            dateFilter = `AND o.order_date >= NOW() - INTERVAL '1 WEEK'`;
        } else if (period === 'month') {
            dateFilter = `AND o.order_date >= NOW() - INTERVAL '1 MONTH'`;
        } else if (period === 'custom' && start_date && end_date) {
            // Custom Range for Joined Table
            dateFilter = `AND o.order_date >= $${paramIndex} AND o.order_date <= $${paramIndex + 1}`;
            params.push(start_date);
            params.push(end_date);
            paramIndex += 2;
        }

        let branchWhere = "WHERE u.role != 'admin'"; 

        if (branch_id && branch_id !== 'all') {
            branchWhere += ` AND u.user_id = $${paramIndex}`;
            params.push(branch_id);
        }

        const query = `
            SELECT 
                u.name AS branch_name, 
                COUNT(o.order_id) AS total_orders, 
                COALESCE(SUM(o.total_amount), 0) AS total_revenue
            FROM staff_users u
            LEFT JOIN orders o ON u.user_id = o.user_id ${dateFilter}
            ${branchWhere}
            GROUP BY u.user_id, u.name
            ORDER BY total_revenue DESC;
        `;

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error branch stats:', error);
        res.status(500).json({ error: 'Failed to load branch list.' });
    }
});

module.exports = router;