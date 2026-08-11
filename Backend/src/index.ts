import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

// Load Environment Variables
dotenv.config();


// Initialize Firebase Admin SDK
import './config/firebase';


// Route Imports
import authRoutes from './routes/authRoutes';
import walletRoutes from './routes/walletRoutes';
import orderRoutes from './routes/orderRoutes';
import importRoutes from './routes/importRoutes';
import profileRoutes from './routes/profileRoutes';
import driverRoutes from './routes/driverRoutes';
import uploadRoutes from './routes/uploadRoutes';
import adminRoutes from './routes/adminRoutes';


// Middleware Imports
import { enforceIdempotency } from './middleware/idempotencyMiddleware';
import { SocketService } from './socket';
import { checkMaintenanceMode } from './middleware/maintenanceGuard';
import partnerRoutes from './routes/partnerRoutes';
import { globalLimiter } from './middleware/rateLimiter';


const app: Application = express();
const server = http.createServer(app);


/**
 * 1. SECURITY & TRACEABILITY HARDENING
 */


// A. Disable Fingerprinting
app.disable('x-powered-by');


// B. Set Security Headers (CSP, HSTS, XSS protection)
app.use(helmet());


// C. Maintenance Mode Guard
app.use(checkMaintenanceMode);


// C. Assign Unique Request ID (Traceability Thread)
app.use((req: Request, res: Response, next: NextFunction) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});


app.use(cors({
  origin: (origin, callback) => {
    // Allow local development and your specific network IP
    const allowed = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://10.217.207.181:5173'
    ];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS_NOT_ALLOWED'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Idempotency-Key',
    'X-Request-ID',
    'X-Sudo-Token'
  ]
}));

/**
 * 2. GLOBAL MIDDLEWARE
 */
app.use(express.json({ limit: '10kb' })); // Protection against large payload DoS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));


// Apply Idempotency Guard to all mutation routes
app.use(enforceIdempotency);


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


/**
 * 4. API ROUTE REGISTRATION
 */
app.use('/api', globalLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/cargo', importRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/driver', driverRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/partner', partnerRoutes);
app.use('/api/v1/import', importRoutes);
// Legacy support for /admins route
/**
 * 5. HEALTH CHECK
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CourierX Backend Engine',
    traceId: req.id
  });
});


/**
 * 6. PRODUCTION ERROR HARDENING (Masking)
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const isProd = process.env.NODE_ENV === 'production';

  // Log full error detail internally with request ID for debugging
  console.error(`[INTERNAL_ERROR][${req.id}]:`, err.stack || err);


  res.status(err.status || 500).json({
    error: isProd ? 'INTERNAL_SERVER_ERROR' : err.name || 'Error',
    message: isProd
      ? `An internal error occurred. Please provide Support ID: ${req.id}`
      : err.message,
    requestId: req.id // User can provide this to support
  });
});


/**
 * 7. SOCKET INITIALIZATION
 */
export const socketService = new SocketService(server);


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