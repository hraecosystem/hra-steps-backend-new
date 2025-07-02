// backend/config/database.js
const mongoose = require('mongoose');
const { mongoURI } = require('./config');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    // No need for useNewUrlParser/useUnifiedTopology in Mongoose 6+
    await mongoose.connect(mongoURI);
    logger.info('✅ MongoDB connected');
  } catch (err) {
    logger.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
