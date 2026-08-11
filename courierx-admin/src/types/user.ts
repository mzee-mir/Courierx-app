// src/types/user.ts
export const UserRole = {
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  MERCHANT: 'merchant',
  SUPER_ADMIN: 'super_admin',
  OPS_ADMIN: 'ops_admin',
  FINANCE_ADMIN: 'finance_admin',
  SUPPORT_ADMIN: 'support_admin',
} as const;



// Create a type based on the values of the object
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface User {
  _id: string;
  email: string;
  displayName: string;
  roles: UserRole[];
  isVerified: boolean;
  imageUrl?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}