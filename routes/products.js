// sayon-backend/routes/products.js
const express = require('express');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

// Middleware to ensure only users with 'admin' role can use these management routes
const authorizeAdmin = (req, res, next) => {
    // req.user is set by authenticateToken middleware
    if (req.user.role !== 'admin') {
        console.warn(`403 FORBIDDEN: User ${req.user.name} (Role: ${req.user.role}) attempted admin access.`);
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
    next();
};

// --- GET All Products (Admin View) ---
router.get('/products', authenticateToken, authorizeAdmin, async (req, res) => {
    // 💡 FIX: Access the pool correctly
    const pool = req.app.locals.pool; 
    try {
        // Fetches all products including categories (similar to menu, but includes unavailable ones)
        const query = `
            SELECT p.*, c.name AS category_name
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            ORDER BY p.product_id;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching all products:', error);
        res.status(500).json({ error: 'Failed to fetch product list.' });
    }
});

// --- Create Product (POST) ---
router.post('/products', authenticateToken, authorizeAdmin, async (req, res) => {
    // 💡 FIX: Access the pool correctly
    const pool = req.app.locals.pool;
    const { category_id, name, description, price, is_available, image_url } = req.body;
    
    try {
        const query = `
            INSERT INTO products (category_id, name, description, price, is_available, image_url)
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *;
        `;
        // Ensure values are passed correctly; default image_url and description to null if not provided
        const result = await pool.query(query, [category_id, name, description || null, price, is_available || true, image_url || null]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'Failed to add product.' });
    }
});

// --- Update Product (PATCH) ---
router.patch('/products/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    // 💡 FIX: Access the pool correctly
    const pool = req.app.locals.pool;
    const id = req.params.id;
    const { category_id, name, description, price, is_available, image_url } = req.body;
    
    // NOTE: Uses COALESCE to update only fields that are provided in the request body
    try {
        const query = `
            UPDATE products SET 
                category_id = COALESCE($1, category_id),
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                price = COALESCE($4, price),
                is_available = COALESCE($5, is_available),
                image_url = COALESCE($6, image_url)
            WHERE product_id = $7
            RETURNING *;
        `;
        const result = await pool.query(query, [category_id, name, description, price, is_available, image_url, id]);
        
        if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found.' });
        
        res.json(result.rows[0]); 
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product.' });
    }
});

// --- Delete Product (DELETE) ---
router.delete('/products/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    // 💡 FIX: Access the pool correctly
    const pool = req.app.locals.pool;
    const id = req.params.id;
    
    try {
        const query = 'DELETE FROM products WHERE product_id = $1;';
        const result = await pool.query(query, [id]);
        
        if (result.rowCount === 0) return res.status(404).json({ message: 'Product not found.' });
        
        res.status(204).send(); // 204 No Content on successful deletion
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product.' });
    }
});

module.exports = router;