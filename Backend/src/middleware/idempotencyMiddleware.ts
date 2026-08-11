import { Request, Response, NextFunction } from 'express';

export const enforceIdempotency = (req: Request, res: Response, next: NextFunction) => {
  const mutationMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
  
  if (mutationMethods.includes(req.method)) {
    const key = req.headers['x-idempotency-key'];

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ 
        error: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'All state-changing requests must include a unique X-Idempotency-Key header.'
      });
    }

    // Attach key to request for controller use
    req.idempotencyKey = key;
  }
  
  next();
};

// Update global types
declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}