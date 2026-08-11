import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { userService } from '../../api/user.service';
import { 
  ChevronLeft, AlertTriangle, ShieldAlert, 
  History, Phone, Ban, CheckCircle, Loader2, Info 
} from 'lucide-react';
import { format } from 'date-fns';
import { ActionConfirmModal } from '../../components/ui/ActionConfirmModal';
import { toast } from 'sonner';

export const RiskInvestigation = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; userId: string | null; name: string }>({
    isOpen: false,
    userId: null,
    name: ''
  });

  const { data, isLoading } = useQuery(['riskList', searchParams.toString()], () => 
    userService.getRisk(Object.fromEntries(searchParams))
  );

  const statusMutation = useMutation(
    ({ id, suspended, reason }: { id: string, suspended: boolean, reason: string }) => 
      userService.toggleStatus(id, suspended, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('riskList');
        toast.success('Account status updated');
        setModalConfig({ ...modalConfig, isOpen: false });
      }
    }
  );

  // Helper to determine risk level color
  const getRiskLevel = (count: number) => {
    if (count > 10) return { label: 'CRITICAL', color: 'bg-red-100 text-red-700 border-red-200' };
    if (count > 5) return { label: 'HIGH', color: 'bg-orange-100 text-orange-700 border-orange-200' };
    return { label: 'ELEVATED', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6 p-6">
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link to="/customers" className="text-xs font-bold text-gray-600 pb-5 flex items-center gap-1 hover:text-brand transition-colors">
            <ChevronLeft size={14} /> Back to Insights
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="text-red-600" /> Risk Investigation Bureau
          </h1>
        </div>
      </div>

      <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
        <Info className="text-red-400 mt-0.5" size={18} />
        <p className="text-xs text-red-800 leading-relaxed">
          The accounts listed below have exceeded the standard threshold for disputes or cancellations. 
          Please review their order history before performing a suspension.
        </p>
      </div>

      {/* 2. Risk Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Risk Level</th>
              <th className="px-6 py-4">Issue Breakdown</th>
              <th className="px-6 py-4">Last Event</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data?.data.map((item: any) => {
              const risk = getRiskLevel(item.totalIssues);
              return (
                <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900">{item.user.displayName}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Phone size={10}/> {item.user.phoneNumber}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black border ${risk.color}`}>
                      {risk.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-4">
                       <div>
                         <p className="text-xs font-bold text-gray-900">{item.disputeCount}</p>
                         <p className="text-[9px] text-gray-400 uppercase font-bold">Disputes</p>
                       </div>
                       <div className="border-l pl-4">
                         <p className="text-xs font-bold text-gray-900">{item.cancelCount}</p>
                         <p className="text-[9px] text-gray-400 uppercase font-bold">Cancels</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {format(new Date(item.lastIssueDate), 'MMM dd, HH:mm')}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Link 
                      to={`/customers/${item._id}`} 
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline p-2"
                    >
                      <History size={14} /> History
                    </Link>
                    <button 
                      onClick={() => setModalConfig({ 
                        isOpen: true, 
                        userId: item._id, 
                        name: item.user.displayName 
                      })}
                      className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-all"
                    >
                      <Ban size={14} className="inline mr-1" /> Suspend
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. Suspension Modal */}
      <ActionConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={`Suspend ${modalConfig.name}`}
        description="Suspended users cannot place new orders or deposit funds. This action will be recorded in the system audit log."
        confirmText="Confirm Suspension"
        isDestructive={true}
        isLoading={statusMutation.isLoading}
        onConfirm={(reason) => {
          if (modalConfig.userId) {
            statusMutation.mutate({ id: modalConfig.userId, suspended: true, reason });
          }
        }}
      />
    </div>
  );
};