import { useQuery, useMutation, useQueryClient } from 'react-query';
import { importService } from '../../api/import.service';
import { AlertCircle, ShieldAlert, CheckCircle, XCircle, Info, Loader2 } from 'lucide-react';
import { ActionConfirmModal } from '../../components/ui/ActionConfirmModal';
import { useState } from 'react';
import { toast } from 'sonner';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { Permission } from '../../config/permissions';
import { ResolveExceptionModal } from '../../components/ResolveExceptionModal';

export const ExceptionCenter = () => {
  const queryClient = useQueryClient();
  const [selectedShipment, setSelectedShipment] = useState<any>(null);

  const { data: shipments, isLoading } = useQuery('flaggedShipments', importService.getFlaggedShipments);

  const [resolvingShipment, setResolvingShipment] = useState<any>(null)

  const resolveMutation = useMutation(
    ({ id, action, note }: any) => importService.resolveException(id, action, note),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('flaggedShipments');
        toast.success('Shipment resolution logged and unfrozen.');
        setSelectedShipment(null);
      }
    }
  );

  if (isLoading) return <Loader2 className="animate-spin mx-auto mt-20" />;

  return (
    <div className="space-y-6">
      <div className="p-4 bg-red-600 rounded-2xl text-white flex items-center gap-4 shadow-lg shadow-red-100">
        <ShieldAlert size={32} className="animate-pulse" />
        <div>
          <h1 className="text-xl font-bold uppercase italic font-mono">Frozen Inventory (Exceptions)</h1>
          <p className="text-red-100 text-xs font-mono">Required Admin intervention to release or cancel shipments.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {shipments?.map((s: any) => (
          <div key={s.id} className="...">
             {/* ... card content ... */}
             <div className="flex gap-3">
                <button 
                  onClick={() => setResolvingShipment(s)}
                  className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black uppercase italic text-xs hover:bg-black transition-all"
                >
                  Resolve Exception
                </button>
             </div>
          </div>
        ))}
      </div>

      {resolvingShipment && (
        <ResolveExceptionModal 
          shipment={resolvingShipment} 
          onClose={() => setResolvingShipment(null)} 
        />
      )}

      {selectedShipment && (
        <ActionConfirmModal
          isOpen={!!selectedShipment}
          onClose={() => setSelectedShipment(null)}
          title={`Resolve Exception: ${selectedShipment.action}`}
          description={`Provide a detailed justification for the ${selectedShipment.action} action on shipment ${selectedShipment.externalTrackingNumber}.`}
          confirmText="Confirm Resolution"
          isDestructive={selectedShipment.action === 'CANCEL'}
          onConfirm={(reason) => resolveMutation.mutate({ 
            id: selectedShipment.id, 
            action: selectedShipment.action, 
            note: reason 
          })}
        />
      )}
    </div>
  );
};