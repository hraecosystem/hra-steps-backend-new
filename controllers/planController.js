// backend/controllers/planController.js
const Plan = require('../models/Plan');
const User = require('../models/User');

// LIST all active plans
exports.getPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find({ isActive: true })
      .sort({ targetSteps: 1 });
    res.json(plans);
  } catch (err) {
    next(err);
  }
};

// CREATE a new plan (Admin only)
exports.createPlan = async (req, res, next) => {
  try {
    const {
      name, targetSteps, rewardCoins,
      description, difficulty,
      timeLimitHours, timeLimitMinutes,
      isActive
    } = req.body;

    const plan = new Plan({
      name, targetSteps, rewardCoins,
      description, difficulty,
      timeLimitHours, timeLimitMinutes,
      isActive
    });
    await plan.save();
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
};

// READ one plan by ID
exports.getPlanById = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    next(err);
  }
};

// Get active plane 
exports.activePlan = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let currentChallenge = null;
    let stepCount = 0;

    if (user.currentChallengeId) {
      const plan = await Plan.findById(user.currentChallengeId);
      if (plan) {
        const startedAt = user.currentChallengeStartedAt;
        const expiresAt = new Date(
          startedAt.getTime() + plan.timeLimitHours * 3600_000 + plan.timeLimitMinutes * 60_000
        );

        const now = new Date();
        const stepRecords = await StepRecord.find({
          userId: user._id,
          date: { $gte: startedAt, $lte: now }
        });

        stepCount = stepRecords.reduce((sum, rec) => sum + (rec.stepCount || 0), 0);

        currentChallenge = {
          planId: plan._id,
          name: plan.name,
          targetSteps: plan.targetSteps,
          rewardCoins: plan.rewardCoins,
          progress: stepCount,
          startedAt,
          expiresAt,
        };
      }
    }

    res.json({
      profile: user,
      stepCount,
      coinBalance: user.coinBalance,
      completedChallenges: user.completedChallenges,
      currentChallenge,
    });
  } catch (err) {
    next(err);
  }
};


// UPDATE a plan (Admin only)
exports.updatePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    next(err);
  }
};

// DELETE a plan (Admin only)
exports.deletePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json({ message: 'Plan deleted' });
  } catch (err) {
    next(err);
  }
};

// SELECT a plan (user picks one)
exports.selectPlan = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const plan = await Plan.findById(req.params.id);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    const user = await User.findById(userId);

    // 1) only one at a time
    if (user.currentChallengeId) {
      return res.status(400).json({ message: 'You already have an active challenge' });
    }

    // 2) max 10/day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (user.selectionsCountDate?.getTime() === today.getTime()) {
      if (user.selectionsCount >= 10) {
        return res.status(400).json({ message: 'Daily selection limit reached' });
      }
      user.selectionsCount += 1;
    } else {
      user.selectionsCountDate = today;
      user.selectionsCount = 1;
    }

    // 3) start it
    user.currentChallengeId = plan._id;
    user.currentChallengeProgress = 0;
    user.currentChallengeStartedAt = new Date();
    user.currentChallengeExpiresAt = new Date(Date.now() + plan.timeLimitHours * 3600_000 + plan.timeLimitMinutes * 60_000);
    await user.save();



    res.json({
      message: 'Plan selected',
      currentChallengeId: user.currentChallengeId,
      currentChallengeProgress: user.currentChallengeProgress,
      currentChallengeStartedAt: user.currentChallengeStartedAt,
      currentChallengeExpiresAt: user.currentChallengeExpiresAt
    });

  } catch (err) {
    next(err);
  }
};
