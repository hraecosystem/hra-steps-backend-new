// backend/utils/tokenUtil.js
const jwt = require('jsonwebtoken');
const config = require('../config/config');

module.exports.generateAccessToken = (payload) =>
  jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn,
  });

module.exports.generateRefreshToken = (payload) =>
  jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

module.exports.verifyAccessToken = (token) =>
  jwt.verify(token, config.jwt.secret);

module.exports.verifyRefreshToken = (token) =>
  jwt.verify(token, config.jwt.secret);


