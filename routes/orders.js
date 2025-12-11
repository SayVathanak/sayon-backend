// sayon-backend/routes/orders.js

const express = require('express');
// We do NOT import the pool directly to avoid circular dependency
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// POST /api/orders - Requires authentication and handles order insertion as a transaction
router.post('/orders', authenticateToken, async (req, res) => {
    
    // FIX: Access the pool from app.locals, which was set up in server.js
    const pool = req.app.locals.pool; 
    
    const staffName = req.user.name || 'Unknown Cashier';
    const { total_amount, items } = req.body; 
    
    // Get a client for transaction (requires the working pool object)
    const client = await pool.connect(); 

    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Insert into orders table
        const orderInsertText = `
            INSERT INTO orders (total_amount, payment_method, staff_name)
            VALUES ($1, $2, $3)
            RETURNING order_id, order_date;
        `;
        const orderRes = await client.query(orderInsertText, [total_amount, 'KHQR', staffName]);
        const { order_id, order_date } = orderRes.rows[0];

        // 2. Insert into order_items table for each item
        const itemInsertText = `
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, item_total, notes)
            VALUES ($1, $2, $3, $4, $5, $6);
        `;

        for (const item of items) {
            await client.query(itemInsertText, [
                order_id,
                item.product_id,
                item.quantity,
                item.unit_price,
                // Ensure item_total is calculated correctly on the server side
                item.quantity * item.unit_price, 
                item.notes || null
            ]);
        }

        await client.query('COMMIT'); // Commit transaction
        res.status(201).json({ 
            message: 'Order submitted successfully.', 
            order_id: order_id,
            order_date: order_date
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Order submission failed (ROLLBACK executed):', error);
        res.status(500).json({ error: 'Failed to submit order due to a system error.' });
    } finally {
        client.release(); // Release the client back to the pool
    }
});

module.exports = router;