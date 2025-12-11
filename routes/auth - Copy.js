// sayon-backend/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// Helper to setup default users (Runs on server start)
async function setupDefaultUser(pool) {
    try {
        console.log("🔄 Checking default users...");

        // 1. Setup Default Cashier (Password: pos-secure-password)
        const cashierPass = await bcrypt.hash('pos-secure-password', 10);
        await pool.query(`
            INSERT INTO staff_users (username, password_hash, name, role) 
            VALUES ($1, $2, $3, $4) 
            ON CONFLICT (username) DO NOTHING
        `, ['cashier1', cashierPass, 'Store Cashier', 'cashier']);

        // 2. Setup Admin (st230) (Password: 123456)
        // We use "DO UPDATE" here. This fixes your issue by overwriting the old bad hash 
        // with the new correct hash for '123456'.
        const adminPass = await bcrypt.hash('123456', 10);
        await pool.query(`
            INSERT INTO staff_users (username, password_hash, name, role) 
            VALUES ($1, $2, $3, $4) 
            ON CONFLICT (username) 
            DO UPDATE SET password_hash = $2, role = $4
        `, ['st230', adminPass, 'Sayon St 230', 'admin']);

        console.log('✅ User Setup Complete: Log in as "st230" with password "123456"');
        
    } catch (err) {
        console.error("❌ Error setting up default users:", err);
    }
}


// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Get the pool connection from the Express application local storage
    const pool = req.app.locals.pool; 

    try {
        // 1. Select the user AND their role from the database
        const userRes = await pool.query(
            'SELECT user_id, password_hash, name, role FROM staff_users WHERE username = $1', 
            [username]
        );
        const user = userRes.rows[0];

        if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

        // 2. Compare the provided password with the hash in the DB
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

        // 3. Create JWT Payload (Include the role!)
        const payload = { userId: user.user_id, name: user.name, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

        // 4. Send response (Include user info so frontend knows where to redirect)
        return res.json({ 
            token: token, 
            user: { id: user.user_id, name: user.name, role: user.role } 
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

module.exports = { 
    router, // Export the router
    setupDefaultUser // Export the setup function
};