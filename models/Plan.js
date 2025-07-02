// backend/models/Plan.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const planSchema = new Schema({
  name: { type: String, required: true, trim: true },
  targetSteps: { type: Number, required: true },
  rewardCoins: { type: Number, required: true },
  description: { type: String, default: '' },

  // — NEW FIELDS —
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Easy'
  },
  timeLimitHours: { type: Number, required: true, default: 1 },
  timeLimitMinutes: { type: Number, required: true, default: 0, min: 0, max: 59 },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
