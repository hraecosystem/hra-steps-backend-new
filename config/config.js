// backend/config/config.js
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  mongoURI: process.env.MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.EMAIL_FROM,
  },
  frontendUrl: process.env.FRONTEND_URL,
};

