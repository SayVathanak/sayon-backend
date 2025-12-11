-- schema.sql (Run this script on your Neon PostgreSQL database)

-- 1. Categories Table (Products belong to a Category)
CREATE TABLE IF NOT EXISTS categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

-- 2. Products Table (The items available for sale)
CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    -- Foreign Key: Links product to its category
    category_id INT NOT NULL REFERENCES categories(category_id), 
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    image_url VARCHAR(255)
);

-- 3. Staff Users Table (For login and security)
CREATE TABLE IF NOT EXISTS staff_users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'cashier'
);

-- 4. Orders Table (The main transaction record)
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    order_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'KHQR',
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    staff_name VARCHAR(100)
);

-- 5. Order Items Table (Detailing what was sold in an order)
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id SERIAL PRIMARY KEY,
    -- Foreign Key: Links item detail back to the main order record
    order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE, 
    -- Foreign Key: Links item detail back to the product catalog
    product_id INT NOT NULL REFERENCES products(product_id), 
    quantity INT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    item_total NUMERIC(10, 2) NOT NULL,
    notes TEXT
);