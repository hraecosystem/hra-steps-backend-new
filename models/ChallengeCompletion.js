// backend/models/ChallengeCompletion.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const challengeCompletionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
  rewardCoins: { type: Number, required: true },
  date: {
    type: Date, default: () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }, index: true
  },
}, { timestamps: true });

module.exports = mongoose.model('ChallengeCompletion', challengeCompletionSchema);
