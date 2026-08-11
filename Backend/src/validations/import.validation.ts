import { z } from 'zod';

export const declarationSchema = {
  body: z.object({
    externalTrackingNumber: z.string().min(5),
    partnerId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    transportMode: z.enum(['AIR', 'SEA']), // 👈 Mandatory Choice
    // Dimensions required for SEA mode
    dimensions: z.object({
      length: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional()
    }).optional()
  })
};