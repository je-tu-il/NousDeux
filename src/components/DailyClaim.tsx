import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import { Gift, Lock, X, Zap } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors } from '../constants/Colors';
import { calculateDailyPetals, claimDaily, WalletData } from '../lib/economy';
import { db } from '../lib/firebase';
import { useOnboardingStore } from '../store/onboardingStore';

interface Segment { multiplier: number; color: string; label: string; isJackpot?: boolean; isRespin?: boolean; }

const SEGMENTS: Segment[] = [
  { multiplier: 1.0,  color: '#FF9A8B', label: 'x1' },
  { multiplier: 1.25, color: '#FF6A88', label: 'x1.25' },
  { multiplier: 0.75, color: '#FFCDC8', label: 'x0.75' },
  { multiplier: 1.0,  color: '#FF9A8B', label: 'x1' },
  { multiplier: 3.0,  color: '#FFD700', label: 'x3', isJackpot: true },
  { multiplier: 1.0,  color: '#FF9A8B', label: 'x1' },
  { multiplier: 1.5,  color: '#FF4477', label: 'x1.5' },
  { multiplier: 0.0,  color: '#A8D8EA', label: 'Relance', isRespin: true },
];

const WEIGHTS = [24, 15, 8, 22, 4, 20, 5, 2];
const N = SEGMENTS.length;
const SEG_ANGLE = 360 / N;

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, endDeg);
  return `M ${cx} ${cy} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`;
}

function weightedRandom(): number {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let rnd = Math.random() * total;
  for (let i = 0; i < WEIGHTS.length; i++) {
    rnd -= WEIGHTS[i];
    if (rnd <= 0) return i;
  }
  return 0;
}

const WHEEL_SIZE = 280;
const R = 130;

const WheelSVG = memo(function WheelSVG({ base }: { base: number }) {
  return (
    <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox="-150 -150 300 300">
      {SEGMENTS.map((seg, i) => {
        const startDeg = i * SEG_ANGLE;
        const endDeg   = (i + 1) * SEG_ANGLE;
        return (
          <React.Fragment key={i}>
            <Path d={slicePath(0, 0, R, startDeg, endDeg)} fill={seg.color} stroke="white" strokeWidth={3} />
          </React.Fragment>
        );
      })}
      {/* Rim dots (casino style) */}
      {[...Array(24)].map((_, i) => {
        const dotAngle = (i * 360) / 24;
        const p = polarToXY(0, 0, R - 6, dotAngle);
        return <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={3} fill="#FFF9E6" opacity={0.8} />;
      })}
      
      <Circle cx={0} cy={0} r={24} fill="white" stroke="rgba(255,154,139,0.7)" strokeWidth={4} />
      <Circle cx={0} cy={0} r={10} fill="#FF9A8B" />
      <Circle cx={0} cy={0} r={R} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={4} />
      
      {/* Outer subtle shadow/border effect */}
      <Circle cx={0} cy={0} r={R + 2} fill="none" stroke="#FF6A88" strokeWidth={2} opacity={0.5} />
    </Svg>
  );
});

const Pointer = () => (
  <View style={ptrStyles.wrap} pointerEvents="none">
    <Svg width={30} height={35} viewBox="0 0 30 35">
      <Path d="M15 35 L0 10 Q15 0 30 10 Z" fill="#FF3366" stroke="white" strokeWidth={3} />
      <Circle cx={15} cy={12} r={4} fill="rgba(255,255,255,0.8)" />
    </Svg>
  </View>
);

const ptrStyles = StyleSheet.create({
  wrap: { position: 'absolute', top: -15, left: '50%', transform: [{ translateX: -15 }], zIndex: 40, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 8 },
});

interface DailyClaimProps {
  compact?: boolean; coupleId: string; myUid: string; wallet: WalletData | null; onClaimed: (newWallet: WalletData) => void; }

type Phase = 'loading' | 'locked' | 'button' | 'done';
type WheelPhase = 'idle' | 'spinning' | 'result';

