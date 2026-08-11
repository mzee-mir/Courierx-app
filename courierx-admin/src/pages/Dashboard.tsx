import { useQuery } from 'react-query';
import api from '../api/axios';
import { 
  Truck, Wallet, Activity, AlertCircle, 
  TrendingUp, Users, Map as MapIcon, Loader2, 
  RefreshCcw
} from 'lucide-react';
import { LiveOperationsMap } from '../components/maps/LiveOperationsMap';

export const Dashboard = () => {
  // 1. Fetch Today's Pulse (Fast polling every 20s)
  const { data: pulse, isLoading, isError } = useQuery('dailyPulse', async () => {
    const res = await api.get('/admin/stats/daily-pulse');
    return res.data.data;
  }, { refetchInterval: 20000 });

  if (isLoading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-brand" /></div>;
  
  if (isError || !pulse) return <div className="p-10 text-red-500">Connection to Pulse API lost.</div>;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* --- TOP ROW: TODAY'S PERFORMANCE --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-brand rounded-[2rem] p-6 text-white shadow-xl shadow-blue-100">
           <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Commission (Today)</p>
           <h3 className="text-3xl font-black mt-1">${pulse?.profitToday?.toFixed(2) || '0.00'}</h3>
           <div className="mt-4 flex items-center gap-2 text-[10px] font-bold bg-white/10 w-fit px-2 py-1 rounded-lg">
             <TrendingUp size={12}/> Net Profit
           </div>
        </div>

        <StatMiniCard title="Active Jobs" value={pulse.ordersToday} icon={<Truck size={20}/>} color="text-blue-600" />
        <StatMiniCard title="Gross Volume" value={`$${pulse.revenueToday.toFixed(0)}`} icon={<Activity size={20}/>} color="text-green-600" />
        
        <div className={`rounded-[2rem] p-6 border-2 transition-all ${pulse.alertCount > 0 ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-white border-gray-100'}`}>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Alerts</p>
           <h3 className={`text-3xl font-black mt-1 ${pulse.alertCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{pulse.alertCount}</h3>
           {pulse.alertCount > 0 && <p className="text-[9px] font-bold text-red-500 uppercase mt-2">Action Required</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* --- LEFT: LIVE MAP (Main Center) --- */}
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white p-2 rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden relative">
            <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-gray-100 flex items-center gap-2">
               <div className="h-2 w-2 bg-green-500 rounded-full animate-ping" />
               <span className="text-[10px] font-black uppercase tracking-tighter text-gray-700">Live Fleet Distribution</span>
            </div>
            <LiveOperationsMap />
          </div>
        </div>

        {/* --- RIGHT: FLEET STATUS & QUICK ACTIONS --- */}
        <div className="space-y-6">
           <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white space-y-8">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Fleet Availability</h2>
              
              <div className="space-y-6">
                {['bajaj', 'car', 'truck'].map(type => {
                  const count = pulse.fleetBreakdown.find((f: any) => f._id === type)?.count || 0;
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-white/5 rounded-xl text-brand uppercase font-black text-[10px]">{type}</div>
                         <span className="text-sm font-bold capitalize">{type}s Online</span>
                      </div>
                      <span className="text-xl font-black">{count}</span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-8 border-t border-white/5">
                 <button className="w-full py-4 bg-brand text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2">
                   <Users size={16} /> Manage All Drivers
                 </button>
              </div>
           </div>

           <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm space-y-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quick Terminal Control</h3>
              <div className="grid grid-cols-2 gap-3">
                 <QuickButton label="Force Map Sync" icon={<RefreshCcw size={14}/>} />
                 <QuickButton label="System Broadcast" icon={<Activity size={14}/>} />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// Sub-components
const StatMiniCard = ({ title, value, icon, color }: any) => (
  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
    <div className={`p-3 rounded-2xl bg-gray-50 ${color}`}>{icon}</div>
    <div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</p>
      <h3 className="text-2xl font-black text-gray-900">{value}</h3>
    </div>
  </div>
);

const QuickButton = ({ label, icon }: any) => (
  <button className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all border border-gray-100">
    <div className="text-gray-400">{icon}</div>
    <span className="text-[9px] font-black uppercase text-gray-600 text-center">{label}</span>
  </button>
);