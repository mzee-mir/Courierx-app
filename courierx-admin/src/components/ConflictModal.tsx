import { RefreshCw, AlertCircle, HardDrive } from 'lucide-react';
import { useConflictStore } from '../store/useConflictStore';

export const ConflictModal = () => {
  const { isModalOpen, closeModal } = useConflictStore();

  if (!isModalOpen) return null;

  const handleReload = () => {
    closeModal();
    window.location.reload(); // Hard refresh to get latest __v and data
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-md">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-amber-100 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 animate-bounce-short">
            <RefreshCw size={40} />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">
              Concurrency Conflict
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              This record was modified by <span className="font-bold text-gray-800">another administrator</span> while you were viewing it.
            </p>
          </div>

          <div className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3 text-left">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-600 font-medium">
              To prevent data corruption and accidental overwrites, your recent action was blocked. 
              Please refresh to see the latest system state.
            </p>
          </div>

          <button
            onClick={handleReload}
            className="w-full py-4 bg-brand text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100 flex items-center justify-center gap-2 group"
          >
            <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
            Sync with Live Data
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-50 flex justify-center">
            <div className="flex items-center gap-2 text-[8px] font-black text-gray-300 uppercase tracking-[0.2em]">
                <HardDrive size={10} />
                Module D: Optimistic Locking Active
            </div>
        </div>
      </div>
    </div>
  );
};