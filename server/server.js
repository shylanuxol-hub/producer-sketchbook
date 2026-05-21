// SERVER.JS - Main Express Server

// Entry point for the backend
// Sets up Express with CORS (so the React frontend on port 3000 can talk to the server on port 3001) and routes for AI chat and audio analysis
// 50mb body limit necessary for sending raw audio data and base64-encoded images to the server

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Load API keys from .env file
const chatRoute = require('./routes/chat');
const analyzeRoute = require('./routes/analyze');

const app = express();

const rateLimit = require('express-rate-limit');

// General API limiter - applies to all routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 50,                   // max 50 requests per window per IP
  standardHeaders: true,     // include rate limit info in response headers
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Stricter limiter just for Claude API calls
const claudeLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1-minute window
  max: 10,              // max 10 AI requests per minute per IP
  message: { error: 'AI request limit reached. Wait a moment and try again.' }
});

// Apply general limiter to all routes
app.use('/api/', apiLimiter);

// Apply stricter limiter specifically to your Claude endpoint(s)
app.post('/api/generate', claudeLimiter, (req, res) => {
  // your existing Claude API call logic
});

// Enable CORS so the React frontend can make requests
app.use(cors());

// Parse JSON request bodies with a 50mb limit
// Default is 100kb which is too small for audio data and images
app.use(express.json({ limit: '50mb' }));

// Mount route handlers
app.use(chatRoute); // /api/chat - AI conversation endpoint
app.use(analyzeRoute); // /api/analyze - Essentia.js audio analysis

// Serve React build in production
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));