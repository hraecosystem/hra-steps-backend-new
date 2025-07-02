const express                 = require('express');
const authMiddleware          = require('../middleware/authMiddleware');
const { getUserChallengeHistory } = require('../controllers/challengeController');

const router = express.Router();

// GET  /api/challenges/history
// return recent challenge completions for the logged-in user
router.get(
  '/history',
  authMiddleware,
  getUserChallengeHistory
);

module.exports = router;
