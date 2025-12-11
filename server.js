// sayon-backend/server.js
const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. Database Connection Pool Setup ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Use SSL only in production (Render/Neon)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 💡 Attach the pool to the app object for access in routes
app.locals.pool = pool; 

// Test connection on server start
pool.query('SELECT NOW()')
  .then(res => console.log('✅ Database connected successfully at:', res.rows[0].now))
  .catch(err => console.error('❌ Database connection error:', err.stack));


// --- 2. Middleware setup (Secure CORS) ---
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json()); // To parse JSON bodies


// --- 3. Route Imports ---
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');
const productsRoutes = require('./routes/products');
const statsRoutes = require('./routes/stats');
const branchesRoutes = require('./routes/branches');
const uploadRoutes = require('./routes/upload');
const { router: authRoutes, setupDefaultUser } = require('./routes/auth'); 

app.use('/api', menuRoutes);
app.use('/api', orderRoutes);
app.use('/api', productsRoutes);
app.use('/api', statsRoutes);
app.use('/api', branchesRoutes);
app.use('/api', uploadRoutes);
app.use('/api/auth', authRoutes);


// --- 4. Server Start ---
app.get('/', (req, res) => {
  res.send('POS Backend API is running.');
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  // 💡 Call setup function AFTER pool initialization, passing the pool object
  setupDefaultUser(pool);
});

module.exports = { pool };