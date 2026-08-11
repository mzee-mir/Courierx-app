import { useState } from 'react';
import { useSudo } from '../store/SudoContext';
import { importService } from '../api/import.service';
import { toast } from 'sonner';
import { ActionConfirmModal } from './ui/ActionConfirmModal';

export const BreakGlassOverride = ({ shipmentId, currentStatus }: any) => {
  const { requireSudo } = useSudo();
  const [isOpen, setIsOpen] = useState(false);

  const handleForceUpdate = (reason: string) => {
    requireSudo(async () => {
      try {
        await importService.forceState(shipmentId, 'ARRIVED_LOCAL', reason);
        toast.success('System Invariant Bypassed: State Forced.');
        setIsOpen(false);
      } catch (e) {
        toast.error('Bypass Failed');
      }
    });
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="text-[10px] font-black text-red-600 uppercase hover:underline"
      >
        Emergency Force State
      </button>
      
      <ActionConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="DANGER: FSM BYPASS"
        description="You are about to manually override the state machine. This will be logged as a HIGH-SEVERITY audit event."
        confirmText="Execute Force State"
        isDestructive={true}
        onConfirm={handleForceUpdate}
      />
    </>
  );
};