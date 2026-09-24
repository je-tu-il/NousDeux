import { collection, doc, getDoc, getDocs, increment, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { getById } from '../data/questions';
import { QUESTS, Quest, QuestEvent, QuestTierLevel } from '../data/quests';
import { db } from './firebase';

export type WalletData = { petals: number; streak: number; lastClaimDate: string; totalEarned: number; dailyClaims?: Record<string, string>; lastOperationIds?: string[] };
export type InventoryData = { backgrounds: string[]; borders: string[]; tags: string[]; avatarParts: string[] };
export type ItemType = 'background' | 'border' | 'tag' | 'avatarPart';
export type QuestTier = QuestTierLevel;
export type QuestProgressEntry = {
  current: number;
  tier: QuestTier | null;
  completedAt?: string;
  unclaimedTiers?: QuestTierLevel[];
  claimedBy?: Partial<Record<QuestTierLevel, string[]>>;
};
export type QuestProgressMap = Record<string, QuestProgressEntry>;
export type AvatarConfig = { body: string; skin: string; hair: string; hairColor: string; eyes: string; mouth: string; accessory: string; hat: string; outfit: string };
export type UserProfile = { selectedBackground: string; selectedBorder: string; selectedTag: string; avatar: AvatarConfig };

export type { QuestEvent } from '../data/quests';

const walletCache = new Map<string, WalletData>();
const streakCache = new Map<string, number>();

export function getCachedWallet(cId: string): WalletData | null {
  return walletCache.get(cId) ?? null;
}

export function cacheWallet(cId: string, wallet: WalletData): void {
  walletCache.set(cId, wallet);
}

export function invalidateStreakCache(cId: string): void {
  streakCache.delete(cId);
}

export function getCachedStreak(cId: string): number | null {
  return streakCache.has(cId) ? streakCache.get(cId)! : null;
}

// Formule: Math.round(Math.log(streak + 1) * 15) + 5
export function calculateDailyPetals(streak: number): number {
  return Math.round(Math.log(streak + 1) * 15) + 5;
}

// Helpers date locale (évite le bug UTC vs heure locale au changement de mois/jour)
function getLocalDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function computeStreak(cId: string): Promise<number> {
  if (!cId) throw new Error('Missing coupleId');
  const today = new Date();
  const dailySnapshot = await getDocs(collection(db, 'couples', cId, 'daily'));
  const completedDays = new Set<string>();
  dailySnapshot.docs.forEach((dailyDoc) => {
    const data = dailyDoc.data();
    if (data.bothAnswered === true || data.answered === true || data.complete === true) {
      completedDays.add(dailyDoc.id);
    }
  });
  const legacyDays = dailySnapshot.docs.filter((dailyDoc) => !completedDays.has(dailyDoc.id));
  const legacyResults = await Promise.all(
    legacyDays.map(async (dailyDoc) => ({ id: dailyDoc.id, count: (await getDocs(collection(dailyDoc.ref, 'answers'))).size }))
  );
  legacyResults.forEach(({ id, count }) => {
    if (count >= 2) completedDays.add(id);
  });

  const toKey = (year: number, month: number, day: number) => 
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // A day still in progress must not reset the streak earned up to yesterday.
  const startsToday = completedDays.has(toKey(today.getFullYear(), today.getMonth(), today.getDate()));
  const startOffset = startsToday ? 0 : -1;
  let streak = 0;

  // Walk backward from today/yesterday using local calendar dates.
  for (let offset = startOffset; offset >= -90; offset--) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    if (completedDays.has(toKey(d.getFullYear(), d.getMonth(), d.getDate()))) {
      streak++;
    } else { break; }
  }
  return streak;
}

export async function computeStreakCached(cId: string, force = false): Promise<number> {
  const cached = getCachedStreak(cId);
  if (!force && cached !== null) return cached;
  const streak = await computeStreak(cId);
  streakCache.set(cId, streak);
  return streak;
}

export function resolveQuestionCategory(questionId?: string, fallbackCat?: string): string | undefined {
  if (fallbackCat && fallbackCat !== 'all') return fallbackCat;
  if (!questionId) return undefined;
  if (questionId.startsWith('pof_')) return 'pile_ou_face';
  const q = getById(questionId);
  if (q?.category) return q.category;
  const match = questionId.match(/^q_gen_([a-z_]+)_\d+$/);
  if (match) return match[1];
  return undefined;
}

