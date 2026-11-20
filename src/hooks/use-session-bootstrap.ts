import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useOnboardingStore } from '@/store/onboardingStore';

/** Restore both persistence layers before allowing private screens to mount. */
export function useSessionBootstrap() {
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    let disposed = false;
    let revision = 0;
    let unsubscribe = () => {};
    let started = false;
    // Recovery controls, never an assumed sign-out when the network is slow.
    let timer = setTimeout(() => { if (!disposed) setError(true); }, 10000);
    const begin = () => {
      if (disposed || started) return;
      started = true;
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        clearTimeout(timer);
        timer = setTimeout(() => { if (!disposed) setError(true); }, 10000);
        const currentRevision = ++revision;
        const isCurrent = () => !disposed && currentRevision === revision;
        setReady(false);
        setUser(firebaseUser);
        const store = useOnboardingStore.getState();
        if (!firebaseUser) {
          store.resetSession();
          clearTimeout(timer);
          setError(false);
          setReady(true);
          return;
        }
        const hadCachedProfile = store.uid === firebaseUser.uid && !!store.pseudo && !!store.age;
        if (store.uid !== firebaseUser.uid) store.resetSession();
        store.setUid(firebaseUser.uid);
        if (hadCachedProfile) {
          clearTimeout(timer);
          setError(false);
          setReady(true);
        }
        void getDoc(doc(db, 'users', firebaseUser.uid)).then((snapshot) => {
          if (!isCurrent()) return;
          const data = snapshot.data();
          const current = useOnboardingStore.getState();
          current.setPseudo(data?.pseudo || '');
          current.setAge(data?.age || '');
          const avatarToSet = data?.avatarUrl || data?.avatar || null;
          current.setAvatar(avatarToSet);
          current.setMyCode(data?.pairingCode || '');
          current.setSynced(Boolean(data?.linkedTo));
          if (!data?.linkedTo || current.partnerUid !== data.linkedTo) current.clearPartnerCache();
          clearTimeout(timer);
          setError(false);
          setReady(true);
          // Optional cosmetics must never delay the first usable screen.
          void import('@/lib/economy').then(({ getUserProfile }) => getUserProfile(firebaseUser.uid)).then((profile) => {
            if (!isCurrent()) return;
            current.setSelectedCosmetics(profile.selectedBackground, profile.selectedBorder, profile.selectedTag);
            if (profile.avatar) current.setAvatarConfig(profile.avatar);
            if (profile.selectedWidget) current.setSelectedWidget(profile.selectedWidget);
          }).catch(() => {});
        }).catch(() => {
          if (!isCurrent() || hadCachedProfile) return;
          clearTimeout(timer);
          setError(true);
        });
      }, () => { if (!disposed) setError(true); });
    };
    const stopHydration = useOnboardingStore.persist.onFinishHydration(begin);
    if (useOnboardingStore.persist.hasHydrated()) begin();
    return () => {
      disposed = true;
      clearTimeout(timer);
      stopHydration();
      unsubscribe();
    };
  }, [attempt]);
  return { ready, error, user, retry: () => {
    setError(false);
    setAttempt((value) => value + 1);
    if (!useOnboardingStore.persist.hasHydrated()) void useOnboardingStore.persist.rehydrate();
  } };
}