// Même helper que economy.ts : date locale (évite bug UTC changement de mois)
function getLocalDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const DailyClaim = memo(function DailyClaim({ coupleId, myUid, wallet, onClaimed, compact = false }: DailyClaimProps) {
  const styles = getStyles(compact);
  const isDarkMode = useOnboardingStore((state) => state.isDarkMode);
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const today = getLocalDateKey(); // ✅ Date locale, pas UTC
  const alreadyClaimed = wallet?.dailyClaims?.[myUid] === today;
  const streak = wallet?.streak ?? 0;
  const base = Math.round(calculateDailyPetals(streak));

  const [phase, setPhase] = useState<Phase>(alreadyClaimed ? 'done' : 'loading');
  const [showModal, setShowModal] = useState(false);
  const [wheelPhase, setWheelPhase] = useState<WheelPhase>('idle');
  const [wonAmount, setWonAmount] = useState(0);
  const [claimedBalance, setClaimedBalance] = useState<number | null>(null);
  const [claimedTotalEarned, setClaimedTotalEarned] = useState<number | null>(null);
  const [wonSeg, setWonSeg] = useState<number | null>(null);

  const rotation = useSharedValue(0);
  const resultScale = useSharedValue(0);
  // Rotation lente continue sur l'icône du bouton trigger
  const triggerIconRotation = useSharedValue(0);

  // Démarre/arrête l'animation du bouton selon la phase
  useEffect(() => {
    if (phase === 'button') {
      triggerIconRotation.value = withRepeat(
        withTiming(360, { duration: 3000, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
        -1, // infini
        false
      );
    } else {
      triggerIconRotation.value = withTiming(0, { duration: 300 });
    }
  }, [phase]);

  const triggerIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${triggerIconRotation.value}deg` }],
  }));

  useEffect(() => {
    if (wallet === null) {
      setPhase('loading');
      const timeout = setTimeout(() => setPhase('locked'), 8000);
      return () => clearTimeout(timeout);
    }
    if (alreadyClaimed) { setPhase('done'); return; }
    if (!coupleId || !myUid) return;

    const partnerUid = coupleId.split('_').find(id => id !== myUid);
    const slotKey = today;

    Promise.all([
      getDoc(doc(db, 'couples', coupleId, 'daily', slotKey, 'answers', myUid)),
      partnerUid ? getDoc(doc(db, 'couples', coupleId, 'daily', slotKey, 'answers', partnerUid)) : Promise.resolve({ exists: () => false })
    ])
      .then(([mySnap, partnerSnap]) => {
        if (mySnap.exists() && partnerSnap.exists()) { setPhase('button'); } else { setPhase('locked'); }
      })
        .catch(() => setPhase('locked'));
      }, [coupleId, myUid, today, alreadyClaimed, wallet]);

  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const resultStyle = useAnimatedStyle(() => ({ transform: [{ scale: resultScale.value }], opacity: resultScale.value }));

  // Options du composant
  const WHEEL_SIZE_DYNAMIC = compact ? 220 : 280;

  // Calcul du gain cible au moment de cliquer
  const doSpin = useCallback(() => {
    if (wheelPhase === 'spinning') return;
    const segIdx = weightedRandom();
    const seg = SEGMENTS[segIdx];
    const amount = seg.isRespin ? 0 : Math.round(base * seg.multiplier);

    const currentNorm = rotation.value % 360;
    // Ajoute un décalage naturel de +/- 15 degrés pour ne pas atterrir pile au centre (évite l'impression de tomber sur la ligne)
    const randomOffset = (Math.random() - 0.5) * (SEG_ANGLE * 0.7); 
    const targetAngle = 360 - (segIdx * SEG_ANGLE + (SEG_ANGLE / 2) + randomOffset);
    let delta = targetAngle - currentNorm;
    if (delta < 0) delta += 360;
    
    // 10 tours complets supplémentaires + l'angle cible
    const totalRotation = rotation.value + 10 * 360 + delta;

    setWheelPhase('spinning');
    resultScale.value = 0;
    
    // Fallback animation easing (très fluide, pas de risque d'erreur bezier)
    rotation.value = withTiming(totalRotation, { 
      duration: 5500, 
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never 
    }, (finished) => {
      if (finished) runOnJS(onSpinDone)(segIdx, amount, seg.isRespin ?? false);
    });
  }, [wheelPhase, base, coupleId, rotation, resultScale]);

  const onSpinDone = useCallback(async (segIdx: number, amount: number, isRespinResult: boolean) => {
    setWonSeg(segIdx);

    if (isRespinResult) {
      setTimeout(() => { setWheelPhase('idle'); }, 1500);
      return;
    }
    const claim = await claimDaily(coupleId, myUid, amount);
    if (claim.alreadyClaimed) {
      setShowModal(false);
      setPhase('done');
      return;
    }
    setWonAmount(claim.petals);
    setClaimedBalance(claim.balance);
    setClaimedTotalEarned(claim.totalEarned);
    resultScale.value = withSpring(1, { damping: 10 });
    setWheelPhase('result');
  }, [coupleId, myUid, resultScale]);

  const handleCollect = () => {
    setShowModal(false);
    setPhase('done');
    const nextBalance = claimedBalance ?? ((wallet?.petals ?? 0) + wonAmount);
    onClaimed({ 
      petals: nextBalance,
      streak: (wallet?.streak ?? 0), 
      lastClaimDate: today, 
      totalEarned: claimedTotalEarned ?? ((wallet?.totalEarned ?? 0) + wonAmount),
      dailyClaims: { ...(wallet?.dailyClaims ?? {}), [myUid]: today },
    });
  };

  if (phase === 'loading') {
    return (
      <View style={[styles.triggerBox, styles.loadingBox]}>
        <ActivityIndicator color={theme.tint} size="small" />
        <Text style={styles.loadingText}>Chargement de la roulette...</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => { if (phase === 'button') setShowModal(true); }} style={({ pressed }) => [styles.triggerBox, { opacity: pressed && phase === 'button' ? 0.8 : 1 }]}>
        <LinearGradient colors={phase === 'done' ? (isDarkMode ? ['#302727', '#211B1B'] : ['#C9C9C9', '#E2E2E2']) : [theme.gradientStart, theme.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.triggerGradient}>
          <View style={styles.triggerContent}>
            <Animated.View style={[styles.iconCircle, phase === 'button' ? triggerIconStyle : undefined]}>
              {phase === 'locked' ? <Lock color="#FF6A88" size={20} /> : phase === 'done' ? <Gift color="#9E9E9E" size={20} /> : <Zap color="#FF6A88" size={20} />}
            </Animated.View>
            <View style={{ flex: 1, marginLeft: compact ? 0 : 12, alignItems: compact ? 'center' : 'flex-start' }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.triggerTitle, phase === 'done' && { color: '#757575' }]}>{phase === 'locked' ? 'Roulette bloquée' : phase === 'done' ? 'Déjà jouée' : 'Roulette du Jour'}</Text>
              <Text numberOfLines={2} adjustsFontSizeToFit style={[styles.triggerSub, phase === 'done' && { color: '#9E9E9E' }]}>{phase === 'locked' ? 'Répondez pour jouer' : phase === 'done' ? 'Reviens demain' : 'Disponible, tourne la !'}</Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {wheelPhase !== 'spinning' && wheelPhase !== 'result' && (
              <Pressable style={styles.closeBtn} onPress={() => setShowModal(false)}><X color="#A99693" size={24} /></Pressable>
            )}
            <Text style={[styles.modalTitle, { marginBottom: 20 }]}>Roulette de l'Amour</Text>
            
            <View style={styles.wheelOuter}>
              <Pointer />
              <Animated.View style={[styles.wheelWrapper, wheelStyle]}><WheelSVG base={base} /></Animated.View>
              {/* Overlay values over the SVG */}
              <Animated.View style={[styles.wheelOverlayWrapper, wheelStyle]}>
                {SEGMENTS.map((seg, i) => {
                  const mid = i * SEG_ANGLE + SEG_ANGLE / 2;
                  const tp = polarToXY(0, 0, R * 0.65, mid);
                  const amount = seg.isRespin ? '↺' : `${Math.round(base * seg.multiplier)}`;
                  return (
                    <View key={i} style={[styles.wheelLabelBox, { left: WHEEL_SIZE / 2 + tp.x - 20, top: WHEEL_SIZE / 2 + tp.y - 10, transform: [{ rotate: `${mid + 90}deg` }] }]}>
                      <Text style={[styles.wheelLabelText, { color: seg.isJackpot ? '#A07800' : 'white' }]}>{amount}</Text>
                    </View>
                  );
                })}
              </Animated.View>
              {wheelPhase === 'result' && (
                <Animated.View style={[{ position: 'absolute', zIndex: 30, alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: WHEEL_SIZE / 2 }, resultStyle]}>
                  <Text style={[styles.resultAmount, { opacity: 0.9, fontSize: 60, marginBottom: 0 }]}>+{wonAmount}</Text>
                </Animated.View>
              )}
            </View>

            {wheelPhase === 'result' ? (
              <Animated.View style={[resultStyle, { width: '100%' }]}>
                <Pressable style={styles.collectBtn} onPress={handleCollect}>
                  <Text style={styles.collectBtnText}>Collecter</Text>
                </Pressable>
              </Animated.View>
            ) : (
              <Pressable style={({ pressed }) => [styles.spinBtn, { opacity: pressed || wheelPhase === 'spinning' ? 0.7 : 1 }]} onPress={doSpin} disabled={wheelPhase === 'spinning'}>
                <LinearGradient colors={['#FF9A8B', '#FF3366']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.spinGradient}>
                  {wheelPhase === 'spinning' ? <ActivityIndicator color="white" /> : <Text style={styles.spinText}>Tourner !</Text>}
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
});

export default DailyClaim;

const getStyles = (compact: boolean) => StyleSheet.create({
  triggerBox: { marginHorizontal: compact ? 0 : 16, marginBottom: compact ? 0 : 16, flex: 1, height: '100%', borderRadius: 16, overflow: 'hidden', shadowColor: '#FF6A88', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  loadingBox: { backgroundColor: 'rgba(255,255,255,0.82)', justifyContent: 'center', alignItems: 'center', gap: 8 },
  loadingText: { color: '#6B5B59', fontSize: compact ? 10 : 13, fontWeight: '600' },
  triggerGradient: { padding: compact ? 12 : 16, flexDirection: compact ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  triggerContent: { flexDirection: compact ? 'column' : 'row', alignItems: 'center', flex: 1, gap: compact ? 6 : 0 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
  triggerTitle: { color: 'white', fontSize: compact ? 14 : 16, fontWeight: '800', textAlign: 'center' },
  triggerSub: { color: 'rgba(255,255,255,0.9)', fontSize: compact ? 10 : 13, textAlign: 'center', fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: 340, backgroundColor: 'white', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 4 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#4A3B39', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#A99693', marginBottom: 24 },

  wheelOuter: { width: WHEEL_SIZE, height: WHEEL_SIZE, alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 30 },
  wheelWrapper: { position: 'absolute', width: WHEEL_SIZE, height: WHEEL_SIZE },
  wheelOverlayWrapper: { position: 'absolute', width: WHEEL_SIZE, height: WHEEL_SIZE },
  wheelLabelBox: { position: 'absolute', width: 40, height: 20, justifyContent: 'center', alignItems: 'center' },
  wheelLabelText: { fontSize: 16, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  resultOverlay: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', borderRadius: 24, zIndex: 30 },
  resultAmount: { fontSize: 48, fontWeight: '900', color: '#FF6A88', textShadowColor: 'rgba(255,106,136,0.3)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10, marginBottom: 30 },
  collectBtn: { backgroundColor: '#FF6A88', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 20, shadowColor: '#FF6A88', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 },
  collectBtnText: { color: 'white', fontSize: 18, fontWeight: '800' },

  spinBtn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  spinGradient: { paddingVertical: 16, alignItems: 'center' },
  spinText: { color: 'white', fontSize: 18, fontWeight: '800' }
});
