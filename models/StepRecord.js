// backend/models/StepRecord.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const stepRecordSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true, index: true },
  stepCount: { type: Number, default: 0 },
}, { timestamps: true });

// Ensure one record per user per date
stepRecordSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('StepRecord', stepRecordSchema);
