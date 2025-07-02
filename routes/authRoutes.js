// backend/routes/authRoutes.js
const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const router = express.Router();



// Step 1: request OTP
router.post(
  '/register/request-otp',
  [
    body('firstName').notEmpty().withMessage('First name required').trim(),
    body('lastName').notEmpty().withMessage('Last name required').trim(),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('phone').notEmpty().withMessage('Phone required').trim(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password at least 6 chars'),
  ],
  authController.requestRegisterOtp
)

// Step 2: verify OTP & finalize
router.post(
  '/register/verify',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('6-digit code'),
  ],
  authController.verifyRegisterOtp
)


// @route   POST /api/auth/login
// @desc    Log in a user
// @access  Public
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  authController.login
);

// @route   POST /api/auth/refresh
// @desc    Refresh JWT tokens
// @access  Public
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  authController.refreshToken
);

// // Request password reset email
// router.post(
//   '/forgot-password',
//   [ body('email').isEmail().withMessage('Valid email is required').normalizeEmail() ],
//   authController.forgotPassword
// );

// // Actually change the password using the token
// router.post(
//   '/reset-password',
//   [
//     body('token').notEmpty().withMessage('Reset token is required'),
//     body('password')
//       .isLength({ min: 6 })
//       .withMessage('Password must be at least 6 characters'),
//   ],
//   authController.resetPassword
// );



 // 1) Request a one-time password reset OTP (5min expiry, max 5 attempts)
 router.post(
   '/request-otp',
   [ body('email').isEmail().withMessage('Valid email is required').normalizeEmail() ],
   authController.requestOtp
 );

 // 2) Verify OTP + set new password
 router.post(
   '/verify-otp',
   [
     body('email').isEmail(),
     body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
     body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 chars'),
   ],
   authController.verifyOtpAndReset
 );

module.exports = router;
