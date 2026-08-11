import { useState } from 'react';
import { useQuery } from 'react-query';
import { driverService } from '../../api/driver.service';
import { 
  Trophy, AlertCircle, TrendingUp, 
  Truck, User as UserIcon, Loader2, Star 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const DriverLeaderboard = () => {
  const [filters, setFilters] = useState({ vehicleType: '', startDate: '', endDate: '' });
  const { data, isLoading } = useQuery(['driverLeaderboard', filters], () => driverService.getLeaderboard(filters));
  const navigate = useNavigate();

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-brand" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Performance</h1>
          <p className="text-sm text-gray-500">Track your most productive and highest-risk operators.</p>
        </div>
        {/* Filter UI (Reuse the same from Customer Insights) */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 1. TOP EARNERS (The Superstars) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-green-50/50 border-b border-green-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="text-green-600" size={20} />
              <h2 className="font-bold text-green-900">Top Earners</h2>
            </div>
            <span className="text-[10px] font-black uppercase text-green-600">Earnings (USD)</span>
          </div>
          <div className="divide-y divide-gray-50">
            {data?.topEarners.map((driver: any, index: number) => (
              <div 
                key={driver._id} 
                onClick={() => navigate(`/drivers/${driver._id}`)}
                className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4">#{index+1}</span>
                  <div className="h-8 w-8 rounded-full bg-gray-100 overflow-hidden">
                    {driver.profile?.imageUrl ? <img src={driver.profile.imageUrl} className="w-full h-full object-cover"/> : <UserIcon className="m-2" size={16}/>}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900">{driver.user.displayName}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{driver.profile.vehicle.vehicleType} • {driver.profile.vehicle.plateNumber}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-green-600">${driver.totalEarnings.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400">{driver.completedJobs} Jobs</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. CANCELLATION RISK (The Friction) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-red-50/50 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-600" size={20} />
              <h2 className="font-bold text-red-900">High Cancellation Risk</h2>
            </div>
            <span className="text-[10px] font-black uppercase text-red-600">Cancellations</span>
          </div>
          <div className="divide-y divide-gray-50">
            {data?.highRisk.map((driver: any) => (
              <div key={driver._id} className="p-4 flex items-center justify-between hover:bg-red-50/10">
                <div>
                  <p className="font-bold text-sm text-gray-900">{driver.user.displayName}</p>
                  <p className="text-[10px] text-gray-400">Success Rate: {driver.successRate.toFixed(0)}%</p>
                </div>
                <div className="flex flex-col items-end">
                   <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">
                     {driver.cancelledJobs} Cancels
                   </span>
                   <Link to={`/drivers/${driver._id}`} className="text-[10px] text-brand font-bold mt-1 hover:underline">Investigate</Link>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};