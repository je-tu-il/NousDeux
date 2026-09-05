import { collection, doc, getDoc, getDocs, increment, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { QUESTS, Quest, QuestEvent, QuestTierLevel } from '../data/quests';
import { db } from './firebase';

export type WalletData = { petals: number; streak: number; lastClaimDate: string; totalEarned: number; dailyClaims?: Record<string, string> };
export type InventoryData = { backgrounds: string[]; borders: string[]; tags: string[]; avatarParts: string[] };
export type ItemType = 'background' | 'border' | 'tag' | 'avatarPart';
export type QuestTier = QuestTierLevel;
export type QuestProgressEntry = { current: number; tier: QuestTier | null; completedAt?: string; unclaimedTiers?: QuestTierLevel[]; };
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
  const today = new Date();
  let streak = 0;

  const toKey = (year: number, month: number, day: number) => 
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isCompletedDay = async (date: Date): Promise<boolean> => {
    const snap = await getDoc(doc(db, 'couples', cId, 'daily', toKey(date.getFullYear(), date.getMonth(), date.getDate())));
    if (!snap.exists()) return false;
    const data = snap.data();
    if (data.bothAnswered === true || data.answered === true || data.complete === true) return true;

    // Legacy daily documents may not have the completion flag yet.
    const answers = await getDocs(collection(snap.ref, 'answers'));
    return answers.size >= 2;
  };

  // A day still in progress must not reset the streak earned up to yesterday.
  const startsToday = await isCompletedDay(today);
  const startOffset = startsToday ? 0 : -1;

  // Walk backward from today/yesterday using local calendar dates.
  for (let offset = startOffset; offset >= -90; offset--) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    if (await isCompletedDay(d)) {
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

export async function syncUnlimitedStats(cId: string): Promise<Record<string, number>> {
  const dailySnapshot = await getDocs(collection(db, 'couples', cId, 'daily'));
  const stats: Record<string, number> = {};
  dailySnapshot.docs.forEach((dailyDoc) => {
    const data = dailyDoc.data();
    if (data.mode === 'unlimited' && data.category && data.category !== 'all' && data.bothAnswered === true) {
      stats[data.category] = (stats[data.category] ?? 0) + 1;
    }
  });
  await setDoc(doc(db, `couples/${cId}/economy/wallet`), { unlimitedStats: stats }, { merge: true });
  return stats;
}

export async function updateWalletStreak(cId: string): Promise<number> {
  const streak = await computeStreak(cId);
  await setDoc(doc(db, `couples/${cId}/economy/wallet`), { streak }, { merge: true });
  streakCache.set(cId, streak);
  return streak;
}
function getLocalYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Retourne le wallet du couple, crée-le si inexistant
export async function getWallet(cId: string): Promise<WalletData> {
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

export async function claimDaily(cId: string, uid: string, amountFromWheel?: number): Promise<{ petals: number; alreadyClaimed: boolean }> {
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

    if (data.dailyClaims?.[uid] === today) {
      return { petals: 0, alreadyClaimed: true };
    }

    const currentStreak = data.streak || 0;
    const earned = amountFromWheel !== undefined && Number.isFinite(amountFromWheel) && amountFromWheel >= 0
      ? Math.round(amountFromWheel)
      : calculateDailyPetals(currentStreak);
    
    const newData = {
      petals: (data.petals || 0) + earned,
      totalEarned: (data.totalEarned || 0) + earned,
      lastClaimDate: today,
      dailyClaims: { ...(data.dailyClaims || {}), [uid]: today },
    };

    transaction.set(walletRef, newData, { merge: true });
    checkQuests(cId, 'daily_claim', 1).catch(e => console.error(e));
    checkQuests(cId, 'petals_earned', earned).catch(e => console.error(e));
    return { petals: earned, alreadyClaimed: false };
  });
}

// Dépense des pétales. Retourne false si solde insuffisant.
export async function spendPetals(cId: string, amount: number): Promise<boolean> {
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
export async function awardBonusPetals(cId: string, amount: number): Promise<void> {
  const walletRef = doc(db, `couples/${cId}/economy/wallet`);
  await updateDoc(walletRef, {
    petals: increment(amount),
    totalEarned: increment(amount)
  });
}

// Lit l'inventaire du couple
// ⚠️ L'inventaire est partagé au niveau du COUPLE (couples/{cId}/inventory/cosmetics).
// Un achat effectué par l'un des membres est immédiatement disponible pour les deux.
// L'équipement (quel cosmétic est actif) est individuel via userProfiles/{uid}.
export async function getInventory(cId: string): Promise<InventoryData> {
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
  const ref = doc(db, `couples/${cId}/quests/progress`);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as QuestProgressMap;
  }
  return {};
}

// Vérifie et met à jour les quêtes après un événement
export async function checkQuests(cId: string, event: QuestEvent, value: number = 1): Promise<{ completed: Quest[] }> {
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

// Réclame la récompense d'un palier de quête
export async function claimQuestReward(cId: string, questId: string, tier: QuestTierLevel, reward: number): Promise<boolean> {
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
    
    // Retirer le palier des unclaimed
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
    } catch (e) {
      console.warn('Could not create missing profile, returning default');
    }
  }
  return defaultProfile;
}
