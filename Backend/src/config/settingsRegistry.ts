import { z } from 'zod';

export const SETTINGS_REGISTRY = {
  'PRICING_BAJAJ_PER_KM': {
    isImplemented: true,
    schema: z.number().min(0.1).max(2.0),
    description: "USD rate per KM for Bajaj vehicles"
  },
  'ENABLE_REGISTRATION': {
    isImplemented: false, // 👈 Frontend will gray this out
    schema: z.boolean(),
    description: "Allow new users to sign up"
  },
  'MAINTENANCE_MODE_ENABLED': {
    isImplemented: true,
    schema: z.boolean(),
    description: "Blocks all Customer/Driver interactions. Admin dashboard remains active."
  },
  'MAINTENANCE_NOTICE_MESSAGE': {
    isImplemented: true,
    schema: z.string().min(5).max(100),
    description: "Message displayed to users when maintenance is active."
  }
} as const;