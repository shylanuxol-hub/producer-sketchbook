// SERVER.JS - Main Express Server

// Entry point for the backend
// Sets up Express with CORS (so the React frontend on port 3000 can talk to the server on port 3001) and routes for AI chat and audio analysis
// 50mb body limit necessary for sending raw audio data and base64-encoded images to the server

const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load API keys from .env file
const chatRoute = require('./routes/chat');
const analyzeRoute = require('./routes/analyze');

const app = express();

// Enable CORS so the React frontend can make requests
app.use(cors());

// Parse JSON request bodies with a 50mb limit
// Default is 100kb which is too small for audio data and images
app.use(express.json({ limit: '50mb' }));

// Mount route handlers
app.use(chatRoute); // /api/chat — AI conversation endpoint
app.use(analyzeRoute); // /api/analyze — Essentia.js audio analysis

app.listen(3001, () => console.log('Server running on 3001'));