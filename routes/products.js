// sayon-backend/routes/products.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

// Middleware to ensure only admin can modify products
const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
    next();
};

// 1. GET ALL PRODUCTS (Public - available to Admin & Branches)
router.get('/products', authenticateToken, async (req, res) => {
    const pool = req.app.locals.pool;
    try {
        // Join with categories to get the category name
        const query = `
            SELECT p.*, c.name as category_name 
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            ORDER BY p.product_id DESC
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products.' });
    }
});

// 2. CREATE PRODUCT (Admin Only)
router.post('/products', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;

    // 💡 FIX: Destructure ALL fields, including cost_price and stock_quantity
    const {
        category_id,
        name,
        description,
        price,
        cost_price,
        stock_quantity,
        is_available,
        image_url,
        options
    } = req.body;

    try {
        const query = `
            INSERT INTO products 
            (category_id, name, description, price, cost_price, stock_quantity, is_available, image_url, options)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING *;
        `;

        const result = await pool.query(query, [
            category_id,
            name,
            description || '',
            price,
            cost_price || 0.00,     // Default to 0 if missing
            stock_quantity || 0,    // Default to 0 if missing
            is_available ?? true,   // Default to true (using ?? handles 'false' correctly)
            image_url || null,
            JSON.stringify(options || []) // Ensure options is JSON
        ]);

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'Failed to add product.' });
    }
});

// 3. UPDATE PRODUCT (Admin Only)
router.patch('/products/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;
    const id = req.params.id;

    // 💡 FIX: Destructure here too
    const {
        category_id,
        name,
        description,
        price,
        cost_price,
        stock_quantity,
        is_available,
        image_url,
        options
    } = req.body;

    try {
        const query = `
            UPDATE products SET 
                category_id = COALESCE($1, category_id),
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                price = COALESCE($4, price),
                cost_price = COALESCE($5, cost_price),
                stock_quantity = COALESCE($6, stock_quantity),
                is_available = COALESCE($7, is_available),
                image_url = COALESCE($8, image_url),
                options = COALESCE($9, options)
            WHERE product_id = $10
            RETURNING *;
        `;

        const result = await pool.query(query, [
            category_id,
            name,
            description,
            price,
            cost_price,
            stock_quantity,
            is_available,
            image_url,
            options ? JSON.stringify(options) : null, // Handle JSON conversion
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product.' });
    }
});

// 4. DELETE PRODUCT (Admin Only)
router.delete('/products/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    try {
        // First delete related order_items to avoid Foreign Key constraint errors
        // (Optional: Depends on if you want to keep sales history. 
        //  Better practice is to just set is_available = false instead of delete)
        // For now, we allow delete but handle the constraint:

        // Check if product is used in orders
        const checkQuery = 'SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1';
        const checkRes = await pool.query(checkQuery, [id]);

        if (checkRes.rowCount > 0) {
            // If sold before, don't actually delete it, just hide it
            // This prevents breaking your sales history reports
            const softDeleteQuery = 'UPDATE products SET is_available = false WHERE product_id = $1';
            await pool.query(softDeleteQuery, [id]);
            return res.json({ message: 'Product has sales history. It was hidden instead of deleted.' });
        }

        // If never sold, safe to delete
        const deleteQuery = 'DELETE FROM products WHERE product_id = $1';
        const result = await pool.query(deleteQuery, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        res.json({ message: 'Product deleted successfully.' });

    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product.' });
    }
});

module.exports = router;