import React from 'react';
import { ROLE_PERMISSIONS, type Permission } from '../config/permissions';
import { useAuthStore } from '../store/useAuthStore';




interface PermissionGuardProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}


export const PermissionGuard = ({ permission, children, fallback = null }: PermissionGuardProps) => {
  const { user } = useAuthStore();


  if (!user) return null;


  // 1. Super Admins always get through
  if (user.roles.includes('super_admin')) return <>{children}</>;


  // 2. Check the user's specific "Keychain" from the database
  const hasKey = user.permissions?.includes(permission);


  if (!hasKey) {
    return <>{fallback}</>;
  }


  return <>{children}</>;
};
