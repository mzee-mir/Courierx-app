import { useQuery } from 'react-query';
import { financeService } from '../../api/finance.service';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { TrendingUp, DollarSign, PieChart, ArrowUpRight, Loader2 } from 'lucide-react';

export const RevenueDashboard = () => {
  const { data, isLoading } = useQuery('revenueStats', () => financeService.getRevenueStats({}));

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-brand" /></div>;

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financial Performance</h1>
        <p className="text-sm text-gray-500">Real-time tracking of platform earnings and volume.</p>
      </div>

      {/* 1. TOP LEVEL STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Gross Merchandise Value</p>
              <h3 className="text-3xl font-black text-gray-900 mt-1">${data.summary.grossVolume.toFixed(2)}</h3>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={20}/></div>
          </div>
          <p className="text-[10px] text-gray-400 mt-4 flex items-center gap-1">
            <ArrowUpRight size={12} className="text-green-500" /> Total cash moved through platform
          </p>
        </div>

        <div className="bg-brand p-6 rounded-2xl shadow-lg shadow-blue-100 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-blue-100 uppercase">Platform Commission (15%)</p>
              <h3 className="text-3xl font-black mt-1">${data.summary.netCommission.toFixed(2)}</h3>
            </div>
            <div className="p-2 bg-white/20 rounded-lg"><TrendingUp size={20}/></div>
          </div>
          <p className="text-[10px] text-blue-100 mt-4">Actual revenue for CourierX</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Total Completed Orders</p>
              <h3 className="text-3xl font-black text-gray-900 mt-1">{data.summary.orderCount}</h3>
            </div>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><PieChart size={20}/></div>
          </div>
          <p className="text-[10px] text-gray-400 mt-4 italic">Excludes cancelled and pending</p>
        </div>             
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 2. REVENUE TREND CHART */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-6">Daily Revenue Trend</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="_id" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="dailyCommission" stroke="#0052FF" strokeWidth={3} dot={{ r: 4, fill: '#0052FF' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. BREAKDOWN BY VEHICLE */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-6">Profitability by Vehicle</h2>
          <div className="space-y-6">
            {data.byVehicle.map((v: any) => (
              <div key={v._id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-gray-700 uppercase tracking-tighter">{v._id}</span>
                  <span className="font-black text-brand">${v.commission.toFixed(2)} profit</span>
                </div>
                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-brand h-full rounded-full" 
                    style={{ width: `${(v.commission / data.summary.netCommission) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase">
                  <span>{v.count} Orders</span>
                  <span>Avg: ${(v.revenue / v.count).toFixed(2)} per trip</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};