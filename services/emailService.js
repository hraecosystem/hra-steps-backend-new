// backend/services/emailService.js
const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465,
  auth: config.email.auth,
});

module.exports.sendPasswordReset = async (to, resetToken) => {
  const resetLink = `${config.frontendUrl}?token=${resetToken}`;
  const mailOptions = {
    from: config.email.from,
    to,
    subject: 'Password Reset Request',
    html: `
      <p>You requested a password reset.</p>
      <p>Click <a href="${resetLink}">here</a> to set a new password.</p>
      <p>If you didn’t request this, you can ignore this email.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`🔔 Password reset email sent to ${to}`);
  } catch (err) {
    logger.error('Failed to send password reset email:', err);
    throw new Error('Email delivery failed');
  }
};

module.exports.sendOtp = async (to, otp) => {
  const mailOptions = {
    from: config.email.from,
    to,
    subject: 'Your HRA App reset OTP',
    html: `<p>Your one-time code is <b>${otp}</b> – it expires in 5 minutes.</p>`,
  };
  await transporter.sendMail(mailOptions);
};
