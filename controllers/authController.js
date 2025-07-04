// backend/controllers/authController.js
const bcrypt           = require('bcrypt');
const crypto           = require('crypto');
const User             = require('../models/User');
const { validationResult } = require('express-validator');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/tokenUtil');
const emailService     = require('../services/emailService');


exports.register = async (req, res, next) => {
  try {
    // 1. Validate input (routes should run express-validator checks first)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, phone, password } = req.body;

    // 2. Check for existing email/phone
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    if (await User.findOne({ phone })) {
      return res.status(400).json({ message: 'Phone number already in use' });
    }

    // 3. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Create user
    const user = new User({ firstName, lastName, email, phone, passwordHash });
    await user.save();

    // 5. Generate JWTs

    const accessToken  = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id, role: user.role });


    // 6. Respond
    res.status(201).json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (err) {
    next(err);
  }
};



exports.login = async (req, res, next) => {
  try {
    // 1. Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 2. Verify password
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 3. Issue tokens
    const accessToken  = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id, role: user.role });

    res.json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (err) {
    next(err);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    // Verify and decode the refresh token:
    const payload = verifyRefreshToken(refreshToken);
    // payload now has { userId, role, iat, exp }

    // Issue brand-new tokens
    const newAccessToken  = generateAccessToken({ userId: payload.userId, role: payload.role });
    const newRefreshToken = generateRefreshToken({ userId: payload.userId, role: payload.role });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    // If verifyRefreshToken threw, it was invalid or expired:
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};



/**
 * `POST /api/auth/forgot-password`
 * { email }
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    // always respond 200 so we don’t reveal account existence
    if (!user) return res.json({ message: 'If that email exists, a link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken   = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1h
    await user.save();

    await emailService.sendPasswordReset(user.email, token);
    res.json({ message: 'If that email exists, a link has been sent.' });
  } catch (err) {
    next(err);
  }
};

/**
 * `POST /api/auth/reset-password`
 * { token, password }
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      resetPasswordToken:   token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    user.passwordHash         = await bcrypt.hash(password, 10);
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset. You may now log in.' });
  } catch (err) {
    next(err);
  }
};



/**
 * POST /api/auth/request-otp
 * { email }
 */
exports.requestOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    // Always return 200
    if (!user) return res.json({ message: 'If that email exists, you will receive an OTP.' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode      = otp;
    user.otpExpiresAt = Date.now() + 5 * 60 * 1000;   // 5 minutes
    user.otpAttempts  = 0;
    await user.save();

    // send via your emailService
    await emailService.sendOtp(user.email, otp);
    res.json({ message: 'If that email exists, you will receive an OTP.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-otp
 * { email, otp, newPassword }
 */
exports.verifyOtpAndReset = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or OTP.' });

    // check expiry
    if (!user.otpCode || user.otpExpiresAt < Date.now())
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });

    // check attempts
    if (user.otpAttempts >= 5)
      return res.status(429).json({ message: 'Too many attempts. Request a new OTP.' });

    // verify

    if (+user.otpCode !== +otp) {
      user.otpAttempts++;
      await user.save();
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    // success — reset password
    user.passwordHash         = await bcrypt.hash(newPassword, 10);
    user.otpCode              = undefined;
    user.otpExpiresAt         = undefined;
    user.otpAttempts          = 0;
    await user.save();

    res.json({ message: 'Password has been reset. You may now log in.' });
  } catch (err) {
    next(err);
  }
};


// 1) POST /api/auth/register/request-otp
exports.requestRegisterOtp = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body
    // check duplicates
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email already in use' })
    }
    if (await User.findOne({ phone })) {
      return res.status(400).json({ message: 'Phone number already in use' })
    }
    // hash & temp‐save
    const passwordHash = await bcrypt.hash(password, 10)
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const user = new User({
      firstName, lastName, email, phone,
      passwordHash,
      otpCode: otp,
      otpExpiresAt: Date.now() + 5 * 60 * 1000,   // 5m
      otpAttempts: 0,
    })
    await user.save()
    await emailService.sendOtp(email, otp)
    res.json({ message: 'Verification code sent to your email.' })
  } catch (err) {
    next(err)
  }
}

// 2) POST /api/auth/register/verify
exports.verifyRegisterOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or code.' })
    }
    if (!user.otpCode || user.otpExpiresAt < Date.now()) {
      return res.status(400).json({ message: 'Code expired. Please sign up again.' })
    }
    if (user.otpAttempts >= 5) {
      return res.status(429).json({ message: 'Too many attempts. Try signing up again.' })
    }
    if (user.otpCode !== otp) {
      user.otpAttempts++
      await user.save()
      return res.status(400).json({ message: 'Invalid code.' })
    }

    // success! clear OTP and issue JWTs
    user.otpCode = undefined
    user.otpExpiresAt = undefined
    user.otpAttempts = 0
    await user.save()

    const accessToken  = generateAccessToken({ userId: user._id, role: user.role })
    const refreshToken = generateRefreshToken({ userId: user._id, role: user.role })

    res.status(201).json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      accessToken,
      refreshToken,
    })
  } catch (err) {
    next(err)
  }
}
