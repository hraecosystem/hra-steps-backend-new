// backend/middleware/errorHandler.js
const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  // always log full stack to console & file
  console.error('❌ Error:', err.stack || err);
  logger.error('%s', err.stack || err);

  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal Server Error',
  });
};

