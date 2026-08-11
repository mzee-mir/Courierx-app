import React, { useState } from 'react';
import { Lock, ShieldAlert, Loader2, X } from 'lucide-react';
import { authService } from '../../api/auth.service';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sudoToken: string) => void;
  actionName: string;
}

export const SudoChallengeModal = ({ isOpen, onClose, onSuccess, actionName }: Props) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await authService.verifySudo(password);
      sessionStorage.setItem('sudo_token', token); // Store in sessionStorage (clears on tab close)
      onSuccess(token);
    } catch (err) {
      toast.error('Verification failed. Incorrect password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600">
            <Lock size={32} />
          </div>
          
          <h2 className="text-2xl font-black text-gray-900 uppercase italic">Confirm Authority</h2>
          <p className="text-gray-500 text-sm">
            You are attempting to: <span className="font-bold text-gray-800">{actionName}</span>. 
            Please re-enter your password to proceed.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <input
              type="password"
              autoFocus
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 text-center text-lg tracking-widest"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
              <button
                disabled={loading || !password}
                className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Authorize Action'}
              </button>
            </div>
          </form>
        </div>
        
        <div className="bg-red-50 p-4 flex items-center gap-3 border-t border-red-100">
          <ShieldAlert size={18} className="text-red-600" />
          <p className="text-[10px] text-red-800 font-bold uppercase tracking-tighter">
            This action is permanent and will be logged to your specific ID.
          </p>
        </div>
      </div>
    </div>
  );
};