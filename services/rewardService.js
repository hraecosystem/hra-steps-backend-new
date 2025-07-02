// backend/services/rewardService.js
const User = require('../models/User');
const Plan = require('../models/Plan');
const StepRecord = require('../models/StepRecord');

/**
 * Checks if a user has completed their current challenge,
 * awards coins if so, and returns a result object.
 */
module.exports.checkAndAward = async (userId, date) => {
  const user = await User.findById(userId);
  if (!user.currentChallengeId) return null;

  const plan = await Plan.findById(user.currentChallengeId);
  if (!plan) return null;

  // fetch today's record
  const record = await StepRecord.findOne({ userId, date });
  const steps = record ? record.stepCount : 0;

  if (steps >= plan.targetSteps) {
    user.coinBalance += plan.rewardCoins;
       // ── increment completedChallenges
   user.completedChallenges = (user.completedChallenges || 0) + 1;
    user.currentChallengeId = null;
    user.currentChallengeProgress = 0;
    await user.save();
    return {
      awarded: true,
      rewardCoins: plan.rewardCoins,
      newBalance: user.coinBalance,
    };
  }

  // update progress
  user.currentChallengeProgress = steps;
  await user.save();
  return { awarded: false, progress: steps };
};
