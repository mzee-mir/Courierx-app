// server/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

/**
 * 1. Global API Limiter
 * Limits generic GET requests to prevent scraping.
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'TRAFFIC_LIMIT_REACHED',
        message: 'High traffic detected from this node. Please wait 15 minutes.'
    }
});

/**
 * 2. Strict Auth Limiter
 * Specifically for /login and /verify-sudo.
 * Prevents hackers from guessing passwords.
 */
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Only 10 failed attempts allowed per hour
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failures toward the limit
    message: {
        error: 'SECURITY_LOCKOUT',
        message: 'Too many failed attempts. Access from this IP is restricted for 1 hour.'
    }
});

/**
 * 3. Intake Limiter
 * Prevents "Ghost Scanning" (bots trying to guess tracking numbers).
 */
export const intakeLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit to 30 scans per minute
    message: {
        error: 'SCAN_THROTTLED',
        message: 'Scanner frequency exceeds physical limits. Take a breath, operative.'
    }
});

/**
 * 4. Standard Mutation Limiter
 * For things like "Seal Manifest", "Update Profile", "Confirm Handoff".
 * Limit: 60 actions per minute (Enough for a human, slow for a bot).
 */
export const mutationLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'OPERATION_THROTTLED',
        message: 'Too many data updates. Please wait a moment.'
    }
});

/**
 * 5. Search / Read Limiter
 * For the "Global Search" bar to prevent database scraping.
 */
export const searchLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20, // 20 searches per minute is plenty for a staff member
    message: {
        error: 'SEARCH_THROTTLED',
        message: 'Search frequency exceeded. Please slow down.'
    }
});