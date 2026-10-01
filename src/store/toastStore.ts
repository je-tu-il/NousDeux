import { create } from 'zustand';

interface ToastState {
  visible: boolean;
  message: string;
  showToast: (message: string) => void;
  hideToast: () => void;
}

let timeoutId: any = null;

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',
  showToast: (message: string) => {
    if (timeoutId) clearTimeout(timeoutId);
    set({ visible: true, message });
    timeoutId = setTimeout(() => {
      set({ visible: false, message: '' });
      timeoutId = null;
    }, 2000);
  },
  hideToast: () => {
    if (timeoutId) clearTimeout(timeoutId);
    set({ visible: false, message: '' });
  },
}));
