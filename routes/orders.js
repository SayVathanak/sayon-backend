// sayon-backend/routes/orders.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

// POST /api/orders
router.post('/orders', authenticateToken, async (req, res) => {
    const pool = req.app.locals.pool;
    const { items, total } = req.body;

    console.log('📦 Received order:', { items, total }); // Debug log

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

        // 2. Insert Items with proper validation
        const itemInsertText = 'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)';
        
        for (const item of items) {
            // Extract the numeric product_id (handles both regular and customized products)
            let productId;
            
            if (typeof item.product_id === 'number') {
                productId = item.product_id;
            } else if (typeof item.product_id === 'string') {
                // Try to parse as integer first
                productId = parseInt(item.product_id);
                
                // If that fails, try to extract the number from strings like "7-50%, Normal"
                if (isNaN(productId)) {
                    const match = item.product_id.match(/^(\d+)/);
                    productId = match ? parseInt(match[1]) : null;
                }
            }

            if (!productId || isNaN(productId)) {
                throw new Error(`Invalid product_id: ${item.product_id}`);
            }

            console.log(`✅ Inserting item: product_id=${productId}, qty=${item.quantity}, price=${item.price}`);

            await client.query(itemInsertText, [
                orderId, 
                productId,
                item.quantity, 
                parseFloat(item.price)
            ]);
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Order created',
            orderId: orderId,
            orderDate: orderDate
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Order Error:', error);
        res.status(500).json({ 
            message: 'Failed to create order.',
            error: error.message 
        });
    } finally {
        client.release();
    }
});

module.exports = router;