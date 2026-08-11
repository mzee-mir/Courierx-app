import React, { createContext, useContext, useState, ReactNode } from 'react';
import api from '../api/axios';

interface SudoContextType {
  requireSudo: (action: () => void) => void;
  sudoToken: string | null;
  isModalOpen: boolean;
  closeModal: () => void;
  setSudoToken: (token: string) => void;
}

const SudoContext = createContext<SudoContextType | undefined>(undefined);

export const SudoProvider = ({ children }: { children: ReactNode }) => {
  const [sudoToken, setSudoToken] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireSudo = (action: () => void) => {
    // If we already have a token and it's valid (logic handled by backend 403 otherwise), proceed
    if (sudoToken) {
      action();
    } else {
      setPendingAction(() => action);
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setPendingAction(null);
  };

  const handleSudoSuccess = (token: string) => {
    setSudoToken(token);
    setIsModalOpen(false);
    if (pendingAction) pendingAction();
    setPendingAction(null);

    // Auto-clear token after 5 minutes
    setTimeout(() => setSudoToken(null), 5 * 60 * 1000);
  };

  return (
    <SudoContext.Provider value={{ requireSudo, sudoToken, isModalOpen, closeModal, setSudoToken: handleSudoSuccess }}>
      {children}
    </SudoContext.Provider>
  );
};

export const useSudo = () => {
  const context = useContext(SudoContext);
  if (!context) throw new Error('useSudo must be used within a SudoProvider');
  return context;
};