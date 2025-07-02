// backend/models/WithdrawalRequest.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const withdrawalRequestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true },
  walletAddress: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Paid'],
    default: 'Pending',
    index: true
  },
  txId: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, {
  timestamps: { createdAt: 'requestedAt', updatedAt: 'processedAt' }
});

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
