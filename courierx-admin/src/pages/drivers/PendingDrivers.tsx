import { useQuery, useMutation, useQueryClient } from 'react-query';
import { driverService } from '../../api/driver.service';
import { Check, X, Eye, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner'; // If you installed sonner for notifications
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { Permission } from '../../config/permissions';

export const PendingDrivers = () => {
  const queryClient = useQueryClient();

  const { data: drivers, isLoading } = useQuery('pendingDrivers', driverService.getPending);

  const mutation = useMutation(
    ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => 
      driverService.verify(id, status),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('pendingDrivers');
        toast.success('Driver status updated');
      },
      onError: () => toast.error('Failed to update driver status')
    }
  );

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl text-black font-bold">Pending Verifications</h1>
        <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-medium">
          {drivers?.length || 0} Applications
        </span>
      </div>

      {drivers?.length === 0 ? (
        <div className="bg-white p-20 rounded-2xl border border-dashed flex flex-col items-center text-gray-400">
          <AlertCircle size={48} className="mb-4" />
          <p>No pending driver applications at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {drivers?.map((driver: any) => (
            <div key={driver._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              {/* Header Info */}
              <div className="p-6 border-b border-gray-50 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold">{driver.fullName}</h3>
                  <p className="text-sm text-gray-500">{driver.userId?.phoneNumber}</p>
                </div>
                <div className="text-right">
                  <span className="uppercase text-[10px] font-bold tracking-widest text-gray-400 block mb-1">Vehicle</span>
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold uppercase">
                    {driver.vehicle?.vehicleType}
                  </span>
                </div>
              </div>

              {/* Document Preview (Photos from Cloudinary) */}
              <div className="p-4 grid grid-cols-2 gap-4 bg-gray-50">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">National ID / Passport</p>
                  <img src={driver.documents?.nationalIdUrl} className="w-full h-32 object-cover rounded-lg border bg-white" alt="ID" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Plate Number: <span className="text-black">{driver.vehicle?.plateNumber}</span></p>
                  <img src={driver.vehicle?.plateImageUrl} className="w-full h-32 object-cover rounded-lg border bg-white" alt="Vehicle" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 flex gap-3 mt-auto">
                <PermissionGuard permission={Permission.VERIFY_DRIVERS}>
                  <button 
                    onClick={() => mutation.mutate({ id: driver.userId._id, status: 'approved' })}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Check size={18} /> Approve
                  </button>
                </PermissionGuard>

                <PermissionGuard permission={Permission.VERIFY_DRIVERS}>
                  <button 
                    onClick={() => mutation.mutate({ id: driver.userId._id, status: 'rejected' })}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <X size={18} /> Reject
                </button>
                </PermissionGuard>
                  
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};