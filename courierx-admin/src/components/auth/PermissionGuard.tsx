import React from 'react';
import { UserRole } from '../../types/user';
import { Permission, ROLE_PERMISSIONS } from '../../config/permissions';

interface Props {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard = ({ permission, children, fallback = null }: Props) => {
  const user = JSON.parse(localStorage.getItem('admin_user') || '{}');
  const roles: string[] = user.roles || [];

  const hasPower = roles.includes('super_admin') || 
                   roles.some(role => ROLE_PERMISSIONS[role]?.includes(permission));

  if (!hasPower) return <>{fallback}</>;
  return <>{children}</>;
};