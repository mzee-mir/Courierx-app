import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

// Load Environment Variables
dotenv.config();

// Initialize Firebase Admin SDK
import './config/firebase';

import app from './app';
import { SocketService } from './socket';
import { registerSocketService } from './socketInstance';

/**
 * 3. DATABASE CONNECTION
 */
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/courierx';

import { startCronJobs } from './queues/cronScheduler';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('SECURITY_NOTICE: MongoDB Connected Successfully');
    startCronJobs();
  })
  .catch((err) => {
    console.error('CRITICAL_DATABASE_ERROR:', err);
    process.exit(1);
  });

const server = http.createServer(app);

/**
 * 7. SOCKET INITIALIZATION
 */
const socketService = new SocketService(server);
registerSocketService(socketService);

export { socketService };

/**
 * 8. SERVER START
 */
const PORT = process.env.PORT || 2026;
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`
  🚀 COURIERX HARDENED ENGINE LIVE
  -------------------------------
  📡 Port: ${PORT}
  🌍 Mode: ${process.env.NODE_ENV || 'development'}
  🔐 Security: Level 4 Hardened
  -------------------------------
  `);
});

export default app;
