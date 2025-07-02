// backend/utils/validators.js
const { param, body, query } = require('express-validator');

// Reusable validators
module.exports.validateObjectId = (field) =>
  param(field)
    .isMongoId()
    .withMessage(`${field} must be a valid Mongo ID`);

module.exports.validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Page must be ≥ 1'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
];

module.exports.validateEmail = (field = 'email') =>
  body(field)
    .isEmail()
    .withMessage('Must be a valid email')
    .normalizeEmail();

module.exports.validatePassword = (field = 'password') =>
  body(field)
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters');

module.exports.validateRequiredString = (field) =>
  body(field)
    .notEmpty()
    .withMessage(`${field} is required`)
    .trim();