export async function syncUnlimitedStats(cId: string): Promise<Record<string, number>> {
  if (!cId) throw new Error('Missing coupleId');
  const dailySnapshot = await getDocs(collection(db, 'couples', cId, 'daily'));
  const stats: Record<string, number> = {};
  const unconfirmedSlots: Array<{ ref: any; data: any }> = [];

  dailySnapshot.docs.forEach((dailyDoc) => {
    const data = dailyDoc.data();
    if (data.bothAnswered === true) {
      const cat = resolveQuestionCategory(data.questionId, data.category !== 'all' ? data.category : data.questionCategory);
      if (cat && cat !== 'all') {
        stats[cat] = (stats[cat] ?? 0) + 1;
      }
    } else if (dailyDoc.id.startsWith('unlimited_')) {
      unconfirmedSlots.push({ ref: dailyDoc.ref, data });
    }
  });

  // Pour les questions illimitées sans bothAnswered marqué, vérifier si les 2 partenaires ont répondu
  if (unconfirmedSlots.length > 0) {
    const checks = await Promise.all(
      unconfirmedSlots.map(async ({ ref, data }) => {
        try {
          const ansSnap = await getDocs(collection(ref, 'answers'));
          if (ansSnap.size >= 2) {
            await updateDoc(ref, { bothAnswered: true, countedForStats: true }).catch(() => {});
            return { data, bothAnswered: true };
          }
        } catch {}
        return { data, bothAnswered: false };
      })
    );

    checks.forEach(({ data, bothAnswered }) => {
      if (bothAnswered) {
        const cat = resolveQuestionCategory(data.questionId, data.category !== 'all' ? data.category : data.questionCategory);
        if (cat && cat !== 'all') {
          stats[cat] = (stats[cat] ?? 0) + 1;
        }
      }
    });
  }

  // Préserver les stats existantes du wallet pour éviter toute régression
  const walletRef = doc(db, `couples/${cId}/economy/wallet`);
  const walletSnap = await getDoc(walletRef);
  const existingStats = walletSnap.exists() ? (walletSnap.data().unlimitedStats || {}) : {};

  const mergedStats: Record<string, number> = { ...existingStats };
  for (const [cat, count] of Object.entries(stats)) {
    mergedStats[cat] = Math.max(mergedStats[cat] ?? 0, count);
  }

  await setDoc(walletRef, { unlimitedStats: mergedStats }, { merge: true });
  return mergedStats;
}

const STREAK_UNLOCKS = [
  { id: 'bg_streak_3', type: 'backgrounds', days: 3 },
  { id: 'bg_streak_7', type: 'backgrounds', days: 7 },
  { id: 'bg_streak_14', type: 'backgrounds', days: 14 },
  { id: 'bg_streak_30', type: 'backgrounds', days: 30 },
  { id: 'bg_streak_60', type: 'backgrounds', days: 60 },
  { id: 'bd_streak_7', type: 'borders', days: 7 },
  { id: 'bd_streak_14', type: 'borders', days: 14 },
  { id: 'bd_streak_30', type: 'borders', days: 30 },
  { id: 'bd_streak_60', type: 'borders', days: 60 },
] as const;

export async function syncStreakCosmetics(cId: string, streak: number): Promise<void> {
  if (!cId || streak <= 0) return;
  try {
    const invRef = doc(db, `couples/${cId}/inventory/cosmetics`);
    const invSnap = await getDoc(invRef);
    let invData: InventoryData = invSnap.exists()
      ? (invSnap.data() as InventoryData)
      : { backgrounds: [], borders: [], tags: [], avatarParts: [] };

    let updated = false;
    for (const item of STREAK_UNLOCKS) {
      if (streak >= item.days) {
        const list = invData[item.type] || [];
        if (!list.includes(item.id)) {
          invData = { ...invData, [item.type]: [...list, item.id] };
          updated = true;
        }
      }
    }
    if (updated) {
      await setDoc(invRef, invData, { merge: true });
    }
  } catch (err) {
    console.error('Failed to sync streak cosmetics:', err);
  }
}

