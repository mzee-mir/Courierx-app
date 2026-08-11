import {
  LayoutDashboard,
  Scan,
  Package,
  ClipboardList,
  Settings,
  Users,
  ShieldCheck,
  History,
  Archive,
  Truck,
  MapPin,
  Landmark,
  ShieldAlert,
  Building2,
  UserCog
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Permission } from './permissions';


/**
 * Interface for Navigation Items
 * labels are optimized for "Tactical Industrial" tone.
 */
export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  requiredPermission: Permission;
}


/**
 * 1. CORE OPERATIONS (Floor Staff & Managers)
 * These are the daily tactical tools used for physical package movement.
 */
export const PARTNER_NAV_ITEMS: NavItem[] = [
  {
    name: 'Terminal',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'Operational briefing board',
    requiredPermission: 'PARTNER_READ'
  },
  {
    name: 'Intake',
    href: '/intake',
    icon: Scan,
    description: 'Scan new arrivals and resolve CX-Codes',
    requiredPermission: 'PARTNER_WRITE'
  },
  {
    name: 'Floor',
    href: '/inventory',
    icon: Package,
    description: 'Manage unsealed inventory',
    requiredPermission: 'PARTNER_READ'
  },
  {
    name: 'Manifests',
    href: '/manifests',
    icon: ClipboardList,
    description: 'Batch consolidation and lane tracking',
    requiredPermission: 'PARTNER_WRITE'
  },
  {
    name: "Manifest Directory",
    href: "/manifests/directory",
    icon: MapPin,
    description: "View all active and past manifests",
    requiredPermission: 'PARTNER_WRITE'
  },
  {
    name: 'Dispatch', // 👈 Add this
    href: '/dispatch',
    icon: Truck,
    description: 'Release verified items to CourierX',
    requiredPermission: 'PARTNER_WRITE'
  },
  {
    name: 'Finance',
    href: '/finance',
    icon: Landmark,
    description: 'Wallet, Settlements, and Payouts',
    requiredPermission: 'PARTNER_FINANCE'
  },
  {
    name: 'Exceptions',
    href: '/exceptions',
    icon: ShieldAlert,
    description: 'Manage blocked and flagged items',
    requiredPermission: 'PARTNER_CORRECT_WEIGHT'
  },
  {
    name: 'My Workspace',
    href: '/my-settings',
    icon: UserCog,
    description: 'Manage your profile, security, and tools',
    requiredPermission: 'PARTNER_READ'
  },
];


/**
 * 2. NODE MANAGEMENT (Partner Owners Only)
 * High-authority links for governing the physical location and personnel.
 */
export const PARTNER_OWNER_ITEMS: NavItem[] = [
  {
    name: 'Staff Access',
    href: '/staff',
    icon: Users,
    description: 'Manage warehouse operative logins',
    requiredPermission: 'MANAGE_STAFF'
  },
  {
    name: 'Audit Trail',
    href: '/history',
    icon: History,
    description: 'Review local node activity logs',
    requiredPermission: 'VIEW_AUDIT_LOGS'
  },
  {
    name: 'Terminal Settings',
    href: '/settings',
    icon: Settings,
    description: 'Manage working hours and contact info',
    requiredPermission: 'SYSTEM_CONFIG'
  },
  {
    name: 'Brand Profile',
    href: '/profile/public',
    icon: Building2,
    description: 'Manage your address and customer view',
    requiredPermission: 'SYSTEM_CONFIG'
  }
];


// 1. DAILY CORE OPERATIONS (The Bottom Dock)
export const MOBILE_CORE_NAV: NavItem[] = [
  { name: 'Terminal', href: '/dashboard', icon: LayoutDashboard, requiredPermission: 'PARTNER_READ' },
  { name: 'Intake', href: '/intake', icon: Scan, requiredPermission: 'PARTNER_WRITE' },
  { name: 'Floor', href: '/inventory', icon: Package, requiredPermission: 'PARTNER_READ' },
  { name: 'Dispatch', href: '/dispatch', icon: Truck, requiredPermission: 'PARTNER_WRITE' },


];


// 2. GOVERNANCE & MACRO TOOLS (The Hub Overlay)
export const MOBILE_SECONDARY_NAV: NavItem[] = [
  { name: 'Manifests', href: '/manifests', icon: ClipboardList, requiredPermission: 'PARTNER_WRITE' },
  { name: 'Manifests Directory', href: '/manifests/directory', icon: MapPin, description: 'Batch control', requiredPermission: 'PARTNER_WRITE' },
  { name: 'Finance', href: '/finance', icon: Landmark, description: 'Wallets & Payouts', requiredPermission: 'PARTNER_FINANCE' },
  { name: 'Exceptions', href: '/exceptions', icon: ShieldAlert, description: 'Blocked items', requiredPermission: 'PARTNER_CORRECT_WEIGHT' },
  { name: 'My Workspace', href: '/my-settings', icon: UserCog, description: 'Personal tools', requiredPermission: 'PARTNER_READ' },
  { name: 'Brand Profile', href: '/profile/public', icon: Building2, description: 'Storefront', requiredPermission: 'SYSTEM_CONFIG' },
  { name: 'Staff Access', href: '/staff', icon: Users, description: 'Manage team', requiredPermission: 'MANAGE_STAFF' },
  { name: 'Audit Trail', href: '/history', icon: History, description: 'Forensic logs', requiredPermission: 'VIEW_AUDIT_LOGS' },
];


/**
 * 3. LOGISTICS STATUS COLORS (Industrial Standard)
 */
export const OPERATIONAL_STATUS_THEME = {
  ACTIVE: '#10b981',    // Success/Go
  LIMITED: '#f59e0b',   // Caution
  SUSPENDED: '#ef4444', // Hard stop
  DRAFT: '#6366f1',     // Work in progress
  LOCKED: '#444444'     // Immutable
};
