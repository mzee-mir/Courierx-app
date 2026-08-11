import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { importService } from '../api/import.service';
import { ShieldCheck, XCircle, AlertTriangle, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  shipment: any;
  onClose: () => void;
}

export const ResolveExceptionModal = ({ shipment, onClose }: Props) => {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'PROCEED' | 'CANCEL' | null>(null);
  const [note, setNote] = useState('');

  const resolveMutation = useMutation(
    () => importService.resolveException(shipment.id, action!, note),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('flaggedShipments');
        queryClient.invalidateQueries('activeImports');
        toast.success(`Exception Resolved: ${action}`);
        onClose();
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'Resolution failed')
    }
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-4">
          <div className="p-3 bg-red-600 rounded-2xl text-white shadow-lg shadow-red-100">
             <ShieldCheck size={28} />
          </div>
          <div>
            <h2 className="text-xl font-black text-red-900 uppercase italic tracking-tighter">Resolution Protocol</h2>
            <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest">Shipment: {shipment.externalTrackingNumber}</p>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Decision Selector */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Select Outcome</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setAction('PROCEED')}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                  action === 'PROCEED' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-100 text-gray-400 hover:border-gray-200'
                }`}
              >
                <ShieldCheck size={24} />
                <span className="font-bold text-xs">Proceed & Unfreeze</span>
              </button>
              <button 
                onClick={() => setAction('CANCEL')}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                  action === 'CANCEL' ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-100 text-gray-400 hover:border-gray-200'
                }`}
              >
                <XCircle size={24} />
                <span className="font-bold text-xs">Permanent Cancel</span>
              </button>
            </div>
          </div>

          {/* Justification Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Resolution Note (Mandatory)</label>
            <textarea 
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand text-sm font-medium text-gray-700"
              placeholder="Explain why this shipment is being released or cancelled..."
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex gap-3 items-start">
             <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
             <p className="text-[10px] text-blue-700 leading-relaxed font-medium italic">
                Proceeding will re-enable the partner portal for this item. Cancelling will notify the customer and terminate the shipment.
             </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-8 pb-8 flex gap-4">
           <button onClick={onClose} className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600">Cancel</button>
           <button 
             disabled={!action || note.length < 5 || resolveMutation.isLoading}
             onClick={() => resolveMutation.mutate()}
             className={`flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
               !action ? 'bg-gray-200' : action === 'PROCEED' ? 'bg-green-600 hover:bg-green-700 shadow-green-100' : 'bg-red-600 hover:bg-red-700 shadow-red-100'
             }`}
           >
             {resolveMutation.isLoading ? <Loader2 className="animate-spin" /> : 'Execute Resolution'}
           </button>
        </div>
      </div>
    </div>
  );
};