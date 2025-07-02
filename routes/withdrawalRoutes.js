// backend/routes/withdrawalRoutes.js
const express = require('express');
const { body, param } = require('express-validator');
const withdrawalController = require('../controllers/withdrawalController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// @route   POST /api/withdrawals
// @desc    Create a new withdrawal request
// @access  Private
router.post(
  '/',
  authMiddleware,
  [
    body('amount')
      .isInt({ min: 1 })
      .withMessage('Amount must be at least 1'),
    body('walletAddress')
      .notEmpty()
      .withMessage('Wallet address is required')
      .trim(),
  ],
  withdrawalController.createRequest
);

// @route   GET /api/withdrawals
// @desc    Get all requests for current user
// @access  Private
router.get('/', authMiddleware, withdrawalController.getUserRequests);

// Admin-only routes
router.get(
  '/all',
  authMiddleware,
  (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  },
  withdrawalController.getAllRequests
);

router.put(
  '/:id',
  authMiddleware,
  (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  },
  [
    param('id').isMongoId().withMessage('Invalid request ID'),
    body('status')
      .isIn(['Pending', 'Approved', 'Rejected', 'Paid'])
      .withMessage('Invalid status'),
    body('remarks').optional().isString(),
    body('txId').optional().isString(),
  ],
  withdrawalController.updateRequest
);

module.exports = router;
