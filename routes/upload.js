// sayon-backend/routes/upload.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Configure Multer (Store file in memory temporarily)
const upload = multer({ storage: multer.memoryStorage() });

// 3. POST /api/upload
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    // 4. Stream the file buffer directly to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
        { 
            folder: 'sayon_products', // The folder name in your Cloudinary console
            resource_type: 'image'
        },
        (error, result) => {
            if (error) {
                console.error('Cloudinary Error:', error);
                return res.status(500).json({ error: 'Image upload failed.' });
            }
            // Success! Return the URL to the frontend
            res.json({ url: result.secure_url });
        }
    );

    // Pipe the file buffer into the upload stream
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
});

module.exports = router;