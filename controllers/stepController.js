// backend/controllers/stepController.js
const mongoose                = require('mongoose');
const StepRecord             = require('../models/StepRecord');
const User                   = require('../models/User');
const Plan                   = require('../models/Plan');
const ChallengeCompletion    = require('../models/ChallengeCompletion');

/**
 * POST /api/steps
 * Add/update today’s step record, auto‐award challenge coins, and log completions.
 */
exports.addSteps = async (req, res, next) => {
  try {
    const userId   = req.user.userId;
    const { date, stepCount } = req.body;
    const day      = new Date(date);
    day.setHours(0,0,0,0);

    // 1) upsert daily record
    const record = await StepRecord.findOneAndUpdate(
      { userId, date: day },
      { $max: { stepCount } },
      { upsert: true, new: true }
    );

    // 2) load user
    const user = await User.findById(userId);

    // 3) no active challenge
    if (!user.currentChallengeId) {
      return res.json({ stepRecord: record });
    }

    // 4) fetch plan & expiry
    const plan     = await Plan.findById(user.currentChallengeId);
    const started  = user.currentChallengeStartedAt;
    const expires  = new Date(started.getTime() + plan.timeLimitHours * 3600_000 + plan.timeLimitMinutes * 60_000);
    if (Date.now() > expires.getTime()) {
      // expired
      user.currentChallengeId        = null;
      user.currentChallengeProgress  = 0;
      user.currentChallengeStartedAt = null;
      await user.save();
      return res.status(400).json({ message: 'Challenge expired' });
    }

    // 5) award if crossed target
    const prevSteps = user.currentChallengeProgress || 0;
    const nowSteps  = record.stepCount;
    if (prevSteps < plan.targetSteps && nowSteps >= plan.targetSteps) {
      // award coins
      user.coinBalance             += plan.rewardCoins;
      user.completedChallenges     = (user.completedChallenges || 0) + 1;
      user.currentChallengeId      = null;
      user.currentChallengeProgress= 0;
      user.currentChallengeStartedAt = null;
      await user.save();

      // log completion
      await ChallengeCompletion.create({
        userId,
        planId: plan._id,
        rewardCoins: plan.rewardCoins,
        date: day
      });

      return res.status(200).json({
        message:     'Challenge completed!',
        rewardCoins: plan.rewardCoins,
        coinBalance: user.coinBalance
      });
    }

    // 6) otherwise update progress
    user.currentChallengeProgress = nowSteps;
    await user.save();
    res.json({ stepRecord: record });
  } catch (err) {
    next(err);
  }
};
/**
 * GET /api/steps/summary
 * Returns { today: {steps, coinsEarned, calories}, yesterday: {...} }
 */
exports.getSummary = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const CAL_PER_STEP = 0.04; // calories burned per step

    // Build date boundaries
    const today      = new Date(); today.setHours(0,0,0,0);
    const tomorrow   = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const yesterday  = new Date(today); yesterday.setDate(yesterday.getDate()-1);
    const dayBefore  = new Date(yesterday); dayBefore.setDate(dayBefore.getDate()-1);

    // Helper to fetch steps & calories
    const fetchStats = async (from, to) => {
      const rec = await StepRecord.findOne({ userId, date: from });
      const steps = rec?.stepCount || 0;
      const calories = Math.round(steps * CAL_PER_STEP);
      // sum coins from ChallengeCompletion
      const agg = await ChallengeCompletion.aggregate([
        { $match: {
            userId: mongoose.Types.ObjectId(userId),
            date:   { $gte: from, $lt: to }
          }
        },
        { $group: { _id: null, total: { $sum: '$rewardCoins' } } }
      ]);
      const coins = agg[0]?.total || 0;
      return { steps, coinsEarned: coins, calories };
    };

    const todayStats     = await fetchStats(today, tomorrow);
    const yesterdayStats = await fetchStats(yesterday, today);

    res.json({
      today:     todayStats,
      yesterday: yesterdayStats
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/steps/history
 * Returns two 7-day arrays: thisWeek & lastWeek for charting.
 */
exports.getHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const today      = new Date(); today.setHours(0,0,0,0);
    const startThis  = new Date(today);     startThis.setDate(startThis.getDate() - 6);
    const startLast  = new Date(startThis); startLast.setDate(startLast.getDate() - 7);

    // load all 14 days of records
    const records = await StepRecord.find({
      userId,
      date: { $gte: startLast, $lte: today }
    }).sort({ date: 1 });

    // map date→count
    const mapRec = new Map(records.map(r => [ r.date.toISOString().slice(0,10), r.stepCount ]));

    const buildWeek = (baseDate) => {
      const arr = [];
      for (let i=0; i<7; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0,10);
        arr.push({ date: key, stepCount: mapRec.get(key) || 0 });
      }
      return arr;
    };

    res.json({
      thisWeek: buildWeek(startThis),
      lastWeek: buildWeek(startLast)
    });
  } catch (err) {
    next(err);
  }
};

