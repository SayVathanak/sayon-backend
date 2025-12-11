// sayon-backend/routes/orders.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

// POST /api/orders
router.post('/orders', authenticateToken, async (req, res) => {
    const pool = req.app.locals.pool;
    const { items, total } = req.body;

    console.log('📦 Received order:', JSON.stringify({ items, total }, null, 2));

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

        // 2. Insert Items - USING unit_price instead of price
        const itemInsertText = 'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)';
        
        for (const item of items) {
            // Extract numeric product_id
            let productId;
            
            if (typeof item.product_id === 'number') {
                productId = item.product_id;
            } else if (typeof item.product_id === 'string') {
                productId = parseInt(item.product_id);
                
                if (isNaN(productId)) {
                    const match = item.product_id.match(/^(\d+)/);
                    productId = match ? parseInt(match[1]) : null;
                }
            }

            if (!productId || isNaN(productId)) {
                throw new Error(`Invalid product_id: ${item.product_id}`);
            }

            console.log(`✅ Inserting: product_id=${productId}, qty=${item.quantity}, unit_price=${item.price}`);

            await client.query(itemInsertText, [
                orderId, 
                productId,
                item.quantity, 
                parseFloat(item.price)  // This maps to unit_price column
            ]);
        }

        await client.query('COMMIT');

        console.log(`✅ Order ${orderId} created successfully!`);

        res.status(201).json({
            message: 'Order created',
            orderId: orderId,
            orderDate: orderDate
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Order Error:', error.message);
        res.status(500).json({ 
            message: 'Failed to create order.',
            error: error.message 
        });
    } finally {
        client.release();
    }
});

module.exports = router;