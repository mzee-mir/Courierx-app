import { useState } from 'react';
import { useQuery } from 'react-query';
import { orderService } from '../../api/order.service';
import { Search, Calendar, Filter, Archive, Download, User, Truck, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { Permission } from '../../config/permissions';
import { SearchFilterBar } from '../../components/SearchFilterBar';

export const OrderHistory = () => {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    startDate: '',
    endDate: '',
    page: 1
  });

  const [params, setParams] = useState({ page: 1 });
  const { data, isLoading } = useQuery(['orderHistory', params], () => orderService.getHistory(params));

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Archive className="text-gray-400" /> Order Archive
        </h1>

        <div className="bg-brand/5 text-brand px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-brand/10">
          Total Records: {data?.pagination?.total || 0}
        </div>
        
        <PermissionGuard permission={Permission.INTERVENE_ORDERS}>
          <button className="flex items-center text-black gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all">
            <Download size={16} /> Export CSV
          </button>
        </PermissionGuard>
        
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative text-gray-600 col-span-1 md:col-span-1">
          <SearchFilterBar 
            placeholder="Search by Name, Phone (+252...), or Order ID"
            showStatusFilter={true}
            onFilterChange={(f) => setParams({ ...params, ...f, page: 1 })}
          />
        </div>
        
        <select 
          className="bg-gray-100 border text-gray-900 border-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value, page: 1})}
        >
          <option value="">All Past Statuses</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <input 
          type="date" 
          className="bg-gray-400 text-gray-900 border border-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          value={filters.startDate}
          onChange={(e) => setFilters({...filters, startDate: e.target.value, page: 1})}
        />

        <input 
          type="date" 
          className="bg-gray-400 text-gray-900 border border-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          value={filters.endDate}
          onChange={(e) => setFilters({...filters, endDate: e.target.value, page: 1})}
        />
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Order ID</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Driver</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand" /></td></tr>
            ) : data?.orders.map((order: any) => (
              <tr key={order._id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <p className="font-mono text-xs text-gray-400 group-hover:text-brand font-bold transition-colors">
                    #{order._id.slice(-8).toUpperCase()}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <p className="font-bold text-gray-900 text-sm">{order.customerId?.displayName}</p>
                  <p className="text-[10px] text-gray-400">{order.customerId?.phoneNumber}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="font-bold text-gray-700 text-sm">{order.driverId?.displayName || 'N/A'}</p>
                  <p className="text-[10px] text-gray-400">{order.driverId?.phoneNumber || 'N/A'}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="font-bold text-gray-900">${order.price.toFixed(2)}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                    order.status === 'DELIVERED' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-xs text-gray-400">
                  {format(new Date(order.createdAt), 'MMM d, yyyy')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* PAGINATION */}
        <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
          <span className="text-xs text-gray-500 font-medium">
            Total {data?.pagination.total} orders found
          </span>
          <div className="flex gap-2">
             <button 
               disabled={filters.page === 1}
               onClick={() => setFilters({...filters, page: filters.page - 1})}
               className="p-2 bg-white border rounded-lg disabled:opacity-30"
             >
               <ChevronLeft size={16} />
             </button>
             <button 
               disabled={filters.page === data?.pagination.pages}
               onClick={() => setFilters({...filters, page: filters.page + 1})}
               className="p-2 bg-white border rounded-lg disabled:opacity-30"
             >
               <ChevronRight size={16} />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};