import React, { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface ActionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description: string;
  confirmText: string;
  isDestructive?: boolean; // Red button for Ban/Cancel, Blue for others
  isLoading?: boolean;
}

export const ActionConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  isDestructive = true,
  isLoading = false
}: ActionConfirmModalProps) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertTriangle className={isDestructive ? 'text-red-500' : 'text-blue-500'} size={20} />
            <h3 className="font-bold text-gray-900">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">{description}</p>
          
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Reason for this action</label>
            <textarea
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand text-sm min-h-[100px]"
              placeholder="Explain why you are performing this action..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || isLoading}
            className={`flex-1 px-4 py-2 text-sm font-bold text-white rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
              isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-blue-700'
            }`}
          >
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};