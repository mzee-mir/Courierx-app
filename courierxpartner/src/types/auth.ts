export type UserRole = 'partner_owner' | 'partner_ops' | 'partner_readonly' | 'super_admin';


export const UserRoles = {
  PARTNER_OWNER: 'partner_owner' as UserRole,
  PARTNER_OPS: 'partner_ops' as UserRole,
  PARTNER_READONLY: 'partner_readonly' as UserRole,
  SUPER_ADMIN: 'super_admin' as UserRole,
} as const;


export interface User {
  id: string;
  email: string;
  displayName: string;
  imageUrl?: string;
  roles: UserRole[];
  partnerId?: string;
  assignedLocations: string[];
  permissions: string[];
}


export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}
