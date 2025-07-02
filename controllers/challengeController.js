const mongoose             = require('mongoose');
const ChallengeCompletion  = require('../models/ChallengeCompletion');
const Plan                 = require('../models/Plan');

exports.getUserChallengeHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // pull the last 100 completions for this user
    const history = await ChallengeCompletion.find({ userId })
      .sort({ date: -1 })
      .limit(100)
      .lean()
      .populate('planId', 'targetSteps');       // populate so we know targetSteps

    // reshape to the front-end’s ChallengeHistory interface
    const result = history.map(h => ({
      id:          h._id.toString(),
      date:        h.date.toISOString(),
      targetSteps: h.planId?.targetSteps || 0,
      rewardCoins: h.rewardCoins,
      status:      h.rewardCoins > 0 ? 'Success' : 'Incomplete'
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
};
