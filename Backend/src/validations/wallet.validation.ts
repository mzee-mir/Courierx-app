import { z } from 'zod';

/**
 * POST /wallet/deposit
 * amount is a positive number; phoneNumber is optional (the provider may
 * resolve the recipient from the wallet record).
 */
export const depositSchema = {
  body: z.object({
    amount: z.number().positive(),
    phoneNumber: z.string().optional(),
  }),
};
