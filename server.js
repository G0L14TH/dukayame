const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;


// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// routes
app.use('/api/products', require('./routes/products'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/download', require('./routes/download'));
app.use('/api/transaction', require('./routes/transaction'));
app.use('/api/recovery', require('./routes/recovery'));

// home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// initialize database and start server
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 M-Pesa Environment: ${process.env.MPESA_ENVIRONMENT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
