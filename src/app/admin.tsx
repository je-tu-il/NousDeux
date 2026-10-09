/**
 * admin.tsx — Panel d'administration NousDeux
 * 5 onglets : Stats | Couples | Alertes | Debug | Messages
 * Accessible uniquement aux UIDs admin hardcodés
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import {
    ArrowLeft,
    BarChart3,
    Bell,
    Bug,
    ChevronDown, ChevronUp,
    CircleUser,
    Edit3,
    HelpCircle,
    Lightbulb,
    Mail,
    MessageSquare,
    RefreshCw,
    Search,
    Send,
    Trash2,
    Users,
    Wrench,
    X,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert, FlatList,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { COSMETICS } from '../data/cosmetics';
import { QUESTIONS } from '../data/questions';
import { QUESTS } from '../data/quests';
import { checkQuests, claimQuestReward, computeStreak, ItemType, purchaseItem, saveUserProfile } from '../lib/economy';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useOnboardingStore } from '../store/onboardingStore';
import { ADMIN_UIDS_LIST, isUserAdmin } from '../constants/admins';
import { useTopInset } from '@/hooks/useTopInset';

const ADMIN_UIDS = ADMIN_UIDS_LIST;

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'stats' | 'users' | 'couples' | 'alerts' | 'debug' | 'messages';

export interface AdminUserData {
  uid: string;
  pseudo: string;
  email?: string;
  age?: number;
  linkedTo?: string | null;
  partnerPseudo?: string | null;
  coupleDate?: string | null;
  pairingCode?: string | null;
  createdAt?: any;
  photoUrl?: string | null;
}

type ContactStatus = 'unread' | 'read' | 'replied';
type ContactCategory = 'bug' | 'suggestion' | 'account' | 'other';

interface ContactMessage {
  id: string; name: string; email: string; category: ContactCategory;
  message: string; uid: string | null; pseudo: string | null;
  status: ContactStatus; reply: string | null; createdAt: any; repliedAt: any; platform: string;
}

interface WalletData {
  petals: number; streak: number; lastClaimDate: string; totalEarned: number;
}

interface InventoryData {
  backgrounds: string[]; borders: string[]; tags: string[]; avatarParts: string[];
}

interface QuestProgressEntry {
  current: number; tier: string | null; completedAt?: string; unclaimedTiers?: string[];
}

interface CoupleData {
  id: string;
  members: { uid: string; pseudo: string }[];
  wallet: WalletData | null;
  inventory: InventoryData | null;
  questProgress: Record<string, QuestProgressEntry>;
  seenQuestions: string[];
  coupleDate?: string;
}

interface GlobalStats {
  totalCouples: number;
  totalUsers: number;
  totalMessages: number;
  unreadMessages: number;
  avgStreak: number;
  topCouples: CoupleData[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const QUESTION_CATEGORIES = ['amour', 'souvenir', 'reve', 'profond', 'fun', 'quotidien', 'defi', 'intime', 'famille', 'debat', 'futur'] as const;

function countByCategory(seenIds: string[]): Record<string, { seen: number; total: number; pct: number }> {
  const result: Record<string, { seen: number; total: number; pct: number }> = {};
  for (const cat of QUESTION_CATEGORIES) {
    const total = QUESTIONS.filter(q => q.category === cat).length;
    const seen = seenIds.filter(id => {
      const q = QUESTIONS.find(q => q.id === id);
      return q?.category === cat;
    }).length;
    result[cat] = { seen, total, pct: total > 0 ? Math.round((seen / total) * 100) : 0 };
  }
  return result;
}

function formatDate(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function pctBar(pct: number): string {
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

const CATEGORY_META: Record<ContactCategory, { label: string; icon: any; color: string }> = {
  bug: { label: 'Bug', icon: Bug, color: '#EF4444' },
  suggestion: { label: 'Suggestion', icon: Lightbulb, color: '#F59E0B' },
  account: { label: 'Compte', icon: CircleUser, color: '#3B82F6' },
  other: { label: 'Autre', icon: HelpCircle, color: '#8B5CF6' },
};
const STATUS_META: Record<ContactStatus, { label: string; color: string }> = {
  unread: { label: 'Non lu', color: '#EF4444' },
  read: { label: 'Lu', color: '#F59E0B' },
  replied: { label: 'Répondu', color: '#22C55E' },
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function deleteCouplePermanently(cId: string, memberUids?: string[]): Promise<void> {
  // 1. Supprimer les documents de configuration / progression
  await deleteDoc(doc(db, `couples/${cId}/economy/wallet`)).catch(() => {});
  await deleteDoc(doc(db, `couples/${cId}/inventory/cosmetics`)).catch(() => {});
  await deleteDoc(doc(db, `couples/${cId}/quests/progress`)).catch(() => {});
  await deleteDoc(doc(db, `couples/${cId}/progress/seen`)).catch(() => {});
  await deleteDoc(doc(db, `couples/${cId}/progress/indexes`)).catch(() => {});

  // 2. Supprimer les messages de messagerie
  try {
    const msgsSnap = await getDocs(collection(db, `couples/${cId}/messages`));
    await Promise.all(msgsSnap.docs.map(d => deleteDoc(d.ref)));
  } catch {}

  // 3. Supprimer les slots daily et leurs réponses
  try {
    const dailySnap = await getDocs(collection(db, `couples/${cId}/daily`));
    for (const d of dailySnap.docs) {
      try {
        const answersSnap = await getDocs(collection(db, `couples/${cId}/daily/${d.id}/answers`));
        await Promise.all(answersSnap.docs.map(a => deleteDoc(a.ref)));
      } catch {}
      await deleteDoc(d.ref);
    }
  } catch {}

  // 4. Supprimer le document du couple lui-même
  await deleteDoc(doc(db, 'couples', cId)).catch(() => {});

  // 5. Délier les comptes utilisateurs s'ils pointent encore l'un vers l'autre
  const uids = memberUids && memberUids.length > 0 ? memberUids : cId.split('_');
  for (const uid of uids) {
    if (!uid) continue;
    try {
      const uRef = doc(db, 'users', uid);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        const uData = uSnap.data();
        if (uData.linkedTo && (uids.includes(uData.linkedTo) || uData.linkedTo === uid)) {
          await updateDoc(uRef, {
            linkedTo: null,
            coupleDate: null,
            proposedDate: null,
            needsDate: false,
          });
        }
      }
    } catch (e) {
      console.warn('Erreur déliaison user', uid, e);
    }
  }
}

async function deleteUserPermanently(uid: string, linkedTo?: string | null): Promise<void> {
  // 1. Si l'utilisateur est lié à un couple, supprimer ce couple définitivement
  if (linkedTo) {
    const cId = [uid, linkedTo].sort().join('_');
    await deleteCouplePermanently(cId, [uid, linkedTo]);
  }

  // 2. Supprimer les documents de couple orphelins éventuels contenant cet UID
  try {
    const couplesColl = await getDocs(collection(db, 'couples'));
    for (const cDoc of couplesColl.docs) {
      if (cDoc.id.includes(uid)) {
        await deleteCouplePermanently(cDoc.id);
      }
    }
  } catch (e) {
    console.warn('Erreur nettoyage couples orphelins:', e);
  }

  // 3. Déconnecter tout autre compte qui pointerait vers cet UID
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const uDoc of usersSnap.docs) {
      if (uDoc.data().linkedTo === uid) {
        await updateDoc(uDoc.ref, {
          linkedTo: null,
          coupleDate: null,
          proposedDate: null,
          needsDate: false,
        });
      }
    }
  } catch (e) {
    console.warn('Erreur déliaison partenaires orphelins:', e);
  }

  // 4. Supprimer les codes de synchronisation créés par cet utilisateur
  try {
    const codesSnap = await getDocs(collection(db, 'pairing_codes'));
    for (const cDoc of codesSnap.docs) {
      if (cDoc.data().uid === uid || cDoc.id === uid) {
        await deleteDoc(cDoc.ref);
      }
    }
  } catch (e) {
    console.warn('Erreur suppression pairing_codes:', e);
  }

  // 5. Supprimer le profil cosmétique de l'utilisateur
  await deleteDoc(doc(db, 'userProfiles', uid)).catch(() => {});

  // 6. Supprimer le document utilisateur
  await deleteDoc(doc(db, 'users', uid)).catch(() => {});
}

async function fetchAllCouples(): Promise<{ couples: CoupleData[]; totalUsers: number; usersList: AdminUserData[] }> {
  // 1. Lire tous les users pour grouper les couples
  const usersSnap = await getDocs(collection(db, 'users'));
  const userMap: Record<string, { uid: string; pseudo: string; email?: string; age?: number; linkedTo?: string; coupleDate?: string; pairingCode?: string; photoUrl?: string }> = {};
  usersSnap.forEach(d => {
    const data = d.data();
    userMap[d.id] = {
      uid: d.id,
      pseudo: data.pseudo || d.id.slice(0, 8),
      email: data.email,
      age: data.age,
      linkedTo: data.linkedTo,
      coupleDate: data.coupleDate,
      pairingCode: data.pairingCode,
      photoUrl: data.photoUrl,
    };
  });
  
  const totalUsers = Object.keys(userMap).length;

  const usersList: AdminUserData[] = Object.values(userMap).map(u => ({
    uid: u.uid,
    pseudo: u.pseudo,
    email: u.email,
    age: u.age,
    linkedTo: u.linkedTo,
    partnerPseudo: u.linkedTo ? (userMap[u.linkedTo]?.pseudo || u.linkedTo.slice(0, 8) + '…') : null,
    coupleDate: u.coupleDate,
    pairingCode: u.pairingCode,
    photoUrl: u.photoUrl,
  }));

  // 2. Déduire les coupleIds (tri pour éviter doublons)
  const coupleIds = new Set<string>();
  for (const u of Object.values(userMap)) {
    if (u.linkedTo) {
      const cId = [u.uid, u.linkedTo].sort().join('_');
      coupleIds.add(cId);
    }
  }

  // Scanner aussi la collection couples dans Firestore pour capturer les couples orphelins / anciens
  try {
    const couplesCollSnap = await getDocs(collection(db, 'couples'));
    couplesCollSnap.forEach(d => {
      coupleIds.add(d.id);
    });
  } catch (err) {
    console.warn('Erreur lecture couples Firestore:', err);
  }

  // 3. Pour chaque couple, charger wallet + inventory + quests + seenQuestions
  const couples: CoupleData[] = [];
  for (const cId of coupleIds) {
    const parts = cId.split('_');
    const uid1 = parts[0] || '';
    const uid2 = parts[1] || '';
    const members = [uid1, uid2]
      .filter(Boolean)
      .map(uid => ({ uid, pseudo: userMap[uid]?.pseudo || (uid.length > 8 ? uid.slice(0, 8) + '…' : uid) }));

    const [walletSnap, invSnap, questSnap, seenSnap] = await Promise.all([
      getDoc(doc(db, `couples/${cId}/economy/wallet`)),
      getDoc(doc(db, `couples/${cId}/inventory/cosmetics`)),
      getDoc(doc(db, `couples/${cId}/quests/progress`)),
      getDoc(doc(db, `couples/${cId}/progress/seen`)),
    ]);

    // Ignorer si couple vide et aucun document dans Firestore
    if (!walletSnap.exists() && !invSnap.exists() && !questSnap.exists() && !seenSnap.exists() && (!userMap[uid1]?.linkedTo || userMap[uid1]?.linkedTo !== uid2)) {
      continue;
    }

    couples.push({
      id: cId,
      members: members.length > 0 ? members : [{ uid: cId, pseudo: 'Ancien couple' }],
      wallet: walletSnap.exists() ? walletSnap.data() as WalletData : null,
      inventory: invSnap.exists() ? invSnap.data() as InventoryData : null,
      questProgress: questSnap.exists() ? questSnap.data() as Record<string, QuestProgressEntry> : {},
      seenQuestions: seenSnap.exists() ? (seenSnap.data().questionIds ?? []) : [],
      coupleDate: userMap[uid1]?.coupleDate || userMap[uid2]?.coupleDate,
    });
  }

  return {
    couples: couples.sort((a, b) => (b.wallet?.petals ?? 0) - (a.wallet?.petals ?? 0)),
    totalUsers,
    usersList: usersList.sort((a, b) => a.pseudo.localeCompare(b.pseudo)),
  };
}

// ─── Composant MessageCard (messages de contact) ──────────────────────────────

function MessageCard({ msg, onMarkRead, onReply }: {
  msg: ContactMessage;
  onMarkRead: (id: string) => void;
  onReply: (msg: ContactMessage) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[msg.category] ?? CATEGORY_META.other;
  const Icon = meta.icon;
  const statusMeta = STATUS_META[msg.status];
  return (
    <Pressable
      style={[s.card, msg.status === 'unread' && s.cardUnread]}
      onPress={() => { setExpanded(e => !e); if (msg.status === 'unread') onMarkRead(msg.id); }}
    >
      <View style={s.cardHeader}>
        <View style={[s.catBadge, { backgroundColor: meta.color + '20', borderColor: meta.color + '40' }]}>
          <Icon size={14} color={meta.color} />
          <Text style={[s.catBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: statusMeta.color + '20' }]}>
          <Text style={[s.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
        <Text style={s.cardDate}>{formatDate(msg.createdAt)}</Text>
      </View>
      <View style={s.cardIdentity}>
        <Text style={s.cardName}>{msg.name}</Text>
        <Text style={s.cardEmail}>{msg.email}</Text>
        {msg.pseudo && msg.pseudo !== msg.name && <Text style={s.cardPseudo}>Pseudo app : {msg.pseudo}</Text>}
        <Text style={s.cardPseudo}>📱 {msg.platform}</Text>
      </View>
      <Text style={s.cardMessage} numberOfLines={expanded ? undefined : 3}>{msg.message}</Text>
      {msg.reply && (
        <View style={s.replyBox}>
          <Text style={s.replyLabel}>✉️ Réponse envoyée :</Text>
          <Text style={s.replyText}>{msg.reply}</Text>
          <Text style={s.replyDate}>{formatDate(msg.repliedAt)}</Text>
        </View>
      )}
      {expanded && (
        <View style={s.cardActions}>
          <Pressable style={s.actionBtn} onPress={() => Linking.openURL(`mailto:${msg.email}?subject=Re: NousDeux - ${CATEGORY_META[msg.category]?.label}&body=Bonjour ${msg.name},%0A%0A`)}>
            <Mail size={16} color="#FF9A8B" />
            <Text style={s.actionBtnText}>Email</Text>
          </Pressable>
          <Pressable style={[s.actionBtn, { backgroundColor: 'rgba(255,106,136,0.1)' }]} onPress={() => onReply(msg)}>
            <Send size={16} color="#FF6A88" />
            <Text style={[s.actionBtnText, { color: '#FF6A88' }]}>Répondre</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

// ─── Tab Stats ────────────────────────────────────────────────────────────────

function StatsTab({
  couples,
  messages,
  loading,
  totalFirebaseUsers,
  onNavigateTab,
}: {
  couples: CoupleData[];
  messages: ContactMessage[];
  loading: boolean;
  totalFirebaseUsers: number;
  onNavigateTab?: (tab: Tab) => void;
}) {
  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#FF9A8B" size="large" />;

  const totalCouples = couples.length;
  const totalUsers = totalFirebaseUsers;
  const streaks = couples.map(c => c.wallet?.streak ?? 0).filter(Boolean);
  const avgStreak = streaks.length ? Math.round(streaks.reduce((a, b) => a + b, 0) / streaks.length) : 0;
  const maxStreak = streaks.length ? Math.max(...streaks) : 0;
  const totalPetals = couples.reduce((acc, c) => acc + (c.wallet?.petals ?? 0), 0);
  const unreadMessages = messages.filter(m => m.status === 'unread').length;
  const totalSeenQuestions = couples.reduce((acc, c) => acc + c.seenQuestions.length, 0);

  const streakBuckets = [
    { label: '0 j', count: couples.filter(c => (c.wallet?.streak ?? 0) === 0).length },
    { label: '1-7 j', count: couples.filter(c => { const s = c.wallet?.streak ?? 0; return s >= 1 && s <= 7; }).length },
    { label: '8-30 j', count: couples.filter(c => { const s = c.wallet?.streak ?? 0; return s >= 8 && s <= 30; }).length },
    { label: '31-100', count: couples.filter(c => { const s = c.wallet?.streak ?? 0; return s >= 31 && s <= 100; }).length },
    { label: '>100 j', count: couples.filter(c => (c.wallet?.streak ?? 0) > 100).length },
  ];
  const maxBucket = Math.max(...streakBuckets.map(b => b.count), 1);

  const top5 = [...couples].sort((a, b) => (b.wallet?.streak ?? 0) - (a.wallet?.streak ?? 0)).slice(0, 5);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      {/* KPIs */}
      <View style={s.statsGrid}>
        {[
          { label: 'Couples', value: totalCouples, icon: '💑', color: '#FF6A88', targetTab: 'couples' as Tab },
          { label: 'Utilisateurs', value: totalUsers, icon: '👤', color: '#3B82F6', targetTab: 'users' as Tab },
          { label: 'Streak moyen', value: `${avgStreak}j`, icon: '🔥', color: '#F59E0B' },
          { label: 'Streak max', value: `${maxStreak}j`, icon: '🏆', color: '#22C55E' },
          { label: 'Pétales total', value: totalPetals.toLocaleString(), icon: '🌸', color: '#8B5CF6' },
          { label: 'Messages non lus', value: unreadMessages, icon: '✉️', color: unreadMessages > 0 ? '#EF4444' : '#A99693', targetTab: 'messages' as Tab },
          { label: 'Questions vues', value: totalSeenQuestions, icon: '💬', color: '#06B6D4' },
        ].map(kpi => {
          const isClickable = Boolean(kpi.targetTab && onNavigateTab);
          const Content = (
            <>
              <Text style={s.kpiIcon}>{kpi.icon}</Text>
              <Text style={[s.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
              <Text style={s.kpiLabel}>{kpi.label}{isClickable ? ' →' : ''}</Text>
            </>
          );
          return isClickable ? (
            <Pressable
              key={kpi.label}
              style={[s.kpiCard, { cursor: 'pointer' } as any]}
              onPress={() => kpi.targetTab && onNavigateTab?.(kpi.targetTab)}
            >
              {Content}
            </Pressable>
          ) : (
            <View key={kpi.label} style={s.kpiCard}>
              {Content}
            </View>
          );
        })}
      </View>

      {/* Distribution streaks */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>📊 Distribution des séries</Text>
        {streakBuckets.map(b => (
          <View key={b.label} style={s.barRow}>
            <Text style={s.barLabel}>{b.label}</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${(b.count / maxBucket) * 100}%` as any, backgroundColor: '#FF9A8B' }]} />
            </View>
            <Text style={s.barCount}>{b.count}</Text>
          </View>
        ))}
      </View>

      {/* Top 5 séries */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>🔥 Top 5 séries</Text>
        {top5.map((c, i) => (
          <View key={c.id} style={s.topRow}>
            <Text style={s.topRank}>#{i + 1}</Text>
            <Text style={s.topName}>{c.members.map(m => m.pseudo).join(' & ')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14 }}>🔥</Text>
              <Text style={s.topValue}>{c.wallet?.streak ?? 0}j</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14 }}>🌸</Text>
              <Text style={[s.topValue, { color: '#8B5CF6' }]}>{c.wallet?.petals ?? 0}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── CouplePanel — expansion d'un couple ─────────────────────────────────────

function CouplePanel({ couple, onUpdated }: { couple: CoupleData; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'wallet' | 'quests' | 'cosmetics' | 'questions' | 'danger'>('wallet');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Wallet édition
  const [petalDelta, setPetalDelta] = useState('');
  const [streakVal, setStreakVal] = useState(String(couple.wallet?.streak ?? 0));
  const [lastClaimDate, setLastClaimDate] = useState(couple.wallet?.lastClaimDate ?? '');

  // Quest édition
  const [questEdits, setQuestEdits] = useState<Record<string, string>>({});

  const catStats = countByCategory(couple.seenQuestions);

  const handleDeleteThisCouple = async () => {
    const confirmMessage = `Supprimer définitivement le couple ${couple.members.map(m => m.pseudo).join(' & ')} (${couple.id}) ?\n\nToutes les données (wallet, quêtes, inventaire, messages, réponses) seront supprimées et les comptes seront déliés.`;

    const proceed = Platform.OS === 'web'
      ? (typeof window !== 'undefined' && window.confirm(confirmMessage))
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            '⚠️ Supprimer le couple',
            confirmMessage,
            [
              { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!proceed) return;

    setDeleting(true);
    try {
      await deleteCouplePermanently(couple.id, couple.members.map(m => m.uid));
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`✅ Couple supprimé : ${couple.id}`);
      } else {
        Alert.alert('✅ Succès', `Le couple ${couple.id} a été supprimé.`);
      }
      onUpdated();
    } catch (err) {
      Alert.alert('Erreur', String(err));
    } finally {
      setDeleting(false);
    }
  };

  const saveWallet = async () => {
    setSaving(true);
    try {
      const walletRef = doc(db, `couples/${couple.id}/economy/wallet`);
      const snap = await getDoc(walletRef);
      const current = snap.exists() ? snap.data() : { petals: 0, streak: 0, lastClaimDate: '', totalEarned: 0 };

      const delta = parseInt(petalDelta) || 0;
      const newPetals = Math.max(0, (current.petals ?? 0) + delta);
      const newStreak = Math.max(0, parseInt(streakVal) || 0);

      await setDoc(walletRef, {
        ...current,
        petals: newPetals,
        streak: newStreak,
        lastClaimDate: lastClaimDate || current.lastClaimDate,
        totalEarned: delta > 0 ? (current.totalEarned ?? 0) + delta : (current.totalEarned ?? 0),
      }, { merge: true });

      if (newStreak > (current.streak || 0)) {
        await checkQuests(couple.id, 'daily_claim', newStreak - (current.streak || 0));
      }

      setPetalDelta('');
      Alert.alert('✅ Wallet mis à jour', `Pétales: ${newPetals} | Série: ${newStreak}j`);
      onUpdated();
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveQuestProgress = async (questId: string, newValue: string) => {
    const val = parseInt(newValue);
    if (isNaN(val)) return;
    setSaving(true);
    try {
      const progressRef = doc(db, `couples/${couple.id}/quests/progress`);
      const snap = await getDoc(progressRef);
      const current = snap.exists() ? snap.data() : {};
      const quest = QUESTS.find(q => q.id === questId);
      if (!quest) return;

      // Recalcule les tiers atteints
      let tier: string | null = null;
      const unclaimedTiers: string[] = [];
      const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
      for (const t of quest.tiers) {
        if (val >= t.threshold) {
          tier = t.tier;
          if (!current[questId]?.unclaimedTiers?.includes(t.tier)) {
            unclaimedTiers.push(t.tier);
          }
        }
      }

      await setDoc(progressRef, {
        ...current,
        [questId]: {
          ...(current[questId] || {}),
          current: val,
          tier,
        }
      }, { merge: true });

      setQuestEdits(prev => { const n = { ...prev }; delete n[questId]; return n; });
      Alert.alert('✅ Quête mise à jour');
      onUpdated();
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleCosmetic = async (itemId: string, itemType: 'background' | 'border' | 'tag', owned: boolean) => {
    setSaving(true);
    try {
      const invRef = doc(db, `couples/${couple.id}/inventory/cosmetics`);
      const snap = await getDoc(invRef);
      const current: InventoryData = snap.exists() ? snap.data() as InventoryData : { backgrounds: [], borders: [], tags: [], avatarParts: [] };
      const fieldKey = `${itemType}s` as keyof InventoryData;
      const list = (current[fieldKey] as string[]) || [];

      const updated = owned
        ? list.filter(id => id !== itemId)
        : [...list, itemId];

      await setDoc(invRef, { ...current, [fieldKey]: updated }, { merge: true });
      Alert.alert(owned ? '🗑 Retiré' : '✅ Ajouté', `${itemId} ${owned ? 'retiré de' : 'ajouté à'} l'inventaire du couple`);
      onUpdated();
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setSaving(false);
    }
  };

  const resetDailyForCouple = async () => {
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const walletRef = doc(db, `couples/${couple.id}/economy/wallet`);
      // Reset lastClaimDate pour permettre un nouveau claim aujourd'hui
      await updateDoc(walletRef, { lastClaimDate: '' });
      Alert.alert('✅ Daily reset', 'Le couple peut maintenant reclaim les pétales du jour');
      onUpdated();
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.coupleCard}>
      {/* Header couple — toujours visible */}
      <Pressable style={s.coupleHeader} onPress={() => setExpanded(e => !e)}>
        <View style={{ flex: 1 }}>
          <Text style={s.coupleName}>{couple.members.map(m => m.pseudo).join(' & ')}</Text>
          <Text style={s.coupleId}>{couple.id.slice(0, 20)}...</Text>
          <View style={s.coupleBadges}>
            <View style={s.badge}><Text style={s.badgeTxt}>🔥 {couple.wallet?.streak ?? 0}j</Text></View>
            <View style={[s.badge, { backgroundColor: 'rgba(139,92,246,0.12)' }]}><Text style={s.badgeTxt}>🌸 {couple.wallet?.petals ?? 0}</Text></View>
            <View style={[s.badge, { backgroundColor: 'rgba(6,182,212,0.12)' }]}><Text style={s.badgeTxt}>💬 {couple.seenQuestions.length}</Text></View>
          </View>
        </View>
        {expanded ? <ChevronUp size={20} color="#A99693" /> : <ChevronDown size={20} color="#A99693" />}
      </Pressable>

      {/* Contenu déroulant */}
      {expanded && (
        <View style={s.coupleBody}>
          {/* Sub-tabs */}
          <View style={s.subTabs}>
            {(['wallet', 'quests', 'cosmetics', 'questions', 'danger'] as const).map(t => (
              <Pressable
                key={t}
                style={[
                  s.subTab,
                  tab === t && s.subTabActive,
                  t === 'danger' && { backgroundColor: tab === 'danger' ? '#EF4444' : 'rgba(239,68,68,0.08)' }
                ]}
                onPress={() => setTab(t)}
              >
                <Text
                  style={[
                    s.subTabTxt,
                    tab === t && s.subTabTxtActive,
                    t === 'danger' && { color: tab === 'danger' ? 'white' : '#EF4444' }
                  ]}
                >
                  {t === 'wallet' ? '💰 Wallet' : t === 'quests' ? '📋 Quêtes' : t === 'cosmetics' ? '🎨 Cosméts' : t === 'questions' ? '💬 Questions' : '🗑️ Supprimer'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* === WALLET === */}
          {tab === 'wallet' && (
            <View style={s.editSection}>
              <Text style={s.editLabel}>Pétales actuels : {couple.wallet?.petals ?? 0} 🌸</Text>
              <View style={[s.row, { alignItems: 'center', gap: 6 }]}>
                <Pressable
                  style={[s.signBtn, { backgroundColor: '#22c55e' }]}
                  onPress={() => {
                    setPetalDelta(prev => {
                      const clean = prev.replace(/^[+-]/, '');
                      return clean ? `+${clean}` : '+';
                    });
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>+</Text>
                </Pressable>
                <Pressable
                  style={[s.signBtn, { backgroundColor: '#ef4444' }]}
                  onPress={() => {
                    setPetalDelta(prev => {
                      const clean = prev.replace(/^[+-]/, '');
                      return clean ? `-${clean}` : '-';
                    });
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>-</Text>
                </Pressable>
                <TextInput
                  style={[s.smallInput, { flex: 1, marginBottom: 0 }]}
                  value={petalDelta}
                  onChangeText={setPetalDelta}
                  placeholder="+500 ou -200"
                  keyboardType="default"
                  placeholderTextColor="#C4B4B2"
                />
                <Text style={{ color: '#A99693', fontSize: 12 }}>delta</Text>
              </View>

              {/* Presets pétales */}
              <Text style={[s.editLabel, { marginTop: 4, fontSize: 11, color: '#A99693' }]}>Presets pétales :</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {[0, 100, 500, 1000, 9999].map(val => (
                  <Pressable
                    key={`p_${val}`}
                    style={[s.presetBtn, (couple.wallet?.petals ?? 0) === val && s.presetBtnActive]}
                    onPress={async () => {
                      setSaving(true);
                      try {
                        const walletRef = doc(db, `couples/${couple.id}/economy/wallet`);
                        const snap = await getDoc(walletRef);
                        const current = snap.exists() ? snap.data() : { petals: 0, streak: 0, lastClaimDate: '', totalEarned: 0 };
                        await setDoc(walletRef, { ...current, petals: val }, { merge: true });
                        Alert.alert('✅', `Pétales → ${val}`);
                        onUpdated();
                      } catch (e) { Alert.alert('Erreur', String(e)); }
                      finally { setSaving(false); }
                    }}
                    disabled={saving}
                  >
                    <Text style={[s.presetBtnTxt, (couple.wallet?.petals ?? 0) === val && s.presetBtnTxtActive]}>
                      {val === 0 ? '0' : val.toLocaleString()} 🌸
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.editLabel}>Série (jours) :</Text>
              <TextInput
                style={s.smallInput}
                value={streakVal}
                onChangeText={setStreakVal}
                keyboardType="numeric"
                placeholderTextColor="#C4B4B2"
              />

              {/* Presets streak */}
              <Text style={[s.editLabel, { marginTop: 4, fontSize: 11, color: '#A99693' }]}>Presets série :</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {[0, 3, 7, 14, 30, 60].map(val => (
                  <Pressable
                    key={`s_${val}`}
                    style={[s.presetBtn, (couple.wallet?.streak ?? 0) === val && s.presetBtnActive]}
                    onPress={async () => {
                      setSaving(true);
                      try {
                        const walletRef = doc(db, `couples/${couple.id}/economy/wallet`);
                        const snap = await getDoc(walletRef);
                        const current = snap.exists() ? snap.data() : { petals: 0, streak: 0, lastClaimDate: '', totalEarned: 0 };
                        await setDoc(walletRef, { ...current, streak: val }, { merge: true });
                        if (val > (current.streak || 0)) {
                          await checkQuests(couple.id, 'daily_claim', val - (current.streak || 0));
                        }
                        setStreakVal(String(val));
                        Alert.alert('✅', `Série → ${val}j`);
                        onUpdated();
                      } catch (e) { Alert.alert('Erreur', String(e)); }
                      finally { setSaving(false); }
                    }}
                    disabled={saving}
                  >
                    <Text style={[s.presetBtnTxt, (couple.wallet?.streak ?? 0) === val && s.presetBtnTxtActive]}>
                      🔥 {val}j
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.editLabel}>Dernier claim (YYYY-MM-DD) :</Text>
              <TextInput
                style={s.smallInput}
                value={lastClaimDate}
                onChangeText={setLastClaimDate}
                placeholder="2026-08-20"
                placeholderTextColor="#C4B4B2"
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={[s.saveBtn, { flex: 1 }]} onPress={saveWallet} disabled={saving}>
                  {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={s.saveBtnTxt}>💾 Sauvegarder</Text>}
                </Pressable>
                <Pressable style={[s.saveBtn, { flex: 1, backgroundColor: '#F59E0B' }]} onPress={resetDailyForCouple} disabled={saving}>
                  <Text style={s.saveBtnTxt}>🔄 Reset Daily</Text>
                </Pressable>
              </View>

              {/* Test Roue */}
              <View style={{ marginTop: 12, padding: 10, backgroundColor: 'rgba(168,216,234,0.15)', borderRadius: 12 }}>
                <Text style={[s.editLabel, { color: '#0891B2', fontWeight: '800' }]}>🎡 Test Roue (dry run)</Text>
                <Text style={{ color: '#A99693', fontSize: 11, marginBottom: 8 }}>Simule un spin sans modifier les données. Affiche le résultat.</Text>
                <Pressable
                  style={[s.saveBtn, { backgroundColor: '#0891B2' }]}
                  onPress={() => {
                    const WEIGHTS = [24, 15, 8, 22, 4, 20, 5, 2];
                    const LABELS = ['x1', 'x1.25', 'x0.75', 'x1', 'x3 JACKPOT', 'x1', 'x1.5', 'Relance'];
                    const MULTIPLIERS = [1, 1.25, 0.75, 1, 3, 1, 1.5, 0];
                    const total = WEIGHTS.reduce((a, b) => a + b, 0);
                    let rnd = Math.random() * total;
                    let idx = 0;
                    for (let i = 0; i < WEIGHTS.length; i++) { rnd -= WEIGHTS[i]; if (rnd <= 0) { idx = i; break; } }
                    const basePetals = Math.round(Math.log((couple.wallet?.streak ?? 0) + 1) * 15) + 5;
                    const won = Math.round(basePetals * MULTIPLIERS[idx]);
                    const probas = WEIGHTS.map((w, i) => `${LABELS[i]}: ${((w/total)*100).toFixed(1)}%`).join('\n');
                    Alert.alert(
                      `🎡 Résultat: ${LABELS[idx]}`,
                      `Base: ${basePetals} 🌸 × ${MULTIPLIERS[idx]} = ${won} 🌸\n\n📊 Probabilités:\n${probas}`
                    );
                  }}
                >
                  <Text style={s.saveBtnTxt}>🎡 Spin test</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* === QUÊTES === */}
          {tab === 'quests' && (
            <ScrollView horizontal={false} style={{ maxHeight: 400 }}>
              {QUESTS.map(quest => {
                const prog = couple.questProgress[quest.id];
                const current = prog?.current ?? 0;
                const tier = prog?.tier ?? null;
                const maxThreshold = quest.tiers[quest.tiers.length - 1].threshold;
                const pct = Math.min(100, Math.round((current / maxThreshold) * 100));
                const editing = questEdits[quest.id] !== undefined;

                return (
                  <View key={quest.id} style={s.questRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 16 }}>{quest.icon}</Text>
                        <Text style={s.questName}>{quest.name}</Text>
                        {tier && <Text style={[s.tierBadge, { backgroundColor: tier === 'platinum' ? '#8B5CF6' : tier === 'gold' ? '#F59E0B' : tier === 'silver' ? '#6B7280' : '#CD7F32' }]}>{tier}</Text>}
                      </View>
                      <Text style={s.questDesc}>{current} / {maxThreshold} · {pct}%</Text>
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${pct}%` as any }]} />
                      </View>
                    </View>
                    <Pressable style={s.editIcon} onPress={() => setQuestEdits(prev => editing ? { ...prev, [quest.id]: '' } : { ...prev, [quest.id]: String(current) })}>
                      {editing ? <X size={16} color="#EF4444" /> : <Edit3 size={16} color="#A99693" />}
                    </Pressable>
                    {editing && (
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        <TextInput
                          style={[s.smallInput, { flex: 1, marginBottom: 0 }]}
                          value={questEdits[quest.id]}
                          onChangeText={v => setQuestEdits(prev => ({ ...prev, [quest.id]: v }))}
                          keyboardType="numeric"
                          autoFocus
                          placeholderTextColor="#C4B4B2"
                        />
                        <Pressable style={s.saveBtn} onPress={() => saveQuestProgress(quest.id, questEdits[quest.id])}>
                          <Text style={s.saveBtnTxt}>OK</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* === COSMÉTIQUES === */}
          {tab === 'cosmetics' && (
            <ScrollView style={{ maxHeight: 600 }}>
              {/* ── Équiper un cosmétique (par user) ── */}
              <View style={{ marginBottom: 16, padding: 10, backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 12 }}>
                <Text style={[s.editLabel, { color: '#22C55E', fontWeight: '800' }]}>👕 Équiper un cosmétique</Text>
                <Text style={{ color: '#A99693', fontSize: 11, marginBottom: 8 }}>Change le cosmétique équipé d&apos;un user directement.</Text>
                {couple.members.map(member => (
                  <View key={member.uid} style={{ marginBottom: 10 }}>
                    <Text style={{ fontWeight: '700', color: '#6B4C47', fontSize: 12, marginBottom: 4 }}>
                      {member.pseudo} ({member.uid.slice(0, 8)}…)
                    </Text>
                    {(['background', 'border', 'tag'] as const).map(type => {
                      const items = COSMETICS.filter(c => c.type === type);
                      const fieldKey = type === 'background' ? 'selectedBackground' : type === 'border' ? 'selectedBorder' : 'selectedTag';
                      return (
                        <View key={type} style={{ marginBottom: 6 }}>
                          <Text style={{ fontSize: 11, color: '#A99693', marginBottom: 2 }}>
                            {type === 'background' ? '🖼 Fond' : type === 'border' ? '🔲 Bordure' : '🏷 Tag'} :
                          </Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                            <View style={{ flexDirection: 'row', gap: 4 }}>
                              {items.slice(0, 8).map(item => (
                                <Pressable
                                  key={item.id}
                                  style={[s.presetBtn, { paddingHorizontal: 6 }]}
                                  onPress={async () => {
                                    setSaving(true);
                                    try {
                                      await saveUserProfile(member.uid, { [fieldKey]: item.id } as any);
                                      Alert.alert('✅ Équipé', `${member.pseudo}: ${type} → ${item.emoji || ''} ${item.name}`);
                                      onUpdated();
                                    } catch (e) { Alert.alert('Erreur', String(e)); }
                                    finally { setSaving(false); }
                                  }}
                                  disabled={saving}
                                >
                                  <Text style={s.presetBtnTxt}>{item.emoji || '•'} {item.name.slice(0, 10)}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </ScrollView>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* ── Simuler un achat ── */}
              <View style={{ marginBottom: 16, padding: 10, backgroundColor: 'rgba(139,92,246,0.08)', borderRadius: 12 }}>
                <Text style={[s.editLabel, { color: '#8B5CF6', fontWeight: '800' }]}>🛒 Simuler un achat</Text>
                <Text style={{ color: '#A99693', fontSize: 11, marginBottom: 8 }}>Exécute purchaseItem() — déduit les pétales et ajoute à l&apos;inventaire.</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {COSMETICS.filter(c => c.unlock.type === 'purchase').slice(0, 12).map(item => {
                      const ownedList = item.type === 'background'
                        ? (couple.inventory?.backgrounds ?? [])
                        : item.type === 'border'
                          ? (couple.inventory?.borders ?? [])
                          : (couple.inventory?.tags ?? []);
                      const alreadyOwned = ownedList.includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          style={[s.presetBtn, { paddingHorizontal: 6, opacity: alreadyOwned ? 0.4 : 1 }]}
                          onPress={async () => {
                            if (alreadyOwned) { Alert.alert('Déjà possédé'); return; }
                            setSaving(true);
                            try {
                              const result = await purchaseItem(couple.id, item.id, item.type as ItemType, (item.unlock as any).price);
                              if (result.success) {
                                Alert.alert('✅ Acheté !', `${item.emoji || ''} ${item.name} (−${(item.unlock as any).price} 🌸)`);
                                onUpdated();
                              } else {
                                Alert.alert('❌ Échec', result.reason ?? 'Erreur inconnue');
                              }
                            } catch (e) { Alert.alert('Erreur', String(e)); }
                            finally { setSaving(false); }
                          }}
                          disabled={saving || alreadyOwned}
                        >
                          <Text style={s.presetBtnTxt}>
                            {item.emoji || '•'} {item.name.slice(0, 8)} ({(item.unlock as any).price}🌸)
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* ── Simuler récup quête ── */}
              <View style={{ marginBottom: 16, padding: 10, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12 }}>
                <Text style={[s.editLabel, { color: '#F59E0B', fontWeight: '800' }]}>🎁 Simuler récup quête</Text>
                <Text style={{ color: '#A99693', fontSize: 11, marginBottom: 8 }}>Exécute claimQuestReward() — crédite les pétales et retire des unclaimed.</Text>
                {QUESTS.map(quest => {
                  const prog = couple.questProgress[quest.id];
                  const unclaimed = prog?.unclaimedTiers ?? [];
                  if (unclaimed.length === 0) return null;
                  return (
                    <View key={quest.id} style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B4C47' }}>{quest.icon} {quest.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                        {unclaimed.map(tier => {
                          const tierData = quest.tiers.find(t => t.tier === tier);
                          return (
                            <Pressable
                              key={tier}
                              style={[s.presetBtn, { backgroundColor: 'rgba(245,158,11,0.15)' }]}
                              onPress={async () => {
                                setSaving(true);
                                try {
                                  const success = auth.currentUser
                                    ? await claimQuestReward(couple.id, quest.id, tier as any, tierData?.reward ?? 0, auth.currentUser.uid)
                                    : false;
                                  if (success) {
                                    Alert.alert('✅ Récupéré', `${quest.name} ${tier} → +${tierData?.reward ?? 0} 🌸`);
                                    onUpdated();
                                  } else {
                                    Alert.alert('❌ Échec', 'Impossible de claim cette récompense');
                                  }
                                } catch (e) { Alert.alert('Erreur', String(e)); }
                                finally { setSaving(false); }
                              }}
                              disabled={saving}
                            >
                              <Text style={s.presetBtnTxt}>🎁 {tier} (+{tierData?.reward ?? '?'} 🌸)</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                {QUESTS.every(q => (couple.questProgress[q.id]?.unclaimedTiers ?? []).length === 0) && (
                  <Text style={{ color: '#A99693', fontSize: 11, fontStyle: 'italic' }}>Aucune récompense de quête en attente.</Text>
                )}
              </View>

              {/* ── Liste inventaire (existant) ── */}
              {(['background', 'border', 'tag'] as const).map(type => {
                const items = COSMETICS.filter(c => c.type === type);
                const ownedList = type === 'background'
                  ? (couple.inventory?.backgrounds ?? [])
                  : type === 'border'
                    ? (couple.inventory?.borders ?? [])
                    : (couple.inventory?.tags ?? []);

                return (
                  <View key={type} style={{ marginBottom: 12 }}>
                    <Text style={s.cosmeticType}>
                      {type === 'background' ? '🖼 Backgrounds' : type === 'border' ? '🔲 Borders' : '🏷 Tags'}
                      {' '}({ownedList.length}/{items.length})
                    </Text>
                    {items.map(item => {
                      const owned = item.unlock.type === 'free' || ownedList.includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          style={[s.cosmeticRow, owned && s.cosmeticOwned]}
                          onPress={() => item.unlock.type !== 'free' && toggleCosmetic(item.id, type, ownedList.includes(item.id))}
                          disabled={item.unlock.type === 'free' || saving}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={s.cosmeticName}>{item.emoji ? `${item.emoji} ` : ''}{item.name}</Text>
                            <Text style={s.cosmeticId}>{item.id} · {item.unlock.type === 'purchase' ? `${(item.unlock as any).price}🌸` : item.unlock.type}</Text>
                          </View>
                          {item.unlock.type !== 'free' && (
                            <View style={[s.ownBadge, { backgroundColor: ownedList.includes(item.id) ? '#22C55E20' : '#EF444420' }]}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: ownedList.includes(item.id) ? '#22C55E' : '#EF4444' }}>
                                {ownedList.includes(item.id) ? '✓ Possédé' : '✗ Absent'}
                              </Text>
                            </View>
                          )}
                          {item.unlock.type === 'free' && (
                            <View style={[s.ownBadge, { backgroundColor: '#22C55E20' }]}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#22C55E' }}>Gratuit</Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* === QUESTIONS PAR THÈME === */}
          {tab === 'questions' && (
            <View style={s.editSection}>
              <Text style={{ color: '#A99693', fontSize: 12, marginBottom: 10 }}>
                Total vu : {couple.seenQuestions.length} / {QUESTIONS.length}
              </Text>
              {QUESTION_CATEGORIES.map(cat => {
                const st = catStats[cat];
                return (
                  <View key={cat} style={s.catRow}>
                    <Text style={s.catLabel}>{cat}</Text>
                    <View style={s.catBarTrack}>
                      <View style={[s.catBarFill, {
                        width: `${st.pct}%` as any,
                        backgroundColor: st.pct >= 80 ? '#EF4444' : st.pct >= 50 ? '#F59E0B' : '#22C55E',
                      }]} />
                    </View>
                    <Text style={s.catPct}>{st.seen}/{st.total}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* === SUPPRESSION DU COUPLE === */}
          {tab === 'danger' && (
            <View style={s.editSection}>
              <Text style={[s.editLabel, { color: '#EF4444', fontWeight: '800' }]}>⚠️ Suppression définitive du couple</Text>
              <Text style={{ color: '#A99693', fontSize: 12, marginBottom: 14, lineHeight: 18 }}>
                Cette action supprimera irréversiblement toutes les données du couple (wallet, quêtes, inventaire cosmétique, questions vues, messages de chat et slots quotidiens) et réinitialisera le statut de liaison des membres dans leurs profils.
              </Text>
              <Pressable
                style={[s.saveBtn, { backgroundColor: '#EF4444', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }]}
                onPress={handleDeleteThisCouple}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Trash2 size={16} color="white" />
                    <Text style={s.saveBtnTxt}>Supprimer ce couple</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Tab Couples ──────────────────────────────────────────────────────────────

function CouplesTab({ couples, loading, onRefresh }: { couples: CoupleData[]; loading: boolean; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [manualId, setManualId] = useState('');
  const [deletingManual, setDeletingManual] = useState(false);

  const handleManualDelete = async () => {
    const target = manualId.trim();
    if (!target) return;

    const confirmMessage = `Supprimer définitivement le couple "${target}" de la base Firestore ?`;
    const proceed = Platform.OS === 'web'
      ? (typeof window !== 'undefined' && window.confirm(confirmMessage))
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            '⚠️ Supprimer le couple',
            confirmMessage,
            [
              { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!proceed) return;

    setDeletingManual(true);
    try {
      await deleteCouplePermanently(target);
      setManualId('');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`✅ Couple supprimé : ${target}`);
      } else {
        Alert.alert('✅ Succès', `Le couple ${target} a été supprimé.`);
      }
      onRefresh();
    } catch (err) {
      Alert.alert('Erreur', String(err));
    } finally {
      setDeletingManual(false);
    }
  };

  const filtered = couples.filter(c =>
    c.id.toLowerCase().includes(search.toLowerCase()) ||
    c.members.some(m => m.pseudo.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchBar}>
        <Search size={16} color="#A99693" />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher par pseudo ou ID..."
          placeholderTextColor="#C4B4B2"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}><X size={16} color="#A99693" /></Pressable>
        )}
      </View>

      {/* Suppression manuelle d'un ancien couple par ID */}
      <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 12, backgroundColor: 'rgba(239,68,68,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444', marginBottom: 6 }}>
          🗑️ Supprimer un ancien couple par ID
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={[s.smallInput, { flex: 1, height: 38 }]}
            value={manualId}
            onChangeText={setManualId}
            placeholder="ex: uidA_uidB"
            placeholderTextColor="#C4B4B2"
            autoCapitalize="none"
          />
          <Pressable
            style={[s.saveBtn, { backgroundColor: '#EF4444', paddingHorizontal: 14, justifyContent: 'center' }]}
            onPress={handleManualDelete}
            disabled={deletingManual || !manualId.trim()}
          >
            {deletingManual ? <ActivityIndicator color="white" size="small" /> : <Text style={s.saveBtnTxt}>Supprimer</Text>}
          </Pressable>
        </View>
      </View>

      <Text style={{ paddingHorizontal: 16, color: '#A99693', fontSize: 12, marginBottom: 4 }}>
        {filtered.length} couple{filtered.length !== 1 ? 's' : ''}
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#FF9A8B" size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          renderItem={({ item }) => <CouplePanel couple={item} onUpdated={onRefresh} />}
        />
      )}
    </View>
  );
}

// ─── Tab Utilisateurs ────────────────────────────────────────────────────────

function UsersTab({
  users,
  loading,
  onRefresh,
}: {
  users: AdminUserData[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      u.pseudo.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.partnerPseudo && u.partnerPseudo.toLowerCase().includes(q))
    );
  });

  const handleDelete = (user: AdminUserData) => {
    const confirmMessage = `Es-tu sûr de vouloir supprimer définitivement l'utilisateur "${user.pseudo}" (${user.uid}) ?\n\nCette action supprimera ses profils, déliera son partenaire éventuel et supprimera toutes les données de couple associées.`;
    const performDelete = async () => {
      setDeletingUid(user.uid);
      try {
        await deleteUserPermanently(user.uid, user.linkedTo);
        if (Platform.OS === 'web') {
          window.alert(`✅ Utilisateur "${user.pseudo}" supprimé.`);
        } else {
          Alert.alert('✅ Supprimé', `L'utilisateur "${user.pseudo}" a été définitivement supprimé.`);
        }
        onRefresh();
      } catch (e) {
        Alert.alert('Erreur', String(e));
      } finally {
        setDeletingUid(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        void performDelete();
      }
    } else {
      Alert.alert(
        '⚠️ Supprimer cet utilisateur ?',
        confirmMessage,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer définitivement', style: 'destructive', onPress: () => void performDelete() },
        ]
      );
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#FF9A8B" size="large" />;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchBar}>
        <Search size={16} color="#A99693" />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher par pseudo, email, UID..."
          placeholderTextColor="#C4B4B2"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}><X size={16} color="#A99693" /></Pressable>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.uid}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B4C47' }}>
              {filtered.length} utilisateur{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''} (sur {users.length})
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.coupleCard}>
            <View style={{ padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <CircleUser size={28} color="#FF6A88" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.coupleName}>{item.pseudo}</Text>
                    {item.email ? <Text style={{ fontSize: 12, color: '#6B4C47' }}>{item.email}</Text> : null}
                  </View>
                </View>
                <View style={[s.badge, { backgroundColor: item.linkedTo ? 'rgba(34,197,94,0.12)' : 'rgba(156,163,175,0.15)' }]}>
                  <Text style={[s.badgeTxt, { color: item.linkedTo ? '#22c55e' : '#9CA3AF' }]}>
                    {item.linkedTo ? '❤️ En couple' : '👤 Célibataire'}
                  </Text>
                </View>
              </View>

              <View style={{ backgroundColor: '#FFF5F2', padding: 10, borderRadius: 10, gap: 4 }}>
                <Text style={{ fontSize: 11, color: '#A99693', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                  UID : {item.uid}
                </Text>
                {item.age !== undefined && (
                  <Text style={{ fontSize: 12, color: '#4A3B39' }}>Âge : {item.age} ans</Text>
                )}
                {item.linkedTo ? (
                  <Text style={{ fontSize: 12, color: '#4A3B39' }}>
                    En couple avec : <Text style={{ fontWeight: '700' }}>{item.partnerPseudo || item.linkedTo}</Text>
                    {item.coupleDate ? ` (depuis le ${item.coupleDate})` : ''}
                  </Text>
                ) : null}
                {item.pairingCode ? (
                  <Text style={{ fontSize: 11, color: '#8B5CF6', fontWeight: '600' }}>
                    Code sync : {item.pairingCode}
                  </Text>
                ) : null}
              </View>

              <Pressable
                style={[
                  s.saveBtn,
                  {
                    backgroundColor: '#EF4444',
                    flexDirection: 'row',
                    gap: 8,
                    alignSelf: 'flex-start',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginTop: 4,
                  },
                ]}
                onPress={() => handleDelete(item)}
                disabled={deletingUid === item.uid}
              >
                {deletingUid === item.uid ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Trash2 size={14} color="white" />
                    <Text style={[s.saveBtnTxt, { fontSize: 12 }]}>{"Supprimer l'utilisateur"}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ color: '#A99693' }}>Aucun utilisateur trouvé</Text>
          </View>
        }
      />
    </View>
  );
}

// ─── Tab Alertes ─────────────────────────────────────────────────────────────

function AlertsTab({ couples, messages, loading }: { couples: CoupleData[]; messages: ContactMessage[]; loading: boolean }) {
  const [now] = useState(() => Date.now());

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#FF9A8B" size="large" />;

  const catThreshold = 0.8; // 80%

  type AlertItem = { id: string; icon: string; title: string; detail: string; color: string };
  const alerts: AlertItem[] = [];

  // Questions épuisées par thème
  for (const couple of couples) {
    const catStats = countByCategory(couple.seenQuestions);
    for (const [cat, stat] of Object.entries(catStats)) {
      if (stat.pct >= catThreshold * 100) {
        alerts.push({
          id: `${couple.id}_${cat}`,
          icon: '📚',
          color: '#EF4444',
          title: `${couple.members.map(m => m.pseudo).join(' & ')}`,
          detail: `Thème "${cat}" : ${stat.seen}/${stat.total} questions (${stat.pct}%)`,
        });
      }
    }
  }

  // Streaks très élevés (>50)
  for (const couple of couples) {
    const streak = couple.wallet?.streak ?? 0;
    if (streak >= 50) {
      alerts.push({
        id: `${couple.id}_streak`,
        icon: '🔥',
        color: '#F59E0B',
        title: `${couple.members.map(m => m.pseudo).join(' & ')}`,
        detail: `Série de ${streak} jours — félicitations !`,
      });
    }
  }

  // Quêtes unclaimed
  for (const couple of couples) {
    const unclaimedCount = Object.values(couple.questProgress)
      .reduce((acc, p) => acc + (p.unclaimedTiers?.length ?? 0), 0);
    if (unclaimedCount > 0) {
      alerts.push({
        id: `${couple.id}_unclaimed`,
        icon: '🎁',
        color: '#8B5CF6',
        title: `${couple.members.map(m => m.pseudo).join(' & ')}`,
        detail: `${unclaimedCount} récompense${unclaimedCount > 1 ? 's' : ''} de quête non réclamée${unclaimedCount > 1 ? 's' : ''}`,
      });
    }
  }

  // Messages non lus depuis longtemps
  for (const msg of messages) {
    if (msg.status === 'unread' && msg.createdAt) {
      const ts = msg.createdAt.toDate ? msg.createdAt.toDate().getTime() : new Date(msg.createdAt).getTime();
      const hoursAgo = (now - ts) / (1000 * 3600);
      if (hoursAgo >= 48) {
        alerts.push({
          id: `msg_${msg.id}`,
          icon: '✉️',
          color: '#EF4444',
          title: `Message non lu de ${msg.name}`,
          detail: `Catégorie : ${msg.category} · il y a ${Math.floor(hoursAgo / 24)}j`,
        });
      }
    }
  }

  if (alerts.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 36 }}>✅</Text>
        <Text style={{ color: '#A99693', fontSize: 16, fontWeight: '700' }}>Aucune alerte</Text>
        <Text style={{ color: '#C4B4B2', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
          Tout semble aller bien !
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={alerts}
      keyExtractor={a => a.id}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
      renderItem={({ item }) => (
        <View style={[s.alertCard, { borderLeftColor: item.color }]}>
          <Text style={s.alertIcon}>{item.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.alertTitle}>{item.title}</Text>
            <Text style={s.alertDetail}>{item.detail}</Text>
          </View>
        </View>
      )}
    />
  );
}

// ─── Tab Debug ────────────────────────────────────────────────────────────────

function DebugTab({ couples, onRefresh }: { couples: CoupleData[]; onRefresh: () => void }) {
  const [targetCoupleId, setTargetCoupleId] = useState('');
  const [petalAmount, setPetalAmount] = useState('100');
  const [overrideDate, setOverrideDate] = useState('');
  const [savedOverride, setSavedOverride] = useState('');
  const [loading, setLoading] = useState(false);
  const [diagSearch, setDiagSearch] = useState('');
  const [diagResult, setDiagResult] = useState<{
    userA: { uid: string; pseudo?: string; email?: string; linkedTo?: string; coupleDate?: string };
    userB?: { uid: string; pseudo?: string; email?: string; linkedTo?: string; coupleDate?: string };
    isReciprocal: boolean;
  } | null>(null);

  const runDiagnostic = async () => {
    if (!diagSearch.trim()) return Alert.alert('⚠️', 'Saisir un email, pseudo ou UID');
    setLoading(true);
    try {
      const qText = diagSearch.trim().toLowerCase();
      const usersSnap = await getDocs(collection(db, 'users'));
      let foundUser: any = null;
      let foundUid = '';

      for (const d of usersSnap.docs) {
        const u = d.data();
        if (
          d.id === diagSearch.trim() ||
          (u.email && u.email.toLowerCase() === qText) ||
          (u.pseudo && u.pseudo.toLowerCase() === qText)
        ) {
          foundUser = u;
          foundUid = d.id;
          break;
        }
      }

      if (!foundUser) {
        Alert.alert('Introuvable', `Aucun utilisateur ne correspond à "${diagSearch.trim()}".`);
        setLoading(false);
        return;
      }

      const userA = { uid: foundUid, pseudo: foundUser.pseudo, email: foundUser.email, linkedTo: foundUser.linkedTo, coupleDate: foundUser.coupleDate };
      let userB: any = undefined;
      let isReciprocal = false;

      if (foundUser.linkedTo) {
        const partnerDoc = await getDoc(doc(db, 'users', foundUser.linkedTo));
        if (partnerDoc.exists()) {
          const pb = partnerDoc.data();
          userB = { uid: partnerDoc.id, pseudo: pb.pseudo, email: pb.email, linkedTo: pb.linkedTo, coupleDate: pb.coupleDate };
          isReciprocal = pb.linkedTo === foundUid;
        }
      }

      setDiagResult({ userA, userB, isReciprocal });
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  };

  const repairMutualLink = async () => {
    if (!diagResult?.userA || !diagResult?.userB) return;
    setLoading(true);
    try {
      const uidA = diagResult.userA.uid;
      const uidB = diagResult.userB.uid;
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', uidA), { linkedTo: uidB });
      batch.update(doc(db, 'users', uidB), { linkedTo: uidA });
      await batch.commit();
      Alert.alert('✅ Succès', `Liaison réparée entre ${diagResult.userA.pseudo || uidA} et ${diagResult.userB.pseudo || uidB} !`);
      setDiagResult(prev => prev ? { ...prev, isReciprocal: true, userB: prev.userB ? { ...prev.userB, linkedTo: uidA } : undefined } : null);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem('debug_date_override').then(v => {
      if (v) { setOverrideDate(v); setSavedOverride(v); }
    });
  }, []);

  const applyDateOverride = async () => {
    if (overrideDate.trim()) {
      await AsyncStorage.setItem('debug_date_override', overrideDate.trim());
      setSavedOverride(overrideDate.trim());
      Alert.alert('✅ Date override sauvegardée', `Les composants utilisant todayKey() doivent être mis à jour pour lire cet override.\nDate: ${overrideDate.trim()}`);
    } else {
      await AsyncStorage.removeItem('debug_date_override');
      setSavedOverride('');
      Alert.alert('🗑 Override supprimé', 'La date système sera utilisée.');
    }
  };

  const syncLegacyStreaks = async () => {
    Alert.alert(
      '⚠️ Confirmer',
      'Calculer les vraies séries pour TOUS les couples (basé sur couples/daily) et mettre à jour wallet.streak ?\nCela peut prendre du temps.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, synchroniser',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              let updated = 0;
              for (const c of couples) {
                const calculatedStreak = await computeStreak(c.id);
                const storedStreak = c.wallet?.streak ?? 0;
                // Never replace a historical value when the current daily data
                // is incomplete or older than the migration window.
                const streak = Math.max(calculatedStreak, storedStreak);

                if (streak !== storedStreak) {
                  const walletRef = doc(db, `couples/${c.id}/economy/wallet`);
                  const walletSnap = await getDoc(walletRef);
                  const current = walletSnap.exists() ? walletSnap.data() : { petals: 0, streak: 0, lastClaimDate: '', totalEarned: 0 };
                  await setDoc(walletRef, { ...current, streak }, { merge: true });
                  updated++;
                }
              }
              onRefresh();
              Alert.alert('✅ Terminé', `${updated} couples mis à jour avec leur véritable série !`);
            } catch (e) {
              Alert.alert('Erreur', String(e));
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const cleanupFirestoreData = async () => {
    Alert.alert(
      '🧹 Nettoyage Firebase',
      'Cette action analyse et nettoie :\n- Les codes de synchronisation (6 chiffres) obsolètes ou orphelins (créateur supprimé ou déjà jumelé)\n- Les profils cosmétiques orphelins\n\nConfirmer le nettoyage ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Nettoyer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              let deletedCodes = 0;
              let deletedProfiles = 0;

              // 1. Lire tous les users
              const usersSnap = await getDocs(collection(db, 'users'));
              const existingUsers = new Map<string, any>();
              usersSnap.forEach((d) => existingUsers.set(d.id, d.data()));

              // 2. Nettoyer pairing_codes
              const codesSnap = await getDocs(collection(db, 'pairing_codes'));
              for (const cDoc of codesSnap.docs) {
                const data = cDoc.data();
                const creator = data.creatorUid || data.uid;

                // Si créateur absent des users
                if (!creator || !existingUsers.has(creator)) {
                  await deleteDoc(cDoc.ref);
                  deletedCodes++;
                  continue;
                }

                // Si le créateur est déjà appairé à un partenaire actif ou si son code actuel diffère
                const u = existingUsers.get(creator);
                if (u?.linkedTo || (u?.pairingCode && u.pairingCode !== cDoc.id)) {
                  await deleteDoc(cDoc.ref);
                  deletedCodes++;
                }
              }

              // 3. Nettoyer userProfiles orphelins
              const profilesSnap = await getDocs(collection(db, 'userProfiles'));
              for (const pDoc of profilesSnap.docs) {
                if (!existingUsers.has(pDoc.id)) {
                  await deleteDoc(pDoc.ref);
                  deletedProfiles++;
                }
              }

              Alert.alert(
                '✅ Nettoyage terminé',
                `Résultats du nettoyage :\n• ${deletedCodes} codes de jumelage obsolètes supprimés\n• ${deletedProfiles} profils orphelins supprimés`
              );
              onRefresh();
            } catch (e) {
              Alert.alert('Erreur', String(e));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const addPetals = async () => {
    if (!targetCoupleId.trim()) return Alert.alert('⚠️', 'Saisir un coupleId');
    const amount = parseInt(petalAmount);
    if (isNaN(amount)) return Alert.alert('⚠️', 'Montant invalide');
    setLoading(true);
    try {
      const walletRef = doc(db, `couples/${targetCoupleId}/economy/wallet`);
      const snap = await getDoc(walletRef);
      if (!snap.exists()) return Alert.alert('Erreur', 'Couple introuvable');
      const current = snap.data();
      await updateDoc(walletRef, {
        petals: (current.petals ?? 0) + amount,
        totalEarned: amount > 0 ? (current.totalEarned ?? 0) + amount : current.totalEarned,
      });
      Alert.alert('✅ Fait !', `${amount > 0 ? '+' : ''}${amount} pétales sur ${targetCoupleId.slice(0, 16)}...`);
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setLoading(false);
    }
  };

  const resetSeenQuestions = async () => {
    if (!targetCoupleId.trim()) return Alert.alert('⚠️', 'Saisir un coupleId');
    Alert.alert(
      '⚠️ Confirmer',
      'Réinitialiser TOUTES les questions vues pour ce couple ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            await setDoc(doc(db, `couples/${targetCoupleId}/progress/seen`), { questionIds: [], updatedAt: new Date() });
            Alert.alert('✅ Reset', 'Questions vues réinitialisées');
          } catch (e) {
            Alert.alert('Erreur', String(e));
          } finally {
            setLoading(false);
          }
        }},
      ]
    );
  };

  const resetDailyClaim = async () => {
    if (!targetCoupleId.trim()) return Alert.alert('⚠️', 'Saisir un coupleId');
    setLoading(true);
    try {
      const walletRef = doc(db, `couples/${targetCoupleId}/economy/wallet`);
      await setDoc(walletRef, { lastClaimDate: '' }, { merge: true });
      Alert.alert('✅ Reset Roue', `Tu peux relancer la roue pour ${targetCoupleId.slice(0, 16)}...`);
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setLoading(false);
    }
  };

  const resetDailySlot = async () => {
    if (!targetCoupleId.trim()) return Alert.alert('⚠️', 'Saisir un coupleId');
    const today = new Date().toISOString().split('T')[0];
    setLoading(true);
    try {
      // Supprimer le slot du jour et les réponses
      const slotRef = doc(db, `couples/${targetCoupleId}/daily/${today}`);
      await setDoc(slotRef, { deleted: true }, { merge: false }); // reset
      Alert.alert('✅ Reset daily', `Slot du ${today} réinitialisé — une nouvelle question sera piochée`);
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
      {/* Couple cible */}
      <View style={s.debugSection}>
        <Text style={s.debugTitle}>🎯 Couple cible</Text>
        <Text style={s.debugHint}>Colle un coupleId ou choisis dans la liste :</Text>
        <TextInput
          style={s.smallInput}
          value={targetCoupleId}
          onChangeText={setTargetCoupleId}
          placeholder="uid1_uid2 ou coupleId"
          placeholderTextColor="#C4B4B2"
          autoCapitalize="none"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {couples.slice(0, 10).map(c => (
              <Pressable key={c.id} style={[s.quickChip, targetCoupleId === c.id && s.quickChipActive]} onPress={() => setTargetCoupleId(c.id)}>
                <Text style={[s.quickChipTxt, targetCoupleId === c.id && { color: 'white' }]}>
                  {c.members.map(m => m.pseudo).join(' & ')}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Pétales */}
      <View style={s.debugSection}>
        <Text style={s.debugTitle}>🌸 Modifier les pétales</Text>
        <View style={[s.row, { alignItems: 'center', gap: 6 }]}>
          <Pressable
            style={[s.signBtn, { backgroundColor: '#22c55e' }]}
            onPress={() => {
              setPetalAmount(prev => {
                const clean = prev.replace(/^[+-]/, '');
                return clean ? `+${clean}` : '+';
              });
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>+</Text>
          </Pressable>
          <Pressable
            style={[s.signBtn, { backgroundColor: '#ef4444' }]}
            onPress={() => {
              setPetalAmount(prev => {
                const clean = prev.replace(/^[+-]/, '');
                return clean ? `-${clean}` : '-';
              });
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>-</Text>
          </Pressable>
          <TextInput
            style={[s.smallInput, { flex: 1, marginBottom: 0 }]}
            value={petalAmount}
            onChangeText={setPetalAmount}
            placeholder="+500 ou -200"
            keyboardType="default"
            placeholderTextColor="#C4B4B2"
          />
          <Pressable style={s.saveBtn} onPress={addPetals} disabled={loading}>
            <Text style={s.saveBtnTxt}>Appliquer</Text>
          </Pressable>
        </View>
      </View>

      {/* Diagnostic & Réparation de Liaison Couple */}
      <View style={s.debugSection}>
        <Text style={s.debugTitle}>🔍 Diagnostic & Réparation de Couple</Text>
        <Text style={s.debugHint}>Vérifie et répare la réciprocité des liens (ex: Patrick & Jules)</Text>
        <View style={s.row}>
          <TextInput
            style={[s.smallInput, { flex: 1, marginBottom: 0 }]}
            value={diagSearch}
            onChangeText={setDiagSearch}
            placeholder="Email, UID ou pseudo de l'utilisateur"
            placeholderTextColor="#C4B4B2"
            autoCapitalize="none"
          />
          <Pressable style={s.saveBtn} onPress={runDiagnostic} disabled={loading}>
            <Text style={s.saveBtnTxt}>Diagnostiquer</Text>
          </Pressable>
        </View>

        {diagResult && (
          <View style={{ marginTop: 12, padding: 12, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12, gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: 'bold' }}>👤 Utilisateur A : {diagResult.userA.pseudo || 'Sans pseudo'} ({diagResult.userA.uid})</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>Email : {diagResult.userA.email || 'N/A'} | linkedTo : {diagResult.userA.linkedTo || 'aucun'}</Text>
            {diagResult.userB ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: 'bold', marginTop: 4 }}>👤 Utilisateur B : {diagResult.userB.pseudo || 'Sans pseudo'} ({diagResult.userB.uid})</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>Email : {diagResult.userB.email || 'N/A'} | linkedTo : {diagResult.userB.linkedTo || 'aucun'}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: diagResult.isReciprocal ? '#22C55E' : '#EF4444', marginTop: 4 }}>
                  {diagResult.isReciprocal ? '✅ Liaison réciproque valide' : '⚠️ Liaison asymétrique ou brisée !'}
                </Text>
                {!diagResult.isReciprocal && (
                  <Pressable style={[s.actionBtn, { backgroundColor: '#FF6A88', marginTop: 8 }]} onPress={repairMutualLink} disabled={loading}>
                    <Text style={[s.actionBtnText, { color: 'white' }]}>Réparer la liaison réciproque</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 12, color: '#F59E0B', marginTop: 4 }}>⚠️ Aucun partenaire trouvé pour ce linkedTo.</Text>
            )}
          </View>
        )}
      </View>

      {/* Utilitaires Globaux */}
      <View style={s.debugSection}>
        <Text style={s.debugTitle}>🔧 Utilitaires globaux</Text>
        <Text style={s.debugHint}>Actions appliquées à toute la base de données :</Text>
        <Pressable onPress={syncLegacyStreaks} style={[s.actionBtn, { backgroundColor: '#F59E0B' }]} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={[s.actionBtnText, { color: 'white' }]}>Synchroniser les anciennes Séries (Streaks)</Text>}
        </Pressable>
        <Pressable onPress={cleanupFirestoreData} style={[s.actionBtn, { backgroundColor: '#EF4444', marginTop: 10 }]} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={[s.actionBtnText, { color: 'white' }]}>🧹 Nettoyer Firebase (Codes 6 chiffres & orphelins)</Text>}
        </Pressable>
      </View>

      {/* Override date */}
      <View style={s.debugSection}>
        <Text style={s.debugTitle}>📅 Override date locale</Text>
        <Text style={s.debugHint}>Simule une autre date pour tester le daily claim (YYYY-MM-DD)</Text>
        {savedOverride ? <Text style={{ color: '#22C55E', fontSize: 12, marginBottom: 4 }}>✅ Override actif : {savedOverride}</Text> : null}
        <View style={s.row}>
          <TextInput
            style={[s.smallInput, { flex: 1, marginBottom: 0 }]}
            value={overrideDate}
            onChangeText={setOverrideDate}
            placeholder="2026-08-21 (vide = désactiver)"
            placeholderTextColor="#C4B4B2"
          />
          <Pressable style={s.saveBtn} onPress={applyDateOverride}>
            <Text style={s.saveBtnTxt}>Sauver</Text>
          </Pressable>
        </View>
      </View>

      {/* Reset daily slot */}
      <View style={s.debugSection}>
        <Text style={s.debugTitle}>🔄 Reset slot question du jour</Text>
        <Text style={s.debugHint}>Supprime la question du jour pour ce couple (nouvelle sera tirée au sort)</Text>
        <Pressable style={[s.saveBtn, { backgroundColor: '#F59E0B' }]} onPress={resetDailySlot} disabled={loading}>
          <Text style={s.saveBtnTxt}>Reset daily slot</Text>
        </Pressable>
      </View>

      {/* Reset Roue */}
      <View style={s.debugSection}>
        <Text style={s.debugTitle}>🎡 Reset Roue Quotidienne</Text>
        <Text style={s.debugHint}>Permet au couple de relancer la roue de récompenses aujourd&apos;hui</Text>
        <Pressable style={[s.saveBtn, { backgroundColor: '#8B5CF6' }]} onPress={resetDailyClaim} disabled={loading}>
          <Text style={s.saveBtnTxt}>Reset Roue</Text>
        </Pressable>
      </View>

      {/* Reset questions vues */}
      <View style={s.debugSection}>
        <Text style={s.debugTitle}>🗑 Reset questions vues</Text>
        <Text style={s.debugHint}>{'⚠️ Irréversible : remet toutes les questions comme "non vues"'}</Text>
        <Pressable style={[s.saveBtn, { backgroundColor: '#EF4444' }]} onPress={resetSeenQuestions} disabled={loading}>
          <Text style={s.saveBtnTxt}>Reset toutes les questions</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator color="#FF9A8B" />}
    </ScrollView>
  );
}

// ─── Tab Messages ─────────────────────────────────────────────────────────────

function MessagesTab({ messages, loading, onRefresh, onMarkRead }: {
  messages: ContactMessage[]; loading: boolean; onRefresh: () => void; onMarkRead: (id: string) => void;
}) {
  const [filterStatus, setFilter] = useState<ContactStatus | 'all'>('all');
  const [replyTarget, setReplyTarget] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const unreadCount = messages.filter(m => m.status === 'unread').length;
  const displayed = filterStatus === 'all' ? messages : messages.filter(m => m.status === filterStatus);

  const handleSendReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await updateDoc(doc(db, 'contacts', replyTarget.id), {
        status: 'replied', reply: replyText.trim(), repliedAt: serverTimestamp(),
      });
      Linking.openURL(`mailto:${replyTarget.email}?subject=Re: NousDeux - ${CATEGORY_META[replyTarget.category]?.label}&body=${encodeURIComponent(`Bonjour ${replyTarget.name},\n\n${replyText.trim()}\n\nL'équipe NousDeux 🌸`)}`);
      setReplyTarget(null); setReplyText('');
      onRefresh();
    } catch { Alert.alert('Erreur', 'Impossible de sauvegarder la réponse.'); }
    finally { setSendingReply(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.filters}>
        {(['all', 'unread', 'read', 'replied'] as const).map(f => (
          <Pressable key={f} style={[s.filterChip, filterStatus === f && s.filterChipActive]} onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filterStatus === f && s.filterTextActive]}>
              {f === 'all' ? 'Tous' : STATUS_META[f as ContactStatus].label}
              {f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {replyTarget && (
        <View style={s.replyModal}>
          <Text style={s.replyModalTitle}>Répondre à {replyTarget.name}</Text>
          <TextInput style={s.replyInput} value={replyText} onChangeText={setReplyText} placeholder="Ta réponse..." multiline numberOfLines={4} textAlignVertical="top" placeholderTextColor="#C4B4B2" />
          <View style={s.replyModalActions}>
            <Pressable onPress={() => { setReplyTarget(null); setReplyText(''); }} style={s.replyCancel}>
              <Text style={{ color: '#A99693', fontWeight: '600' }}>Annuler</Text>
            </Pressable>
            <Pressable onPress={handleSendReply} style={s.replySend} disabled={sendingReply}>
              {sendingReply ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: 'white', fontWeight: '700' }}>Sauver & email</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#FF9A8B" size="large" />
      ) : displayed.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 36 }}>📭</Text>
          <Text style={{ color: '#A99693' }}>Aucun message</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          renderItem={({ item }) => <MessageCard msg={item} onMarkRead={onMarkRead} onReply={setReplyTarget} />}
        />
      )}
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdminScreen() {
  const topInset = useTopInset();
  const [authUid, setAuthUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [authReady, setAuthReady] = useState(Boolean(auth.currentUser));
  useEffect(() => onAuthStateChanged(auth, user => {
    setAuthUid(user?.uid ?? null);
    setAuthReady(true);
  }), []);
  const myUid = authUid ?? useOnboardingStore.getState().uid;
  const isAdmin = authReady && isUserAdmin(myUid);

  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [couples, setCouples] = useState<CoupleData[]>([]);
  const [totalFirebaseUsers, setTotalFirebaseUsers] = useState(0);
  const [usersList, setUsersList] = useState<AdminUserData[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loadingCouples, setLoadingCouples] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);

  const fetchCouples = useCallback(async () => {
    setLoadingCouples(true);
    try {
      const data = await fetchAllCouples();
      setCouples(data.couples);
      setTotalFirebaseUsers(data.totalUsers);
      setUsersList(data.usersList);
    } catch (e) {
      console.error('[Admin] fetchCouples', e);
    } finally {
      setLoadingCouples(false);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const q = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContactMessage)));
    } catch (e) {
      console.error('[Admin] fetchMessages', e);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const [mountTime] = useState(() => Date.now());

  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => {
      fetchCouples();
      fetchMessages();
    }, 0);
    return () => clearTimeout(t);
  }, [isAdmin, fetchCouples, fetchMessages]);

  const handleMarkRead = async (id: string) => {
    await updateDoc(doc(db, 'contacts', id), { status: 'read' });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'read' } : m));
  };

  const handleRefreshAll = () => { fetchCouples(); fetchMessages(); };

  // ── Accès refusé ──────────────────────────────────────────────────────────
  if (!authReady) {
    return <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color="#FF6A88" /></View>;
  }
  if (!isAdmin) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', gap: 12 }]}>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#4A3B39' }}>Accès restreint</Text>
        <Text style={{ color: '#A99693', textAlign: 'center', paddingHorizontal: 40 }}>
          {myUid ? `Ton UID (${myUid.slice(0, 8)}...) n'est pas admin.\nAjoute-le dans admin.tsx` : 'Connecte-toi pour accéder à cette page.'}
        </Text>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')} style={s.backHome}>
          <Text style={s.backHomeText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const unreadCount = messages.filter(m => m.status === 'unread').length;
  const alertCount = (() => {
    let count = 0;
    for (const c of couples) {
      const catStats = countByCategory(c.seenQuestions);
      for (const st of Object.values(catStats)) if (st.pct >= 80) count++;
      if ((c.wallet?.streak ?? 0) >= 50) count++;
      const unclaimed = Object.values(c.questProgress).reduce((acc, p) => acc + (p.unclaimedTiers?.length ?? 0), 0);
      if (unclaimed > 0) count++;
    }
    const now = mountTime;
    for (const msg of messages) {
      if (msg.status === 'unread' && msg.createdAt) {
        const ts = msg.createdAt.toDate ? msg.createdAt.toDate().getTime() : new Date(msg.createdAt).getTime();
        if ((now - ts) / (1000 * 3600) >= 48) count++;
      }
    }
    return count;
  })();

  const TABS: { key: Tab; label: string; icon: any; badge?: number }[] = [
    { key: 'stats', label: 'Stats', icon: BarChart3 },
    { key: 'users', label: 'Users', icon: CircleUser },
    { key: 'couples', label: 'Couples', icon: Users },
    { key: 'alerts', label: 'Alertes', icon: Bell, badge: alertCount },
    { key: 'debug', label: 'Debug', icon: Wrench },
    { key: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadCount },
  ];

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient colors={['#1A0A00', '#3D2B1F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.header, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')} style={s.backBtn}>
          <ArrowLeft color="white" size={24} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Admin 🔒</Text>
          <Text style={s.headerSub}>{totalFirebaseUsers} users · {couples.length} couples · {messages.length} messages</Text>
        </View>
        <Pressable onPress={handleRefreshAll} style={s.refreshBtn}>
          <RefreshCw color="white" size={20} />
        </Pressable>
      </LinearGradient>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <Pressable key={tab.key} style={[s.tabItem, active && s.tabItemActive]} onPress={() => setActiveTab(tab.key)}>
              <View style={{ position: 'relative' }}>
                <Icon size={18} color={active ? '#FF6A88' : '#A99693'} />
                {(tab.badge ?? 0) > 0 && (
                  <View style={s.tabBadge}>
                    <Text style={s.tabBadgeTxt}>{tab.badge! > 9 ? '9+' : tab.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Contenu */}
      <View style={{ flex: 1 }}>
        {activeTab === 'stats' && <StatsTab couples={couples} messages={messages} loading={loadingCouples} totalFirebaseUsers={totalFirebaseUsers} onNavigateTab={setActiveTab} />}
        {activeTab === 'users' && <UsersTab users={usersList} loading={loadingCouples} onRefresh={fetchCouples} />}
        {activeTab === 'couples' && <CouplesTab couples={couples} loading={loadingCouples} onRefresh={fetchCouples} />}
        {activeTab === 'alerts' && <AlertsTab couples={couples} messages={messages} loading={loadingCouples} />}
        {activeTab === 'debug' && <DebugTab couples={couples} onRefresh={handleRefreshAll} />}
        {activeTab === 'messages' && <MessagesTab messages={messages} loading={loadingMessages} onRefresh={fetchMessages} onMarkRead={handleMarkRead} />}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F2' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: { padding: 4 },
  refreshBtn: { padding: 4 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: 'rgba(255,154,139,0.15)' },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#FF6A88' },
  tabLabel: { fontSize: 10, fontWeight: '600', color: '#A99693' },
  tabLabelActive: { color: '#FF6A88' },
  tabBadge: { position: 'absolute', top: -6, right: -8, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  tabBadgeTxt: { color: 'white', fontSize: 9, fontWeight: '800' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { backgroundColor: 'white', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, flex: 1, minWidth: 90, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  kpiIcon: { fontSize: 22 },
  kpiValue: { fontSize: 18, fontWeight: '800' },
  kpiLabel: { fontSize: 10, color: '#A99693', fontWeight: '600', textAlign: 'center' },

  section: { backgroundColor: 'white', borderRadius: 16, padding: 16, gap: 10, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#4A3B39', marginBottom: 4 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 50, fontSize: 11, color: '#A99693', fontWeight: '600' },
  barTrack: { flex: 1, height: 10, backgroundColor: 'rgba(255,154,139,0.15)', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  barCount: { width: 24, fontSize: 11, color: '#4A3B39', fontWeight: '700', textAlign: 'right' },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,154,139,0.1)' },
  topRank: { fontSize: 12, fontWeight: '800', color: '#A99693', width: 24 },
  topName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#4A3B39' },
  topValue: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: 'rgba(255,154,139,0.15)' },
  searchInput: { flex: 1, fontSize: 14, color: '#4A3B39' },

  // Couple card
  coupleCard: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,154,139,0.15)', overflow: 'hidden', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  coupleHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  coupleName: { fontSize: 15, fontWeight: '800', color: '#4A3B39' },
  coupleId: { fontSize: 10, color: '#A99693', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  coupleBadges: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(255,107,136,0.1)' },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: '#4A3B39' },
  coupleBody: { borderTopWidth: 1, borderTopColor: 'rgba(255,154,139,0.1)', padding: 14, gap: 12 },

  // Sub-tabs
  subTabs: { flexDirection: 'row', backgroundColor: '#FFF5F2', borderRadius: 10, padding: 2, gap: 2 },
  subTab: { flex: 1, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center' },
  subTabActive: { backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  subTabTxt: { fontSize: 10, fontWeight: '600', color: '#A99693' },
  subTabTxtActive: { color: '#FF6A88' },

  // Edit section
  editSection: { gap: 8 },
  editLabel: { fontSize: 12, fontWeight: '700', color: '#4A3B39', marginTop: 4 },
  smallInput: { backgroundColor: '#FFF5F2', borderRadius: 10, padding: 10, fontSize: 14, color: '#4A3B39', borderWidth: 1.5, borderColor: 'rgba(255,154,139,0.2)', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signBtn: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  saveBtn: { backgroundColor: '#FF6A88', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt: { color: 'white', fontWeight: '700', fontSize: 13 },

  // Preset buttons
  presetBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,154,139,0.12)', borderWidth: 1, borderColor: 'rgba(255,154,139,0.2)' },
  presetBtnActive: { backgroundColor: '#FF6A88', borderColor: '#FF6A88' },
  presetBtnTxt: { fontSize: 11, fontWeight: '700', color: '#FF6A88' },
  presetBtnTxtActive: { color: 'white' },

  // Quest row
  questRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,154,139,0.1)', flexDirection: 'column', gap: 4 },
  questName: { fontSize: 13, fontWeight: '700', color: '#4A3B39' },
  questDesc: { fontSize: 11, color: '#A99693' },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,154,139,0.15)', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', backgroundColor: '#FF9A8B', borderRadius: 3 },
  tierBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, fontSize: 9, color: 'white', fontWeight: '800', overflow: 'hidden' } as any,
  editIcon: { padding: 6, alignSelf: 'flex-end' },

  // Cosmetics
  cosmeticType: { fontSize: 13, fontWeight: '800', color: '#4A3B39', marginBottom: 6, marginTop: 8 },
  cosmeticRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, gap: 8, marginBottom: 2 },
  cosmeticOwned: { backgroundColor: 'rgba(34,197,94,0.06)' },
  cosmeticName: { fontSize: 13, fontWeight: '700', color: '#4A3B39' },
  cosmeticId: { fontSize: 10, color: '#A99693', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  ownBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

  // Questions par catégorie
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catLabel: { width: 80, fontSize: 11, color: '#4A3B39', fontWeight: '600' },
  catBarTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,154,139,0.15)', borderRadius: 4, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 4 },
  catPct: { fontSize: 11, color: '#A99693', width: 50, textAlign: 'right' },

  // Alerts
  alertCard: { backgroundColor: 'white', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  alertIcon: { fontSize: 22 },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#4A3B39' },
  alertDetail: { fontSize: 12, color: '#A99693', marginTop: 2 },

  // Debug
  debugSection: { backgroundColor: 'white', borderRadius: 16, padding: 16, gap: 8, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  debugTitle: { fontSize: 15, fontWeight: '800', color: '#4A3B39' },
  debugHint: { fontSize: 12, color: '#A99693', lineHeight: 16 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(74,59,57,0.07)' },
  quickChipActive: { backgroundColor: '#FF6A88' },
  quickChipTxt: { fontSize: 12, fontWeight: '600', color: '#A99693' },

  // Messages
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, flexWrap: 'wrap', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: 'rgba(255,154,139,0.15)' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(74,59,57,0.07)' },
  filterChipActive: { backgroundColor: '#FF9A8B' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#A99693' },
  filterTextActive: { color: 'white' },

  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: 'rgba(255,154,139,0.15)', gap: 10, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  cardUnread: { borderColor: '#EF4444', borderWidth: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  catBadgeText: { fontSize: 11, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDate: { fontSize: 11, color: '#A99693', marginLeft: 'auto' },
  cardIdentity: { gap: 2 },
  cardName: { fontSize: 15, fontWeight: '800', color: '#4A3B39' },
  cardEmail: { fontSize: 13, color: '#FF9A8B' },
  cardPseudo: { fontSize: 11, color: '#A99693' },
  cardMessage: { fontSize: 14, color: '#4A3B39', lineHeight: 20 },
  replyBox: { backgroundColor: 'rgba(34,197,94,0.07)', borderRadius: 10, padding: 10, gap: 4, borderLeftWidth: 3, borderLeftColor: '#22C55E' },
  replyLabel: { fontSize: 11, fontWeight: '700', color: '#22C55E' },
  replyText: { fontSize: 13, color: '#4A3B39', lineHeight: 18 },
  replyDate: { fontSize: 10, color: '#A99693' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,154,139,0.1)', flex: 1, justifyContent: 'center' },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#FF9A8B' },
  replyModal: { margin: 16, backgroundColor: 'white', borderRadius: 20, padding: 20, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 },
  replyModalTitle: { fontSize: 16, fontWeight: '800', color: '#4A3B39' },
  replyInput: { backgroundColor: '#FFF5F2', borderRadius: 12, padding: 12, fontSize: 14, color: '#4A3B39', minHeight: 100, borderWidth: 1.5, borderColor: 'rgba(255,154,139,0.2)' },
  replyModalActions: { flexDirection: 'row', gap: 10 },
  replyCancel: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(74,59,57,0.07)', alignItems: 'center' },
  replySend: { flex: 2, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FF6A88', alignItems: 'center' },

  backHome: { marginTop: 16, backgroundColor: 'rgba(255,154,139,0.15)', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20 },
  backHomeText: { color: '#FF6A88', fontWeight: '700', fontSize: 15 },
});
