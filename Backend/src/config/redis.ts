import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl && process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: REDIS_URL is missing in production environment variables.');
}

const isTest = process.env.NODE_ENV === 'test';

export const redisClient = new Redis(redisUrl || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null, // Mandatory for BullMQ
    lazyConnect: isTest,
    enableOfflineQueue: !isTest,
    // Add retry strategy for production resilience
    retryStrategy: isTest ? () => null : (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redisClient.on('error', (err) => {
    // In production, we log but don't crash the whole process immediately
    console.error('🔴 Redis Client Error:', err.message);
});

redisClient.on('connect', () => console.log('✅ Redis Connected'));