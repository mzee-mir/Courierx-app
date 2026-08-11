import { useQuery, useMutation, useQueryClient } from 'react-query';
import { orderService } from '../../api/order.service';
import { MapPin, Phone, User, AlertTriangle, XCircle, Loader2, RefreshCw, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { Permission } from '../../config/permissions';

export const ActiveOrders = () => {
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery('activeOrders', orderService.getActive, {
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const unassignMutation = useMutation(orderService.unassign, {
    onSuccess: () => {
      queryClient.invalidateQueries('activeOrders');
      toast.success('Driver removed. Order reset to PENDING.');
    }
  });

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Operations</h1>
          <p className="text-sm text-gray-500">Monitoring {orders?.length || 0} active deliveries</p>
        </div>
        <button 
          onClick={() => queryClient.invalidateQueries('activeOrders')}
          className="flex items-center gap-2 text-sm font-medium text-brand hover:underline"
        >
          <RefreshCw size={16} /> Force Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {orders?.map((order: any) => (
          <div key={order._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {/* Status Header */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Order #{order._id.slice(-6)}</span>
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="p-6 grid grid-cols-2 gap-8">
              {/* Customer Column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400">
                  <User size={14} /> <span className="text-[10px] font-bold uppercase">Customer</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{order.customerId?.displayName}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone size={12} /> {order.customerId?.phoneNumber}
                  </p>
                </div>
                <div className="pt-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Dropoff Landmark</p>
                  <p className="text-sm text-gray-700 font-medium line-clamp-1">{order.dropoffLandmark}</p>
                </div>
              </div>

              {/* Driver Column */}
              <div className="space-y-3 border-l pl-8">
                <div className="flex items-center gap-2 text-gray-400">
                  <Truck size={14} /> <span className="text-[10px] font-bold uppercase">Driver</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{order.driverId?.displayName}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone size={12} /> {order.driverId?.phoneNumber}
                  </p>
                </div>
                <div className="pt-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Vehicle</p>
                  <span className="text-xs font-bold text-brand">{order.vehicleType}</span>
                </div>
              </div>
            </div>

            {/* Admin Intervention Buttons */}
            <div className="p-4 bg-red-50/30 border-t border-red-50 flex gap-3">
              <PermissionGuard permission={Permission.INTERVENE_ORDERS}>
                <button 
                onClick={() => {
                  if(confirm("Force unassign this driver? The order will go back to PENDING.")) {
                    unassignMutation.mutate(order._id);
                  }
                }}
                className="flex-1 bg-white border border-orange-200 text-orange-600 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-orange-50 transition-colors"
                >
                  <AlertTriangle size={14} /> Force Unassign
                </button>
              </PermissionGuard>
              <PermissionGuard permission={Permission.INTERVENE_ORDERS}>
                <button 
                onClick={() => {
                  const reason = prompt("Enter reason for cancellation:");
                  if(reason) orderService.cancel(order._id, reason);
                }}
                className="flex-1 bg-white border border-red-200 text-red-600 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                >
                  <XCircle size={14} /> Cancel Job
                </button>
              </PermissionGuard>
              
            </div>
          </div>
        ))}

        {orders?.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed">
             <p className="text-gray-400">No active deliveries at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
};