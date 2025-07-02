require('dotenv').config();           // ← make sure env is loaded first
const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const rateLimit     = require('express-rate-limit');
const connectDB     = require('./config/database');
const config        = require('./config/config');
const logger        = require('./utils/logger');
const errorHandler  = require('./middleware/errorHandler');
const path = require('path');

const authRoutes       = require('./routes/authRoutes');
const planRoutes       = require('./routes/planRoutes');
const stepRoutes       = require('./routes/stepRoutes');
const userRoutes       = require('./routes/userRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const challengeRoutes = require('./routes/challengeRoutes');

const app = express();

//–– global crash handlers ––
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  logger.error('Uncaught Exception: %s', err.stack || err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  logger.error('Unhandled Rejection: %s', reason);
  process.exit(1);
});

//–– connect to MongoDB ––
connectDB();

// serve static “public” folder
app.use(express.static(path.join(__dirname, 'public')));

//–– middleware ––
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 60 * 1000,
  max:      100,
  message:  'Too many requests, please try again later.'
}));


// optional: a tiny health‐check endpoint for JSON
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime().toFixed(0) });
});

app.use(express.static(path.join(__dirname, 'public')));

//–– routes ––
app.use('/api/auth',        authRoutes);
app.use('/api/plans',       planRoutes);
app.use('/api/steps',       stepRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/challenges',  challengeRoutes);



//–– global error handler (last) ––
app.use(errorHandler);

//–– start server ––
const host = '0.0.0.0';
app.listen(config.port, host, () => {
  console.log(`🚀 Server listening on http://${host}:${config.port}`);
  logger.info(`Server running on port ${config.port}`);
});

