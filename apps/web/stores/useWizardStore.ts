'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface WizardFile {
  name: string;
  mime: string;
  size: number;
  /** Raw bytes — held in memory only, never persisted (no-plaintext rule). */
  bytes: Uint8Array;
}

export interface WizardState {
  step: number; // 1..5
  // Step 1 — payload (NOT persisted)
  text: string;
  files: WizardFile[];
  // Step 2 — conditions
  inactivitySeconds: number;
  guardiansEnabled: boolean;
  guardianAddresses: string[];
  guardianQuorum: number;
  // Step 3 — beneficiary
  beneficiaryEmail: string;
  // Step 4 — recovery
  backupKeyEnabled: boolean;

  setField: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  next: () => void;
  back: () => void;
  goTo: (step: number) => void;
  addFile: (file: WizardFile) => void;
  removeFile: (name: string) => void;
  reset: () => void;
}

const INITIAL = {
  step: 1,
  text: '',
  files: [] as WizardFile[],
  inactivitySeconds: 30 * 86400, // 30 days default
  guardiansEnabled: false,
  guardianAddresses: [] as string[],
  guardianQuorum: 1,
  beneficiaryEmail: '',
  backupKeyEnabled: false,
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setField: (key, value) => set({ [key]: value } as Partial<WizardState>),
      next: () => set((s) => ({ step: Math.min(5, s.step + 1) })),
      back: () => set((s) => ({ step: Math.max(1, s.step - 1) })),
      goTo: (step) => set({ step: Math.max(1, Math.min(5, step)) }),
      addFile: (file) =>
        set((s) => ({ files: [...s.files.filter((f) => f.name !== file.name), file] })),
      removeFile: (name) => set((s) => ({ files: s.files.filter((f) => f.name !== name) })),
      reset: () => set({ ...INITIAL }),
    }),
    {
      name: 'keepra-wizard',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.sessionStorage : (undefined as unknown as Storage),
      ),
      // Never persist plaintext or file bytes — only the non-sensitive config.
      partialize: (s) => ({
        step: s.step,
        inactivitySeconds: s.inactivitySeconds,
        guardiansEnabled: s.guardiansEnabled,
        guardianAddresses: s.guardianAddresses,
        guardianQuorum: s.guardianQuorum,
        beneficiaryEmail: s.beneficiaryEmail,
        backupKeyEnabled: s.backupKeyEnabled,
      }),
    },
  ),
);
