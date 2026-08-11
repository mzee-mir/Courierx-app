import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface SettingsState {
    scannerBeep: boolean;
    scannerVibrate: boolean;
    setScannerBeep: (val: boolean) => void;
    setScannerVibrate: (val: boolean) => void;
}


export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            scannerBeep: true,
            scannerVibrate: true,
            setScannerBeep: (scannerBeep) => set({ scannerBeep }),
            setScannerVibrate: (scannerVibrate) => set({ scannerVibrate }),
        }),
        { name: 'terminal-preferences' }
    )
);
