import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingState {
  uid: string | null;
  pseudo: string;
  age: string;
  avatar: string | null;
  partnerCode: string;
  myCode: string;
  isSynced: boolean;
  setUid: (uid: string | null) => void;
  setPseudo: (pseudo: string) => void;
  setAge: (age: string) => void;
  setAvatar: (avatar: string | null) => void;
  setPartnerCode: (code: string) => void;
  setMyCode: (code: string) => void;
  setSynced: (status: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      uid: null,
      pseudo: '',
      age: '',
      avatar: null,
      partnerCode: '',
      myCode: '',
      isSynced: false,
      setUid: (uid) => set({ uid }),
      setPseudo: (pseudo) => set({ pseudo }),
      setAge: (age) => set({ age }),
      setAvatar: (avatar) => set({ avatar }),
      setPartnerCode: (code) => set({ partnerCode: code }),
      setMyCode: (code) => set({ myCode: code }),
      setSynced: (status) => set({ isSynced: status }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
