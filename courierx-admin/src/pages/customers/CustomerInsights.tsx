import { useQuery } from 'react-query';
import { userService } from '../../api/user.service';
import { 
  Crown, AlertTriangle, UserMinus, 
  Phone, Calendar, ArrowRight, Loader2, 
  TrendingUp,
  Truck,
  RefreshCcw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns'; // Great for "34 days ago"
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const CustomerInsights = () => {

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    vehicleType: ''
  });

  // Helper to keep filters when navigating
  const navigateWithFilters = (path: string) => {
    navigate(`${path}?${searchParams.toString()}`);
  };

  const { data, isLoading, isError, refetch } = useQuery(
    ['customerInsights', filters], 
    () => userService.getInsights(filters)
  );

  // 1. Safety Guard: Handle Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <Loader2 className="animate-spin text-brand h-10 w-10 mb-4" />
        <p className="text-gray-500">Generating behavioral insights...</p>
      </div>
    );
  }

  // 2. Safety Guard: Handle Error or Empty Data
  if (isError || !data) {
    return (
      <div className="p-10 bg-red-50 text-red-600 rounded-2xl border border-red-100">
        <p className="font-bold">Error Loading Insights</p>
        <p className="text-sm">Please check your connection to the backend.</p>
      </div>
    );
  }

  // 3. NOW it is safe to destructure because we know 'data' exists
  const { vips, risk, dormant } = data;
  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Insights</h1>
          <p className="text-sm text-gray-500">Filter by time and vehicle to find trends.</p>
        </div>
        
        {/* 2. THE FILTER BAR */}
          <div className="flex flex-wrap items-center gap-3 bg-gray-300 p-3 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 border-r pr-3">
              <Calendar size={16} className="text-gray-600" />
              <input 
                type="date" 
                className="text-xs outline-none text-gray-700 bg-transparent"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              />
              <span className="text-gray-700">-</span>
              <input 
                type="date" 
                className="text-xs outline-none text-gray-700 bg-transparent"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              />
            </div>

            <div className="flex items-center gap-2">
              <Truck size={16} className="text-gray-700" />
              <select 
                className="text-xs text-gray-700 font-bold outline-none bg-transparent cursor-pointer"
                value={filters.vehicleType}
                onChange={(e) => setFilters({...filters, vehicleType: e.target.value})}
              >
                <option value="">All Vehicles</option>
                <option value="bajaj">Bajaj</option>
                <option value="car">Car</option>
                <option value="truck">Truck</option>
              </select>
            </div>

            <button 
              onClick={() => setFilters({ startDate: '', endDate: '', vehicleType: '' })}
              className="p-2 hover:bg-gray-50 rounded-lg text-gray-400"
              title="Reset Filters"
            >
              <RefreshCcw size={14} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 1. VIP LEADERBOARD (Top Spenders) */}
        <div onClick={() => navigateWithFilters('/customers/vips')} className="bg-white cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-blue-50/50 border-b border-blue-100 flex items-center gap-3">
            <Crown className="text-blue-600" size={20} />
            <h2 className="font-bold text-blue-900">Top VIPs</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {vips.map((item: any) => (
              <div key={item._id} className="p-4 flex items-center justify-between hover:bg-gray-50/50">
                View Full Leaderboard <ArrowRight size={12}/>
                <div>
                  <p className="font-bold text-sm text-gray-900">{item.user.displayName}</p>
                  <p className="text-[10px] text-gray-400">Avg Order: ${item.avgOrderValue.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-brand">${item.totalSpent.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400">{item.orderCount} Orders</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. DORMANT VIPS (The "Retention" List) */}
        <div onClick={() => navigateWithFilters('/customers/dormant')} className="bg-white cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-t-4 border-t-amber-400">
          <div className="p-6 bg-amber-50/50 border-b border-amber-100 flex items-center gap-3">
            <UserMinus className="text-amber-600" size={20} />
            <h2 className="font-bold text-amber-900">At-Risk (Dormant)</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {dormant.map((item: any) => (
              <div key={item._id} className="p-4 space-y-3 hover:bg-amber-50/20">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm text-gray-900">{item.user.displayName}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                       <Phone size={10}/> {item.user.phoneNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-600">
                      {formatDistanceToNow(new Date(item.lastDate))} ago
                    </p>
                    <p className="text-[10px] text-gray-400">LTV: ${item.totalSpent.toFixed(2)}</p>
                  </div>
                </div>
                {/* ACTION: Call to win them back */}
                <button className="w-full py-2 bg-white border border-amber-200 text-amber-700 text-[10px] font-bold uppercase rounded-lg hover:bg-amber-50 flex items-center justify-center gap-2">
                  Contact to Win Back <ArrowRight size={12}/>
                </button>
              </div>
            ))}
            {dormant.length === 0 && (
              <div className="p-10 text-center text-gray-400 text-xs italic">No high-value customers are currently dormant.</div>
            )}
          </div>
        </div>

        {/* 3. RISK WATCHLIST (Problematic Accounts) */}
        <div onClick={() => navigateWithFilters('/customers/risk')} className="bg-white cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-red-50/50 border-b border-red-100 flex items-center gap-3">
            <AlertTriangle className="text-red-600" size={20} />
            <h2 className="font-bold text-red-900">Risk Watchlist</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {risk.map((item: any) => (
              <div key={item._id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-gray-900">{item.user.displayName}</p>
                  <p className="text-[10px] text-gray-400">Issues: {item.issueCount}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-red-500 uppercase">
                    {item.disputeCount} Disputes / {item.cancellationCount} Cancels
                  </span>
                  <button className="mt-1 text-blue-600 text-[10px] font-bold hover:underline">View History</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        

    

      {/* REVENUE GROWTH TREND (PLACEHOLDER) */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp size={18} className="text-green-600" />
          <h2 className="font-bold text-gray-900">Monthly Loyalty Snapshot</h2>
        </div>
        <div className="h-32 bg-gray-50 rounded-xl border border-dashed flex items-center justify-center text-gray-400 text-sm italic">
          Future: Chart showing growth in repeat vs. new customers.
        </div>
      </div>
    </div>
    )}
    </div>
  );
}