export async function updateWalletStreak(cId: string): Promise<number> {
  if (!cId) throw new Error('Missing coupleId');
  const streak = await computeStreak(cId);
  await setDoc(doc(db, `couples/${cId}/economy/wallet`), { streak }, { merge: true });
  streakCache.set(cId, streak);
  if (streak > 0) {
    await syncStreakCosmetics(cId, streak);
  }
  return streak;
}
function getLocalYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Retourne le wallet du couple, crée-le si inexistant
export async function getWallet(cId: string): Promise<WalletData> {
  if (!cId) throw new Error('Missing coupleId');
  const walletRef = doc(db, `couples/${cId}/economy/wallet`);
  const snap = await getDoc(walletRef);
  if (snap.exists()) {
    const wallet = snap.data() as WalletData;
    cacheWallet(cId, wallet);
    return wallet;
  }
  const defaultWallet: WalletData = { petals: 0, streak: 0, lastClaimDate: '', totalEarned: 0 };
  await setDoc(walletRef, defaultWallet, { merge: true });
  cacheWallet(cId, defaultWallet);
  return defaultWallet;
}

export async function claimDaily(cId: string, uid: string, amountFromWheel?: number, operationId?: string): Promise<{ petals: number; balance: number; totalEarned: number; alreadyClaimed: boolean }> {
  if (!cId) throw new Error('Missing coupleId');
  const walletRef = doc(db, `couples/${cId}/economy/wallet`);
  
  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(walletRef);
    const today = getLocalDateKey();
    
    let data: WalletData;
    if (!snap.exists()) {
      data = { petals: 0, streak: 0, lastClaimDate: '', totalEarned: 0 };
    } else {
      data = snap.data() as WalletData;
    }

    // Si une operationId est fournie, protéger l'opération contre les réexécutions
    if (operationId && (data.lastOperationIds ?? []).includes(operationId)) {
      return {
        petals: 0,
        balance: data.petals || 0,
        totalEarned: data.totalEarned || 0,
        alreadyClaimed: true,
      };
    }

    if (data.dailyClaims?.[uid] === today) {
      return {
        petals: 0,
        balance: data.petals || 0,
        totalEarned: data.totalEarned || 0,
        alreadyClaimed: true,
      };
    }

    const currentStreak = data.streak || 0;
    const earned = amountFromWheel !== undefined && Number.isFinite(amountFromWheel) && amountFromWheel >= 0
      ? Math.round(amountFromWheel)
      : calculateDailyPetals(currentStreak);
    
    const newLastOps = operationId ? [...(data.lastOperationIds ?? []), operationId].slice(-200) : (data.lastOperationIds ?? []);
    const newData = {
      petals: (data.petals || 0) + earned,
      totalEarned: (data.totalEarned || 0) + earned,
      lastClaimDate: today,
      dailyClaims: { ...(data.dailyClaims || {}), [uid]: today },
      lastOperationIds: newLastOps,
    };

    transaction.set(walletRef, newData, { merge: true });
    checkQuests(cId, 'daily_claim', 1).catch(e => console.error(e));
    checkQuests(cId, 'petals_earned', earned).catch(e => console.error(e));
    return {
      petals: earned,
      balance: newData.petals,
      totalEarned: newData.totalEarned,
      alreadyClaimed: false,
    };
  });
}

// Dépense des pétales. Retourne false si solde insuffisant.
export async function spendPetals(cId: string, amount: number): Promise<boolean> {
  if (!cId) throw new Error('Missing coupleId');
  const walletRef = doc(db, `couples/${cId}/economy/wallet`);
  
  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(walletRef);
    if (!snap.exists()) return false;
    
    const data = snap.data() as WalletData;
    if (data.petals < amount) return false;
    
    transaction.update(walletRef, {
      petals: increment(-amount)
    });
    return true;
  });
}

// Crédite des pétales bonus (question complétée)
// Ajout d'une option idempotence via operationId pour éviter double-crédit
export async function awardBonusPetals(cId: string, amount: number, operationId?: string): Promise<void> {
  if (!cId) throw new Error('Missing coupleId');
  const walletRef = doc(db, `couples/${cId}/economy/wallet`);

  // Si aucun operationId fourni, faire l'incrément simple atomique
  if (!operationId) {
    await updateDoc(walletRef, {
      petals: increment(amount),
      totalEarned: increment(amount)
    });
    return;
  }

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(walletRef);
    const data: WalletData = snap.exists() ? (snap.data() as WalletData) : { petals: 0, streak: 0, lastClaimDate: '', totalEarned: 0 };

    const seen = data.lastOperationIds ?? [];
    if (seen.includes(operationId)) {
      // Déjà appliqué
      return;
    }

    const newSeen = [...seen, operationId].slice(-200); // garder une fenêtre raisonnable

    transaction.set(walletRef, {
      petals: (data.petals || 0) + amount,
      totalEarned: (data.totalEarned || 0) + amount,
      lastOperationIds: newSeen
    }, { merge: true });
  });
}

