import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { driverService } from '../../api/driver.service';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { ActionConfirmModal } from '../../components/ui/ActionConfirmModal';
import { DocumentViewer } from '../../components/DocumentViewer';
import { CheckCircle, XCircle, Truck, ShieldAlert, Loader2, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { Permission } from '../../config/permissions';

export const DriverDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [viewingDoc, setViewingDoc] = useState<{url: string, title: string} | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  const { data, isLoading } = useQuery(['driverDetail', id], () => driverService.getFullDetail(id!));

  // MUTATIONS
  const approveMutation = useMutation(() => driverService.approveDriver(id!), {
    onSuccess: () => {
      queryClient.invalidateQueries('driverDetail');
      toast.success('Driver approved for operations');
    }
  });

  const rejectMutation = useMutation((reason: string) => driverService.rejectDriver(id!, reason), {
    onSuccess: () => {
      queryClient.invalidateQueries('driverDetail');
      setRejectModalOpen(false);
      toast.error('Application rejected');
    }
  });

  if (isLoading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-brand" /></div>;
  const { user, profile, stats } = data;

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-6">
          <img src={profile?.imageUrl} className="w-20 h-20 rounded-2xl object-cover" />
          <div>
            <h1 className="text-2xl font-black text-gray-900">{profile?.fullName}</h1>
            <div className="flex gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                profile?.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-orange-50 text-orange-700 border-orange-100'
              }`}>
                {profile?.status}
              </span>
            </div>
          </div>
        </div>

        {/* 👈 ACTION GATING */}
        <PermissionGuard permission={Permission.VERIFY_DRIVERS}>
          <div className="flex gap-3">
            {profile?.status === 'pending' && (
              <>
                <button 
                  onClick={() => approveMutation.mutate()}
                  className="bg-brand text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all"
                >
                  <CheckCircle size={18} /> Approve Application
                </button>
                <button 
                  onClick={() => setRejectModalOpen(true)}
                  className="bg-white border border-red-100 text-red-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-50 transition-all"
                >
                  <XCircle size={18} /> Reject
                </button>
              </>
            )}
          </div>
        </PermissionGuard>
      </div>

      {/* DOCUMENT GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-gray-100 space-y-4">
          <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">Identity Documents</h3>
          <div className="relative group cursor-pointer" onClick={() => setViewingDoc({url: profile?.documents?.nationalIdUrl, title: 'National ID'})}>
            <img src={profile?.documents?.nationalIdUrl} className="w-full h-48 object-cover rounded-2xl border" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
              <Maximize2 className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">Vehicle Assignment</h3>
            {/* 👈 VEHICLE DROPDOWN */}
            <select 
              defaultValue={profile?.vehicle?.vehicleType}
              onChange={(e) => driverService.assignVehicle(id!, e.target.value)}
              className="text-xs font-bold bg-gray-50 border-none rounded-lg p-2 outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="bajaj">BAJAJ (Tuk-Tuk)</option>
              <option value="car">CAR (Sedan)</option>
              <option value="truck">TRUCK (Logistics)</option>
            </select>
          </div>
          <div className="relative group cursor-pointer" onClick={() => setViewingDoc({url: profile?.vehicle?.plateImageUrl, title: 'License Plate'})}>
            <img src={profile?.vehicle?.plateImageUrl} className="w-full h-48 object-cover rounded-2xl border" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
              <Maximize2 className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <DocumentViewer 
        url={viewingDoc?.url || ''} 
        title={viewingDoc?.title || ''} 
        onClose={() => setViewingDoc(null)} 
      />

      <ActionConfirmModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        onConfirm={(reason) => rejectMutation.mutate(reason)}
        title="Reject Driver Application"
        description="This will notify the driver that their application was unsuccessful. Please provide a clear reason."
        confirmText="Confirm Rejection"
        isDestructive={true}
        isLoading={rejectMutation.isLoading}
      />
    </div>
  );
};