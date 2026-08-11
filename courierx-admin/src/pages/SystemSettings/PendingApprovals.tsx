import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ShieldCheck, XCircle, Clock, User, ArrowRight, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { actionService } from '../../api/action.services';

export const PendingApprovals = () => {
  const queryClient = useQueryClient();
  const currentUser = JSON.parse(localStorage.getItem('admin_user') || '{}');

  const { data: actions, isLoading } = useQuery('pendingActions', actionService.getPending);

  const approveMutation = useMutation(actionService.approve, {
    onSuccess: () => {
      queryClient.invalidateQueries('pendingActions');
      toast.success('Action approved and system updated.');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Approval failed')
  });

  if (isLoading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pending Authorization</h1>
        <p className="text-sm text-gray-500 font-mono">The 2-Man Rule is active. Critical changes require a second signature.</p>
      </div>

      {actions?.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-dashed text-center">
          <ShieldCheck size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-400">No actions currently awaiting approval.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {actions?.map((action: any) => {
            const isInitiator = action.initiatedBy.id === currentUser.id;

            return (
              <div key={action.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  {/* Proposal Metadata */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-50 text-brand text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        {action.actionType.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">REQ: {action.requestId.slice(0,8)}</span>
                    </div>
                    <h3 className="font-bold text-gray-900">Change requested for: {action.payload.key}</h3>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><User size={12}/> {action.initiatedBy.displayName}</span>
                      <span className="flex items-center gap-1"><Clock size={12}/> {formatDistanceToNow(new Date(action.createdAt))} ago</span>
                    </div>
                  </div>

                  {/* The Comparison Box */}
                  <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-6 border border-gray-100">
                     <div className="text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase">Current</p>
                        <p className="font-mono text-sm text-red-500 line-through">---</p>
                     </div>
                     <ArrowRight size={16} className="text-gray-300" />
                     <div className="text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase">Proposed</p>
                        <p className="font-mono text-sm font-bold text-green-600">{JSON.stringify(action.payload.value)}</p>
                     </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 w-full md:w-auto">
                    {isInitiator ? (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 text-xs font-bold">
                        <Info size={14}/> Waiting for a different Admin
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => approveMutation.mutate(action.id)}
                          className="flex-1 bg-brand text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
                        >
                          <ShieldCheck size={18} /> Approve
                        </button>
                        <button className="flex-1 bg-white border border-red-100 text-red-600 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-all">
                          <XCircle size={18} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Reason Footer */}
                <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-50">
                  <p className="text-[10px] text-gray-400 italic">
                    <strong>Justification:</strong> {action.payload.reason}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};