// Lit l'inventaire du couple
// ⚠️ L'inventaire est partagé au niveau du COUPLE (couples/{cId}/inventory/cosmetics).
// Un achat effectué par l'un des membres est immédiatement disponible pour les deux.
// L'équipement (quel cosmétic est actif) est individuel via userProfiles/{uid}.
export async function getInventory(cId: string): Promise<InventoryData> {
  if (!cId) throw new Error('Missing coupleId');
  const invRef = doc(db, `couples/${cId}/inventory/cosmetics`);
  const snap = await getDoc(invRef);
  if (snap.exists()) {
    return snap.data() as InventoryData;
  }
  const defaultInv: InventoryData = { backgrounds: [], borders: [], tags: [], avatarParts: [] };
  await setDoc(invRef, defaultInv);
  return defaultInv;
}

// Achète un item du shop
export async function purchaseItem(cId: string, itemId: string, itemType: ItemType, price: number): Promise<{ success: boolean; reason?: string }> {
  if (!cId) throw new Error('Missing coupleId');
  const walletRef = doc(db, `couples/${cId}/economy/wallet`);
  const invRef = doc(db, `couples/${cId}/inventory/cosmetics`);
  
  return await runTransaction(db, async (transaction) => {
    const walletSnap = await transaction.get(walletRef);
    if (!walletSnap.exists() || walletSnap.data().petals < price) {
      return { success: false, reason: 'Solde insuffisant' };
    }
    
    const invSnap = await transaction.get(invRef);
    let invData: InventoryData = { backgrounds: [], borders: [], tags: [], avatarParts: [] };
    if (invSnap.exists()) {
      invData = invSnap.data() as InventoryData;
    }
    
    const collection = invData[`${itemType}s` as keyof InventoryData] as string[] || [];
    if (collection.includes(itemId)) {
      return { success: false, reason: 'Objet déjà possédé' };
    }
    
    transaction.update(walletRef, {
      petals: increment(-price)
    });
    
    const updateField = `${itemType}s`;
    transaction.set(invRef, {
      ...invData,
      [updateField]: [...collection, itemId]
    }, { merge: true });
    
    checkQuests(cId, 'petals_spent', price).catch(e => console.error(e));
      checkQuests(cId, 'items_owned', 1).catch(e => console.error(e));
      return { success: true };
  });
}

// Lit la progression des quêtes
export async function getQuestProgress(cId: string): Promise<QuestProgressMap> {
  if (!cId) throw new Error('Missing coupleId');
  const ref = doc(db, `couples/${cId}/quests/progress`);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as QuestProgressMap;
  }
  return {};
}

// Vérifie et met à jour les quêtes après un événement
export async function checkQuests(cId: string, event: QuestEvent, value: number = 1): Promise<{ completed: Quest[] }> {
  if (!cId) throw new Error('Missing coupleId');
  const progressRef = doc(db, `couples/${cId}/quests/progress`);
  
  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(progressRef);
    let progress: QuestProgressMap = snap.exists() ? snap.data() as QuestProgressMap : {};
    
    let updated = false;
    const completedQuests: Quest[] = [];
    let totalBonus = 0;
    
    for (const quest of QUESTS) {
      if (quest.trigger === event) {
        if (!progress[quest.id]) {
          progress[quest.id] = { current: 0, tier: null };
        }

        progress[quest.id].current += value;
        updated = true;
        
        let newTier: QuestTierLevel | null = progress[quest.id].tier;
        let newlyCompleted = false;
        
        for (const tierObj of quest.tiers) {
          if (progress[quest.id].current >= tierObj.threshold) {
            const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
            const currentIndex = newTier ? tierOrder.indexOf(newTier) : -1;
            const thisIndex = tierOrder.indexOf(tierObj.tier);
            
            if (thisIndex > currentIndex) {
              newTier = tierObj.tier;
              if (!progress[quest.id].unclaimedTiers) {
                progress[quest.id].unclaimedTiers = [];
              }
              if (!progress[quest.id].unclaimedTiers!.includes(tierObj.tier)) {
                progress[quest.id].unclaimedTiers!.push(tierObj.tier);
              }
              newlyCompleted = true;
            }
          }
        }
        
        if (newlyCompleted) {
          progress[quest.id].tier = newTier;
          progress[quest.id].completedAt = new Date().toISOString();
          completedQuests.push(quest);
        }
      }
    }
    
    if (updated) {
      transaction.set(progressRef, progress, { merge: true });
    }
    
    return { completed: completedQuests };
  });
}

