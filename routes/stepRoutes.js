// backend/routes/stepRoutes.js
const express = require('express');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const stepController = require('../controllers/stepController');

const router = express.Router();

// Add/update steps & award challenges
router.post(
  '/',
  [
    body('date').isISO8601().withMessage('Date must be ISO8601'),
    body('stepCount').isInt({ min: 0 }).withMessage('Step count must be >= 0'),
  ],
  stepController.addSteps
);

// DAILY SUMMARY (new)
router.get('/summary', authMiddleware, stepController.getSummary);

// 7-day history for chart (enhanced)
router.get('/history', authMiddleware, stepController.getHistory);

// Top steppers (unchanged)
router.get('/top', authMiddleware, stepController.getTopSteppers);


// ✨ NEW SUMMARY ENDPOINT ✨
router.get(
  '/summary',
  authMiddleware,
  stepController.getSummary
);

// ✨ NEW WEEKLY SUMMARY ENDPOINT ✨
router.get(
  '/weekly-summary',
  authMiddleware,
  stepController.getWeeklySummary
);

module.exports = router;
