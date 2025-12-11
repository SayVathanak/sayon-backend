// sayon-backend/routes/orders.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

// POST /api/orders
router.post('/orders', authenticateToken, async (req, res) => {
    const pool = req.app.locals.pool;
    const { items, total } = req.body;

    // 💡 Get Branch ID so analytics work
    const userId = req.user.userId;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'No items in order.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Insert Order
        const orderRes = await client.query(
            'INSERT INTO orders (user_id, total_amount) VALUES ($1, $2) RETURNING order_id, order_date',
            [userId, total]
        );
        const orderId = orderRes.rows[0].order_id;
        const orderDate = orderRes.rows[0].order_date;

        // 2. Insert Items
        const itemInsertText = 'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)';
        for (const item of items) {
            await client.query(itemInsertText, [orderId, item.product_id, item.quantity, item.price]);
        }

        await client.query('COMMIT');

        // 3. Success Response (No Telegram alert)
        res.status(201).json({
            message: 'Order created',
            orderId: orderId,
            orderDate: orderDate
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Order Error:', error);
        res.status(500).json({ message: 'Failed to create order.' });
    } finally {
        client.release();
    }
});

module.exports = router;