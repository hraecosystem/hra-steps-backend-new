const express       = require('express');
const { body }      = require('express-validator');
const authMiddleware= require('../middleware/authMiddleware');
const userController= require('../controllers/userController');
const router        = express.Router();

// All routes here require authentication
router.use(authMiddleware);

// Fetch profile & dashboard
router.get('/profile',        userController.getProfile);
router.get('/dashboard',      userController.getDashboard);
router.get('/challenge-status', userController.getChallengeStatus);

// Challenge management
router.delete('/challenge',   userController.clearChallenge);

// Update personal info / password / settings
router.put(
  '/profile',
  [
    // names & phone
    body('firstName').optional().isString().trim().notEmpty(),
    body('lastName').optional().isString().trim().notEmpty(),
    body('phone').optional().isString().trim().notEmpty(),
    // password (6+ chars)
    body('password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    // settings
    body('settings.units')
      .optional()
      .isIn(['KM','MI'])
      .withMessage('Units must be KM or MI'),
    body('settings.pushNotifications').optional().isBoolean(),
    body('settings.dailyReminder').optional().isBoolean(),
    body('settings.language').optional().isString(),
  ],
  userController.updateProfile
);



// **new** change-password endpoint
router.put(
  '/password',
  [
    body('currentPassword').isLength({ min: 1 }).withMessage('Current password required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be 6+ chars'),
  ],
  userController.changePassword
);

// Delete account
router.delete('/', userController.deleteAccount);


router.post('/avatar', userController.uploadAvatar);


module.exports = router;