export async function updateCoupleDurationQuest(cId: string, coupleDate?: string): Promise<void> {
  if (!coupleDate) return;
  // Parse YYYY-MM-DD as a local calendar date; parsing it as UTC can shift
  // the day around midnight and produce an incorrect duration.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(coupleDate);
  const start = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(coupleDate);
  if (Number.isNaN(start.getTime())) return;
  // The quest has no tier beyond one year. Capping here also prevents a
  // malformed legacy/default date from turning a new couple into a 9000-day
  // couple.
  const days = Math.min(365, Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000)));
  const progress = await getQuestProgress(cId);
  const current = progress.couple_duration?.current ?? 0;
  if (current > days) {
    const progressRef = doc(db, `couples/${cId}/quests/progress`);
    const validTiers = QUESTS.find(q => q.id === 'couple_duration')?.tiers || [];
    const validUnclaimed = (progress.couple_duration?.unclaimedTiers || []).filter(t => {
      const tierDef = validTiers.find(x => x.tier === t);
      return tierDef ? days >= tierDef.threshold : false;
    });
    await updateDoc(progressRef, {
      'couple_duration.current': days,
      'couple_duration.unclaimedTiers': validUnclaimed
    });
  } else if (days > current) {
    await checkQuests(cId, 'couple_duration', days - current);
  }
}

// Réclame la récompense d'un palier de quête
export async function claimQuestReward(cId: string, questId: string, tier: QuestTierLevel, reward: number, uid: string): Promise<boolean> {
  if (!cId) throw new Error('Missing coupleId');
  const progressRef = doc(db, `couples/${cId}/quests/progress`);
  const walletRef = doc(db, `couples/${cId}/economy/wallet`);
  
  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(progressRef);
    if (!snap.exists()) return false;
    
    const progress = snap.data() as QuestProgressMap;
    const questProg = progress[questId];
    
    if (!questProg || !questProg.unclaimedTiers || !questProg.unclaimedTiers.includes(tier)) {
      return false; // Déjà réclamé ou pas atteint
    }

    const claimedBy = questProg.claimedBy ?? {};
    const tierClaimers = claimedBy[tier] ?? [];
    if (tierClaimers.includes(uid)) return false;
    const updatedClaimers = [...tierClaimers, uid];
    claimedBy[tier] = updatedClaimers;
    questProg.claimedBy = claimedBy;

    // Le palier reste visible après la première réclamation. Il est retiré
    // et payé uniquement lorsque les deux membres l'ont réclamé.
    const members = cId.includes(`_${uid}`)
      ? cId.split(`_${uid}`).filter(Boolean)
      : cId.startsWith(`${uid}_`)
        ? [cId.slice(uid.length + 1)]
        : [];
    const bothClaimed = updatedClaimers.length >= 2 || members.some(member => updatedClaimers.includes(member));
    if (!bothClaimed) {
      transaction.set(progressRef, progress, { merge: true });
      return false;
    }
    questProg.unclaimedTiers = questProg.unclaimedTiers.filter(t => t !== tier);
    
    transaction.set(progressRef, progress, { merge: true });
    
    // Créditer le wallet
    transaction.update(walletRef, {
      petals: increment(reward),
      totalEarned: increment(reward)
    });
    
    return true;
  });
}

// Sauvegarde la config du profil utilisateur
export async function saveUserProfile(uid: string, profile: Partial<UserProfile>): Promise<void> {
  const ref = doc(db, 'userProfiles', uid);
  await setDoc(ref, profile, { merge: true });
}

// Lit le profil utilisateur
export async function getUserProfile(uid: string, createIfMissing: boolean = false): Promise<UserProfile> {
  const ref = doc(db, 'userProfiles', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  const defaultProfile: UserProfile = {
    selectedBackground: 'bg_free_1',
    selectedBorder: 'bd_free_1',
    selectedTag: 'tag_free_0',
    avatar: {
      body: 'default',
      skin: 'light',
      hair: 'short',
      hairColor: 'black',
      eyes: 'normal',
      mouth: 'smile',
      accessory: 'none',
      hat: 'none',
      outfit: 'casual'
    }
  };
  if (createIfMissing) {
    try {
      await setDoc(ref, defaultProfile);
    } catch {
      console.warn('Could not create missing profile, returning default');
    }
  }
  return defaultProfile;
}
