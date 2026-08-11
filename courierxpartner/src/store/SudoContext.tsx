import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';


interface SudoContextType {
  requireSudo: (action: () => void, name: string) => void;
  sudoToken: string | null;
  isModalOpen: boolean;
  actionName: string;
  closeModal: () => void;
  authorize: (token: string) => void;
}


const SudoContext = createContext<SudoContextType | undefined>(undefined);


export const SudoProvider = ({ children }: { children: ReactNode }) => {
  const [sudoToken, setSudoToken] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionName, setActionName] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);


  const requireSudo = useCallback((action: () => void, name: string) => {
    const token = sessionStorage.getItem('sudo_token');
    if (token) {
      action();
    } else {
      setPendingAction(() => action);
      setActionName(name);
      setIsModalOpen(true);
    }
  }, []);


  const closeModal = () => {
    setIsModalOpen(false);
    setPendingAction(null);
  };


  const authorize = (token: string) => {
    setSudoToken(token);
    sessionStorage.setItem('sudo_token', token);
    setIsModalOpen(false);
    if (pendingAction) pendingAction();
    setPendingAction(null);
  };


  return (
    <SudoContext.Provider value={{ requireSudo, sudoToken, isModalOpen, actionName, closeModal, authorize }}>
      {children}
    </SudoContext.Provider>
  );
};


export const useSudo = () => {
  const context = useContext(SudoContext);
  if (!context) throw new Error('useSudo must be used within a SudoProvider');
  return context;
};
