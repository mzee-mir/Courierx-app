import { z } from 'zod';

export const PricingSchema = z.object({
  base_fare: z.number().min(0.5),
  per_km_bajaj: z.number().min(0.1),
  per_km_car: z.number().min(0.2),
  commission_rate: z.number().min(0.05).max(0.3) // 5% to 30%
});

export const SettingsSchemaMap: Record<string, z.ZodTypeAny> = {
  'PRICING_CONFIG': PricingSchema,
  'SERVICE_ACTIVE': z.boolean(),
  'MAX_WITHDRAWAL_LIMIT': z.number().max(1000)
};