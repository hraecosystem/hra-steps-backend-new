// backend/models/User.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  // — Basic identity & auth
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },

  // — Step & challenge tracking
  coinBalance: { type: Number, default: 0 },
  currentChallengeId: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },
  currentChallengeProgress: { type: Number, default: 0 },
  currentChallengeStartedAt: { type: Date, default: null },

  // — Daily join-limit
  selectionsCountDate: { type: Date, default: null },
  selectionsCount: { type: Number, default: 0 },

  // — Role
  role: { type: String, enum: ['user', 'admin'], default: 'user' },

  // — Password reset & OTP
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  otpCode: String,
  otpExpiresAt: Date,
  otpAttempts: { type: Number, default: 0 },

  // — Subscription info (Stripe integration only)
  subscription: {
    stripeCustomerId: { type: String },            // your Stripe Customer ID
    stripeSubscriptionId: { type: String },            // the active subscription ID
    isActive: { type: Boolean, default: false },
    nextBillingDate: { type: Date },              // from Stripe invoice
    monthlyFee: { type: Number },            // e.g. in cents or your smallest unit
    history: [
      {
        invoiceDate: { type: Date },
        amount: { type: Number },
      }
    ],
  },

  // — App settings
  settings: {
    units: { type: String, enum: ['KM', 'MI'], default: 'KM' },
    pushNotifications: { type: Boolean, default: true },
    dailyReminder: { type: Boolean, default: false },
    language: { type: String, default: 'en' },
  },

  // — Contact support info
  contact: {
    email: { type: String, default: 'support@hra-step.com' },
    phone: { type: String, default: '+971505786305' },
    instagram: { type: String, default: 'https://instagram.com/hra-step' },
  },
  completedChallenges: {
    type: Number,
    default: 0,
  },
  avatarUrl: { type: String, default: '' }
},


  {
    timestamps: true,
  });

module.exports = mongoose.model('User', userSchema);
