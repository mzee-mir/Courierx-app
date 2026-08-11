import React, { useState } from 'react';
import { useSudo } from '../../store/SudoContext';
import { Lock, ShieldAlert, Loader2, X } from 'lucide-react';
import api from '../../api/axios';

export const SudoModal = () => {
  const { isModalOpen, closeModal, setSudoToken } = useSudo();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/verify-sudo', { password });
      setSudoToken(data.sudoToken);
      setPassword('');
    } catch (err: any) {
      setError('Invalid password. Sudo access denied.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-red-100 overflow-hidden">
        <div className="bg-red-50 p-6 flex flex-col items-center gap-2 border-b border-red-100">
          <div className="p-3 bg-red-600 rounded-2xl text-white shadow-lg shadow-red-200">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-xl font-black text-red-900 uppercase italic">Sudo Mode Required</h2>
          <p className="text-[10px] text-red-600 font-bold text-center">
            You are attempting a sensitive administrative action. <br/> Re-verify your identity to proceed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded-lg text-center border border-red-100">{error}</p>}
          
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
            <input
              autoFocus
              type="password"
              placeholder="Confirm Admin Password"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={isLoading}
              type="submit"
              className="flex-[2] bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-100 flex justify-center items-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Unlock Sudo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};