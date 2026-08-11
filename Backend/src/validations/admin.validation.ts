import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-H]{24}$/, 'Invalid ID format');

export const verifyDriverSchema = {
  params: z.object({
    id: objectId
  }),
  body: z.object({
    status: z.enum(['approved', 'rejected']),
    reason: z.string().min(5).max(200) // 👈 Forced descriptive audit
  })
};

export const walletAdjustSchema = {
  body: z.object({
    userId: objectId,
    amount: z.number().min(-500).max(500), // 👈 Strict financial bounds
    reason: z.string().min(10).max(255)
  })
};

export const createPartnerStaffSchema = {
  body: z.object({
    displayName: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(8),
    // Workers must be assigned to at least one physical warehouse
    assignedLocations: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1)
  })
};