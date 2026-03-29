// Load environment variables from .env (must be first)
require('dotenv').config();

// Some Windows/ISP DNS setups refuse SRV lookups → "querySrv ECONNREFUSED" with mongodb+srv://
// Tell Node to use public DNS only for this process (optional: fix adapter DNS to 8.8.8.8 instead)
if (
  process.env.MONGO_URI &&
  process.env.MONGO_URI.startsWith('mongodb+srv://')
) {
  require('dns').setServers(['8.8.8.8', '8.8.4.4']);
}

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// Allow requests from other origins (browsers, mobile apps, etc.)
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// Root route — quick health check
app.get('/', (req, res) => {
  res.send('API is running');
});

// Job applications API — base path /api/applications
app.use('/api/applications', require('./routes/applications'));

// Start HTTP immediately so the React app can reach the API even if MongoDB is still connecting.
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    console.error('Fix MONGO_URI in .env and restart. Until then, /api/applications may error.');
  });

app.listen(PORT, () => {
  console.log('Server started successfully');
  console.log(`Listening on http://127.0.0.1:${PORT}`);
});
