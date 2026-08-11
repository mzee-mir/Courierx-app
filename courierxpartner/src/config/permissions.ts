export const Permission = {
  PARTNER_WRITE: 'PARTNER_WRITE',
  PARTNER_READ: 'PARTNER_READ',
  PARTNER_MANAGE_RATES: 'PARTNER_MANAGE_RATES',
  PARTNER_CORRECT_WEIGHT: 'PARTNER_CORRECT_WEIGHT',
  PARTNER_VIEW_PII: 'PARTNER_VIEW_PII',
  PARTNER_FINANCE: 'PARTNER_FINANCE',
  MANAGE_STAFF: 'MANAGE_STAFF',
  VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',
  SYSTEM_CONFIG: 'SYSTEM_CONFIG'
} as const;


// 2. Create an erasable type alias from the object values
export type Permission = (typeof Permission)[keyof typeof Permission];


/**
 * ROLE_CAPABILITIES
 * The source of truth for UI visibility.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  partner_owner: [
    Permission.PARTNER_MANAGE_RATES,
    Permission.PARTNER_WRITE,
    Permission.PARTNER_CORRECT_WEIGHT,
    Permission.PARTNER_VIEW_PII,
    Permission.PARTNER_READ,
    Permission.SYSTEM_CONFIG,
    Permission.MANAGE_STAFF
  ],
  partner_ops: [
    Permission.PARTNER_WRITE,
    Permission.PARTNER_VIEW_PII,
    Permission.PARTNER_FINANCE
  ],
  partner_readonly: [
    Permission.PARTNER_READ,
    Permission.PARTNER_VIEW_PII
  ]
};
