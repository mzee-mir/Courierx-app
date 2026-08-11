import { NavLink } from 'react-router-dom';
import { useQuery } from 'react-query';
import { 
  LayoutDashboard, Users, Truck, Wallet, PackageSearch, Settings, LogOut,
  ShieldCheck, DollarSign, Archive, History, ShieldAlert, BarChart3,
  Trophy, Banknote, Building2, UserCheck, ShieldOff, Megaphone,
  Shield
} from 'lucide-react';
import { UserRole } from '../types/user';
import { actionService } from '../api/action.services';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, allowedRoles: [] },
  
  // FLEET MANAGEMENT
  { name: 'Pending Drivers', href: '/drivers/pending', icon: UserCheck, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN] },
  { name: 'All Drivers', href: '/drivers', icon: Users, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN, UserRole.SUPPORT_ADMIN] },
  { name: 'Fleet Performance', href: '/drivers/leaderboard', icon: Trophy, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN] },
  
  // LOGISTICS OPERATIONS
  { name: 'Active Orders', href: '/orders', icon: Truck, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN] },
  { name: 'Order History', href: '/order/history', icon: Archive, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN, UserRole.SUPPORT_ADMIN] },
  { name: 'Customer CRM', href: '/customers', icon: Users, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN] },

  // IMPORT LOGISTICS
  { name: 'Shipment Pipeline', href: '/imports', icon: PackageSearch, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN] },
  { name: 'Import Exceptions', href: '/imports/exceptions', icon: ShieldAlert, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN] },
  { name: 'Cargo Partners', href: '/imports/partners', icon: Building2, allowedRoles: [UserRole.SUPER_ADMIN] },

  // FINANCIAL HUB
  { name: 'Payouts', href: '/finance/payouts', icon: DollarSign, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN] },
  { name: 'Deposits', href: '/finance/deposits', icon: Wallet, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN] },
  { name: 'Revenue', href: '/finance/revenue', icon: Banknote, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN] },
  { name: 'System Ledger', href: '/finance/ledger', icon: History, allowedRoles: [UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN] },
  
  // SYSTEM SECURITY & CONTROL
  { name: 'Pending Approvals', href: '/settings/approvals', icon: ShieldCheck, allowedRoles: [UserRole.SUPER_ADMIN] },
  { name: 'Broadcaster', href: '/settings/broadcast', icon: Megaphone, allowedRoles: [UserRole.SUPER_ADMIN] },
  { name: 'Staff Management', href: '/settings/staff', icon: Shield, allowedRoles: [UserRole.SUPER_ADMIN] },
  { name: 'Settings', href: '/settings', icon: Settings, allowedRoles: [UserRole.SUPER_ADMIN] },
];

export const Sidebar = () => {
  const userJson = localStorage.getItem('admin_user');
  const user = userJson ? JSON.parse(userJson) : null;
  const userRoles: string[] = user?.roles || [];

  // 2-MAN RULE: Count actions requiring a second signature
  const { data: pendingActions } = useQuery('pendingActionsCount', actionService.getPending, {
    enabled: userRoles.includes(UserRole.SUPER_ADMIN),
    refetchInterval: 30000, 
  });

  const canSee = (allowedRoles: string[]) => {
    if (allowedRoles.length === 0) return true;
    if (userRoles.includes(UserRole.SUPER_ADMIN)) return true; // God Mode
    return userRoles.some(role => allowedRoles.includes(role));
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col w-72 bg-white border-r border-gray-100 h-screen sticky top-0 z-40">
      <div className="flex items-center gap-3 px-8 h-24">
        <div className="h-10 w-10 bg-brand rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
           <Truck className="text-white" size={22} />
        </div>
        <span className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic">
          Courier<span className="text-brand text-3xl">X</span>
        </span>
      </div>
      
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-hide">
        {navigation
          .filter((item) => canSee(item.allowedRoles))
          .map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) => `
              flex items-center px-4 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 group
              ${isActive 
                ? 'bg-blue-50 text-brand shadow-sm border border-blue-100/50' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
            `}
          >
            {({ isActive }) => (
              <>
                <item.icon className={`mr-3 h-5 w-5 transition-transform group-hover:scale-110 ${isActive ? 'text-brand' : 'text-gray-400'}`} />
                <span className="flex-1">{item.name}</span>

                {/* 2-Man Rule Notification Badge */}
                {item.name === 'Pending Approvals' && pendingActions?.length > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white animate-pulse">
                    {pendingActions.length}
                  </span>
                )}

                {isActive && <div className="h-1.5 w-1.5 rounded-full bg-brand ml-2 shadow-glow" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-50 bg-gray-50/50">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center font-black text-xs">
                {user?.displayName?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 overflow-hidden">
                <p className="text-xs font-black text-gray-900 truncate uppercase tracking-tight">{user?.displayName}</p>
                <p className="text-[10px] font-bold text-gray-400 truncate">
                  {user?.roles?.[0]?.replace('_', ' ')}
                </p>
            </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-3 text-[10px] font-black text-red-500 uppercase tracking-widest rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all border border-transparent hover:border-red-100"
        >
          <LogOut className="mr-3 h-4 w-4" />
          Terminate Session
        </button>
      </div>
    </div>
  );
};