const bcrypt     = require('bcrypt');
const User       = require('../models/User');
const StepRecord = require('../models/StepRecord');
const Plan       = require('../models/Plan');

const path   = require('path');
const fs     = require('fs');
const multer = require('multer');

/**
 * GET /api/users/profile
 * Returns the authenticated user's profile (minus passwordHash).
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User
      .findById(req.user.userId)
      .select('-passwordHash -subscription'); // hide sensitive
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/dashboard
 * • profile (no passwordHash)
 * • today's stepCount
 * • coinBalance
 * • currentChallenge details (if any)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // today’s steps
    const today = new Date(); today.setHours(0,0,0,0);
    const rec = await StepRecord.findOne({ userId: user._id, date: today });
    const stepCount = rec?.stepCount || 0;

    // build currentChallenge
    let currentChallenge = null;
    if (user.currentChallengeId) {
      const plan = await Plan.findById(user.currentChallengeId);
      if (plan) {
        const expiresAt = new Date(
          user.currentChallengeStartedAt.getTime() +
          plan.timeLimitHours * 3600 * 1000
        );
        currentChallenge = {
          planId:      plan._id,
          name:        plan.name,
          targetSteps: plan.targetSteps,
          rewardCoins: plan.rewardCoins,
          progress:    stepCount,
          startedAt:   user.currentChallengeStartedAt,
          expiresAt,
        };
      }
    }

    res.json({
      profile:         user,
      stepCount,
      coinBalance:     user.coinBalance,
     completedChallenges: user.completedChallenges,

      currentChallenge,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/challenge-status
 * • activePlanId
 * • selectionsToday
 */
exports.getChallengeStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const today = new Date(); today.setHours(0,0,0,0);
    const selectionsToday =
      user.selectionsCountDate?.getTime() === today.getTime()
        ? user.selectionsCount
        : 0;

    res.json({
      activePlanId:   user.currentChallengeId,
      selectionsToday,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/challenge
 * Clears the current challenge (no coins awarded).
 */
exports.clearChallenge = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.currentChallengeId        = null;
    user.currentChallengeProgress  = 0;
    user.currentChallengeStartedAt = null;
    await user.save();

    res.json({ message: 'Challenge cleared' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/profile
 * Updates:
 *  • firstName, lastName, phone
 *  • password
 *  • settings (units, pushNotifications, dailyReminder, language)
 *
 * Returns the updated user (minus passwordHash).
 */
exports.updateProfile = async (req, res, next) => {
  // upload.single('avatarUrl');
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { firstName, lastName, phone, password, settings } = req.body;

    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName  !== undefined) user.lastName  = lastName.trim();
    if (phone     !== undefined) user.phone     = phone.trim();
    if (password  !== undefined) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }


    if(req.file) {
      if (user.avatarUrl) {
        const oldPath = path.join(__dirname, '..', 'public', user.avatarUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      user.avatarUrl =  `/avatars/${req.file.filename}` 
    }

    if (settings) {
      const { units, pushNotifications, dailyReminder, language } = settings;
      if (units              !== undefined) user.settings.units               = units;
      if (pushNotifications  !== undefined) user.settings.pushNotifications   = pushNotifications;
      if (dailyReminder      !== undefined) user.settings.dailyReminder       = dailyReminder;
      if (language           !== undefined) user.settings.language            = language;
    }

    await user.save();

    const out = user.toObject();
    delete out.passwordHash;
    res.json(out);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users
 * Deletes the authenticated user.
 */
exports.deleteAccount = async (req, res, next) => {
  try {
    const deleted = await User.findByIdAndDelete(req.user.userId);
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
};


/**
 * PUT /api/users/password
 * Body: { currentPassword, newPassword }
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // verify current password
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

    // hash & save new
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
};


// configure multer to write into ./public/avatars
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', 'public', 'avatars');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const fn  = `${req.user.userId}-${Date.now()}${ext}`;
      cb(null, fn);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    // only accept JPEG/PNG
    if (!['image/jpeg','image/png'].includes(file.mimetype)) {
      return cb(new Error('Only JPG/PNG images allowed'), false);
    }
    cb(null, true);
  }
});

/**
 * POST /api/users/avatar
 * Uploads a new profile picture (JPG/PNG ≤5MB), stores file under /public/avatars,
 * and updates user.avatarUrl to point at /avatars/<filename>.
 */
exports.uploadAvatar = [
  upload.single('avatar'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      const user = await User.findById(req.user.userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      // delete old avatar file if you like:
      if (user.avatarUrl) {
        const oldPath = path.join(__dirname, '..', 'public', user.avatarUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      // save new relative URL
      user.avatarUrl = `/avatars/${req.file.filename}`;
      await user.save();

      res.json({ avatarUrl: user.avatarUrl });
    } catch (err) {
      next(err);
    }
  }
];