exports.getTopSteppers = async (req, res, next) => {
  try {
    // parse period
    const { period = '7d', limit: limitRaw } = req.query;
    let since = new Date();
    switch (period) {
      case '24h': since.setHours(since.getHours() - 24);  break;
      case '7d':  since.setDate(since.getDate() - 7);     break;
      case '1m':  since.setMonth(since.getMonth() - 1);   break;
      case '1y':  since.setFullYear(since.getFullYear() - 1); break;
      default:
        return res.status(400).json({ message: 'Invalid period' });
    }

    // cap limit between 1–20
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 10, 1), 20);

    // aggregate top steppers
    const agg = await StepRecord.aggregate([
      { $match: { date: { $gte: since } } },
      { $group: {
          _id: '$userId',
          totalSteps: { $sum: '$stepCount' },
        }
      },
      { $sort: { totalSteps: -1 } },
      { $limit: limit },
    ]);

    // fetch corresponding user names
    const userIds = agg.map(a => a._id);
    const users   = await User.find({ _id: { $in: userIds } })
                              .select('firstName lastName avatarUrl role')
                              .lean();

    const mapById = Object.fromEntries(users.map(u => [u._id.toString(), u]));
    const result  = agg.map(a => ({
      userId:     a._id,
      firstName:  mapById[a._id.toString()]?.firstName  || 'Unknown',
      lastName:   mapById[a._id.toString()]?.lastName   || '',
      avatarUrl:  mapById[a._id.toString()]?.avatarUrl  || null,
      role:       mapById[a._id.toString()]?.role       || 'user',
      totalSteps: a.totalSteps,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------------
// GET /api/steps/summary
// Returns { today: { steps, coinsEarned, calories }, yesterday: {...} }
// ------------------------------------------------------------------
exports.getSummary = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 1) STEP COUNTS
    const [ recToday, recYest ] = await Promise.all([
      StepRecord.findOne({ userId, date: today }),
      StepRecord.findOne({ userId, date: yesterday })
    ]);
    const stepsToday = recToday?.stepCount || 0;
    const stepsYest  = recYest?.stepCount  || 0;

    // 2) CALORIES (assume 0.04 kcal per step)
    const calPerStep = 0.04;
    const caloriesToday = Math.round(stepsToday * calPerStep);
    const caloriesYest  = Math.round(stepsYest  * calPerStep);

    // 3) COINS EARNED (sum rewardCoins from ChallengeCompletion for each day)
    const [compsToday, compsYest] = await Promise.all([
      ChallengeCompletion.aggregate([
        { $match: { userId: req.user.userId, date: { $gte: today, $lt: new Date(today.getTime()+24*3600_000) } } },
        { $group: { _id: null, total: { $sum: '$rewardCoins' } } }
      ]),
      ChallengeCompletion.aggregate([
        { $match: { userId: req.user.userId, date: { $gte: yesterday, $lt: today } } },
        { $group: { _id: null, total: { $sum: '$rewardCoins' } } }
      ])
    ]);
    const coinsToday = compsToday[0]?.total || 0;
    const coinsYest  = compsYest[0]?.total || 0;

    return res.json({
      today:     { steps: stepsToday, coinsEarned: coinsToday, calories: caloriesToday },
      yesterday: { steps: stepsYest,  coinsEarned: coinsYest,  calories: caloriesYest  },
    });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------------
// GET /api/steps/weekly-summary
// Returns { steps, coinsEarned, timeMinutes }
// ------------------------------------------------------------------
exports.getWeeklySummary = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const now    = new Date();
    const start  = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0,0,0,0);

    // 1) Sum steps over last 7 days
    const stepsAgg = await StepRecord.aggregate([
      { $match: { userId, date: { $gte: start, $lte: now } } },
      { $group: { _id: null, totalSteps: { $sum: '$stepCount' } } }
    ]);
    const totalSteps = stepsAgg[0]?.totalSteps || 0;

    // 2) Sum coins earned from completions last 7 days
    const coinsAgg = await ChallengeCompletion.aggregate([
      { $match: { userId, date: { $gte: start, $lte: now } } },
      { $group: { _id: null, totalCoins: { $sum: '$rewardCoins' } } }
    ]);
    const totalCoins = coinsAgg[0]?.totalCoins || 0;

    // 3) Approximate time walking (100 steps ≈ 1 minute)
    const timeMinutes = Math.round(totalSteps / 100);

    return res.json({
      steps:       totalSteps,
      coinsEarned: totalCoins,
      timeMinutes
    });
  } catch(err) {
    next(err);
  }
};