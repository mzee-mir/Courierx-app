import { useQuery } from 'react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { userService } from '../../api/user.service';
import { ChevronLeft, Loader2, Crown, Download, ShoppingBag, Phone, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';

export const VIPMasterlist = () => {
  const [searchParams] = useSearchParams();
  
  // Use 'data' which will be the object { success, data, pagination }
  const { data, isLoading, isError } = useQuery(['vips', searchParams.toString()], () => 
    userService.getVIPs(Object.fromEntries(searchParams))
  );

  // 1. ADD THIS GUARD: If loading, don't try to render the table yet
  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-brand h-10 w-10" />
      </div>
    );
  }

  // 2. ADD THIS GUARD: Handle errors
  if (isError || !data) {
    return <div className="p-10 text-red-500 text-center">Failed to load VIP data.</div>;
  }


  return (
    <div className="space-y-6 p-6">
      {/* 1. Breadcrumbs & Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link to="/customers" className="text-xs pb-5 font-bold text-gray-600 flex items-center gap-1 hover:text-brand transition-colors">
            <ChevronLeft size={14} /> Back to Insights
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="text-amber-500" /> VIP Merchant Leaderboard
          </h1>
        </div>
        <button className="mt-5 flex items-center text-gray-800 gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50">
          <Download size={16} /> Export for WhatsApp
        </button>
      </div>

      {/* 2. Data Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <th className="px-6 py-4">Customer Details</th>
              <th className="px-6 py-4">Order Frequency</th>
              <th className="px-6 py-4">Gross Revenue</th>
              <th className="px-6 py-4">Last Activity</th>
              <th className="px-6 py-4 text-right">Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.data?.map((vip: any, index: number) => (
              <tr key={vip._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-300">#{index + 1}</span>
                    <div>
                      <p className="font-bold text-gray-900">{vip.user.displayName}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10}/> {vip.user.phoneNumber}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={14} className="text-gray-400" />
                    <span className="font-bold">{vip.orderCount}</span>
                    <span className="text-xs text-gray-400">Total Orders</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-black text-brand">${vip.totalSpent.toFixed(2)}</p>
                  <p className="text-[10px] text-green-600 font-bold">Avg: ${vip.avgOrderValue.toFixed(2)}</p>
                </td>
                <td className="px-6 py-4 text-xs text-gray-500">
                  {format(new Date(vip.lastOrderDate), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 text-right">
                   <Link to={`/customers/${vip._id}`} className="p-2 hover:bg-blue-50 rounded-lg inline-block text-brand">
                     <ArrowUpRight size={18} />
                   </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 bg-gray-50 text-xs text-gray-400">
           Page {data.pagination?.page} of {data.pagination?.pages}
        </div>
      </div>
    </div>
  );
};