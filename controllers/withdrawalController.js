// backend/controllers/withdrawalController.js
const WithdrawalRequest = require('../models/WithdrawalRequest');
const User = require('../models/User');

exports.createRequest = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { amount, walletAddress } = req.body;

    // Validate
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid withdrawal amount' });
    }
    const user = await User.findById(userId);
    if (user.coinBalance < amount) {
      return res.status(400).json({ message: 'Insufficient coin balance' });
    }

    // Ensure no existing pending request
    const exists = await WithdrawalRequest.findOne({ userId, status: 'Pending' });
    if (exists) {
      return res.status(400).json({ message: 'You already have a pending withdrawal' });
    }

    // Create
    const request = await WithdrawalRequest.create({
      userId,
      amount,
      walletAddress
    });

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
};

exports.getUserRequests = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const requests = await WithdrawalRequest
      .find({ userId })
      .sort({ requestedAt: -1 });
    res.json(requests);
  } catch (err) {
    next(err);
  }
};

// Admin endpoints
exports.getAllRequests = async (req, res, next) => {
  try {
    const requests = await WithdrawalRequest
      .find()
      .populate('userId', 'firstName lastName email')
      .sort({ requestedAt: -1 });
    res.json(requests);
  } catch (err) {
    next(err);
  }
};

exports.updateRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks, txId } = req.body;

    const request = await WithdrawalRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (request.status === 'Paid') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    // If marking as Paid, deduct coins
    if (status === 'Paid') {
      const user = await User.findById(request.userId);
      if (user.coinBalance < request.amount) {
        return res.status(400).json({ message: 'User has insufficient balance' });
      }
      user.coinBalance -= request.amount;
      await user.save();
    }

    // Update request record
    request.status = status;
    if (remarks) request.remarks = remarks;
    if (txId) request.txId = txId;
    await request.save();

    res.json(request);
  } catch (err) {
    next(err);
  }
};
