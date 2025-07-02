/*
  backend/seeds/seed.js
  Usage: node backend/seeds/seed.js
*/
require('dotenv').config();

// Connect using existing database configuration
const connectDB = require('../config/database');
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

// Models
const User                = require('../models/User');
const Plan                = require('../models/Plan');
const StepRecord          = require('../models/StepRecord');
const WithdrawalRequest   = require('../models/WithdrawalRequest');
const ChallengeCompletion = require('../models/ChallengeCompletion');

// Constants
const TEST_PW = 'Pass@1234';
const NUM_USERS = 15;
const HISTORY_DAYS = 180;  // ~6 months
const WITHDRAWALS_PER_USER = 15;
const CHALLENGES_PER_USER = 12; // roughly bi-weekly

// Deterministic step pattern: base + weekly cycle + user offset
function getStepCount(userIndex, dayIndex) {
  const base = 4000 + userIndex * 100;
  const weekly = [5000, 7000, 8000, 6000, 9000, 10000, 7500];
  return base + weekly[dayIndex % 7];
}

async function clearAll() {
  await Promise.all([
    User.deleteMany({}),
    Plan.deleteMany({}),
    StepRecord.deleteMany({}),
    WithdrawalRequest.deleteMany({}),
    ChallengeCompletion.deleteMany({}),
  ]);
  console.log('✅ Cleared all collections');
}

async function seed() {
  // 1) Connect
  await connectDB();

  // 2) Clear existing
  await clearAll();

  // 3) Create plans
  const plans = await Plan.create([
    { name:'Easy Walk',   targetSteps:1000,  rewardCoins:5,  description:'Warm-up', difficulty:'Easy',   timeLimitHours:1, timeLimitMinutes:0, isActive:true },
    { name:'Power Stroll', targetSteps:5000,  rewardCoins:20, description:'Medium',   difficulty:'Medium', timeLimitHours:2, timeLimitMinutes:0, isActive:true },
    { name:'Marathon',     targetSteps:10000, rewardCoins:50, description:'Hardcore', difficulty:'Hard',   timeLimitHours:4, timeLimitMinutes:0, isActive:true }
  ]);
  console.log(`📦 Seeded ${plans.length} plans`);

  // 4) Create users + one admin
  const users = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    users.push({
      firstName: `User${i}`,
      lastName: 'Tester',
      email: `user${i}@example.com`,
      phone: `+1000000${String(i).padStart(5,'0')}`,
      passwordHash: bcrypt.hashSync(TEST_PW, 10),
      role: 'user',
      coinBalance: 0,
      currentChallengeId: null,
      currentChallengeProgress: 0,
      currentChallengeStartedAt: null,
      selectionsCountDate: new Date(),
      selectionsCount: 0,
      completedChallenges: 0,
      settings: { units:'KM', pushNotifications:true, dailyReminder:false, language:'en' },
      subscription: { stripeCustomerId:'', stripeSubscriptionId:'', isActive:false, nextBillingDate:null, monthlyFee:0, history:[] }
    });
  }
  // Admin user
  users.push({
    firstName:'Admin', lastName:'User',
    email:'admin@example.com', phone:'+10000000000',
    passwordHash: bcrypt.hashSync(TEST_PW,10), role:'admin',
    coinBalance:0, currentChallengeId:null,currentChallengeProgress:0,currentChallengeStartedAt:null,
    selectionsCountDate:new Date(), selectionsCount:0, completedChallenges:0,
    settings:{ units:'KM', pushNotifications:true, dailyReminder:true, language:'en' },
    subscription:{ stripeCustomerId:'', stripeSubscriptionId:'', isActive:false, nextBillingDate:null, monthlyFee:0, history:[] }
  });

  const createdUsers = await User.insertMany(users);
  console.log(`👥 Seeded ${createdUsers.length} users (including admin)`);

  // 5) Seed step history for each non-admin user (HISTORY_DAYS days)
  const today = new Date(); today.setHours(0,0,0,0);
  for (let ui = 0; ui < NUM_USERS; ui++) {
    const u = createdUsers[ui];
    const recs = [];
    for (let d = 0; d < HISTORY_DAYS; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      recs.push({ userId: u._id, date, stepCount: getStepCount(ui, d) });
    }
    await StepRecord.insertMany(recs);
  }
  console.log(`📊 Seeded ${HISTORY_DAYS} days of steps for ${NUM_USERS} users`);

  // 6) Seed challenge completions per user (~CHALLENGES_PER_USER each)
  const comps = [];
  for (let ui = 0; ui < NUM_USERS; ui++) {
    const u = createdUsers[ui];
    for (let c = 0; c < CHALLENGES_PER_USER; c++) {
      const plan = plans[c % plans.length];
      const daysAgo = Math.floor((HISTORY_DAYS / CHALLENGES_PER_USER) * c);
      const date = new Date(today);
      date.setDate(date.getDate() - daysAgo);
      comps.push({ userId: u._id, planId: plan._id, rewardCoins: plan.rewardCoins, date });
    }
    // update user completedChallenges count
    await User.findByIdAndUpdate(u._id, { completedChallenges: CHALLENGES_PER_USER });
  }
  await ChallengeCompletion.insertMany(comps);
  console.log(`🏅 Seeded ${comps.length} challenge completions`);

  // 7) Seed withdrawal requests (WITHDRAWALS_PER_USER each)
  const wds = [];
  for (let ui = 0; ui < NUM_USERS; ui++) {
    const u = createdUsers[ui];
    for (let w = 0; w < WITHDRAWALS_PER_USER; w++) {
      const daysAgo = Math.floor((HISTORY_DAYS / WITHDRAWALS_PER_USER) * w);
      const requestedAt = new Date(today);
      requestedAt.setDate(requestedAt.getDate() - daysAgo);
      const statuses = ['Pending','Approved','Rejected','Paid'];
      const status = statuses[w % statuses.length];
      const processedAt = status==='Paid'||status==='Rejected'
        ? new Date(requestedAt.getTime() + 2*3600_000)
        : null;
      const txId = status==='Paid' ? `0xTX${String(w).padStart(4,'0')}` : undefined;
      wds.push({ userId: u._id, amount: (w+1)*5, walletAddress:`0xADDR${ui}${w}`, status, requestedAt, processedAt, txId });
    }
  }
  await WithdrawalRequest.insertMany(wds);
  console.log(`💸 Seeded ${wds.length} withdrawal requests`);

  console.log('🎉 Full seeding complete!');
  mongoose.disconnect();
}

seed().catch(err => { console.error('Seeding error:', err); process.exit(1); });