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
  hasAcceptedTerms: boolean;
  // Cache partenaire pour éviter les refetch répétés
  partnerUid: string | null;
  partnerPseudo: string;
  partnerAvatar: string | null;

  setUid: (uid: string | null) => void;
  setPseudo: (pseudo: string) => void;
  setAge: (age: string) => void;
  setAvatar: (avatar: string | null) => void;
  setPartnerCode: (code: string) => void;
  setMyCode: (code: string) => void;
  setSynced: (status: boolean) => void;
  setHasAcceptedTerms: (accepted: boolean) => void;
  setPartnerCache: (uid: string | null, pseudo: string, avatar: string | null) => void;
  clearPartnerCache: () => void;
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
      hasAcceptedTerms: false,
      partnerUid: null,
      partnerPseudo: '',
      partnerAvatar: null,

      setUid: (uid) => set({ uid }),
      setPseudo: (pseudo) => set({ pseudo }),
      setAge: (age) => set({ age }),
      setAvatar: (avatar) => set({ avatar }),
      setPartnerCode: (code) => set({ partnerCode: code }),
      setMyCode: (code) => set({ myCode: code }),
      setSynced: (status) => set({ isSynced: status }),
      setHasAcceptedTerms: (accepted) => set({ hasAcceptedTerms: accepted }),
      setPartnerCache: (uid, pseudo, avatar) => set({ partnerUid: uid, partnerPseudo: pseudo, partnerAvatar: avatar }),
      clearPartnerCache: () => set({ partnerUid: null, partnerPseudo: '', partnerAvatar: null }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
