import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AvatarConfig } from '../data/avatarParts';

interface OnboardingState {
  uid: string | null;
  pseudo: string;
  age: string;
  avatar: string | null;
  partnerCode: string;
  myCode: string;
  isSynced: boolean;
  hasAcceptedTerms: boolean;
  isDarkMode: boolean;
  // Cache partenaire pour éviter les refetch répétés
  partnerUid: string | null;
  partnerPseudo: string;
  partnerAvatar: string | null;
  // Cache avatar pixel art & cosmétiques
  avatarConfig: AvatarConfig | null;
  selectedBackground: string;
  selectedBorder: string;
  selectedTag: string;

  setUid: (uid: string | null) => void;
  setPseudo: (pseudo: string) => void;
  setAge: (age: string) => void;
  setAvatar: (avatar: string | null) => void;
  setPartnerCode: (code: string) => void;
  setMyCode: (code: string) => void;
  setSynced: (status: boolean) => void;
  setHasAcceptedTerms: (accepted: boolean) => void;
  setDarkMode: (isDark: boolean) => void;
  setPartnerCache: (uid: string | null, pseudo: string, avatar: string | null) => void;
  clearPartnerCache: () => void;
  setAvatarConfig: (config: AvatarConfig) => void;
  setSelectedCosmetics: (bg: string, border: string, tag: string) => void;
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
      isDarkMode: false,
      partnerUid: null,
      partnerPseudo: '',
      partnerAvatar: null,
      avatarConfig: null,
      selectedBackground: 'bg_free_1',
      selectedBorder: 'border_none',
      selectedTag: '',

      setUid: (uid) => set({ uid }),
      setPseudo: (pseudo) => set({ pseudo }),
      setAge: (age) => set({ age }),
      setAvatar: (avatar) => set({ avatar }),
      setPartnerCode: (code) => set({ partnerCode: code }),
      setMyCode: (code) => set({ myCode: code }),
      setSynced: (status) => set({ isSynced: status }),
      setHasAcceptedTerms: (accepted) => set({ hasAcceptedTerms: accepted }),
      setDarkMode: (isDark) => set({ isDarkMode: isDark }),
      setPartnerCache: (uid, pseudo, avatar) => set({ partnerUid: uid, partnerPseudo: pseudo, partnerAvatar: avatar }),
      clearPartnerCache: () => set({ partnerUid: null, partnerPseudo: '', partnerAvatar: null }),
      setAvatarConfig: (config) => set({ avatarConfig: config }),
      setSelectedCosmetics: (bg, border, tag) => set({ selectedBackground: bg, selectedBorder: border, selectedTag: tag }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

