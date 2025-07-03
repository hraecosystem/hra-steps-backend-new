const express                 = require('express');
const authMiddleware          = require('../middleware/authMiddleware');
const { getUserChallengeHistory ,stopChallenge } = require('../controllers/challengeController');

const router = express.Router();

// GET  /api/challenges/history
// return recent challenge completions for the logged-in user
router.get(
  '/history',
  getUserChallengeHistory
);
router.post('/stop', stopChallenge);

router.post(
  '/:id/stop',
  [ param('id').isMongoId().withMessage('Invalid plan ID') ],
  stopChallenge
);
module.exports = router;
