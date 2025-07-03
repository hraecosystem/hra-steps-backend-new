// backend/routes/planRoutes.js
const express   = require('express');
const { body, param } = require('express-validator');
const planController  = require('../controllers/planController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public: list + get
router.get('/', planController.getPlans);
router.get(
  '/:id',
  [ param('id').isMongoId().withMessage('Invalid plan ID') ],
  planController.getPlanById
);

// Authenticated users can select
router.post(
  '/:id/select',
  [ param('id').isMongoId().withMessage('Invalid plan ID') ],
  planController.selectPlan
);

//  Get active plane 
router.post(
  '/activePlan',
  planController.activePlan
);



// Create
router.post(
  '/',
  [
    body('name').notEmpty().trim(),
    body('targetSteps').isInt({ min:1 }),
    body('rewardCoins').isInt({ min:0 }),
    body('description').optional().isString(),
    body('difficulty')
      .isIn(['Easy','Medium','Hard'])
      .withMessage('Must be Easy, Medium or Hard'),
    body('timeLimitHours').isInt({ min:1 }),
    body('timeLimitMinutes').isInt({ min:0, max:59 }),
    body('isActive').optional().isBoolean(),
  ],
  planController.createPlan
);

// Update
router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('name').optional().notEmpty().trim(),
    body('targetSteps').optional().isInt({ min:1 }),
    body('rewardCoins').optional().isInt({ min:0 }),
    body('description').optional().isString(),
    body('difficulty').optional().isIn(['Easy','Medium','Hard']),
    body('timeLimitHours').optional().isInt({ min:1 }),
    body('timeLimitMinutes').optional().isInt({ min:0, max:59 }),
    body('isActive').optional().isBoolean(),
  ],
  planController.updatePlan
);

// Delete
router.delete(
  '/:id',
  [ param('id').isMongoId() ],
  planController.deletePlan
);

module.exports = router;
