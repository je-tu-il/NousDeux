import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, Platform, FlatList, ActivityIndicator, PanResponder, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessageCircle, X, Send } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { doc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useOnboardingStore } from '../store/onboardingStore';
import { encryptText, decryptText } from '../lib/crypto';

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

const HEADER_HEIGHT = 56;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 200;

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const store = useOnboardingStore(s => s);
  const myUid = store.uid;
  const initialPartner = store.partnerUid;
  const initialCId = (myUid && initialPartner) ? [myUid, initialPartner].sort().join('_') : '';
  const [cId, setCId] = useState(initialCId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [windowPosition, setWindowPosition] = useState({ x: 16, y: 96 });
  const [windowSize, setWindowSize] = useState({ width: 320, height: 450 });
  const dragStart = useRef(windowPosition);
  const resizeStart = useRef(windowSize);
  const positionRef = useRef(windowPosition);
  const sizeRef = useRef(windowSize);
  const lastReadRef = useRef<number>(0);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const dimensionsRef = useRef({ width: screenWidth, height: screenHeight });

  const [dragResponder, setDragResponder] = useState<any>(null);
  const [resizeResponder, setResizeResponder] = useState<any>(null);

  useEffect(() => {
    positionRef.current = windowPosition;
  }, [windowPosition]);

  useEffect(() => {
    sizeRef.current = windowSize;
  }, [windowSize]);

  useEffect(() => {
    dimensionsRef.current = { width: screenWidth, height: screenHeight };
  }, [screenWidth, screenHeight]);

  useEffect(() => {
    if (!lastReadRef.current) lastReadRef.current = Date.now();
    if (!cId) return;
    AsyncStorage.getItem(`chat_last_read_${cId}`).then((val) => {
      if (val) lastReadRef.current = parseInt(val, 10);
    }).catch(() => {});
  }, [cId]);

  const openChat = () => {
    setIsOpen(true);
    setHasUnread(false);
    const now = Date.now();
    lastReadRef.current = now;
    if (cId) {
      AsyncStorage.setItem(`chat_last_read_${cId}`, String(now)).catch(() => {});
    }
  };

  // Clamping du drag :
  // - Impossible de sortir par le haut (y >= 0)
  // - Impossible de sortir par les côtés (0 <= x <= sw - w)
  // - Sortie possible par le bas MAIS l'en-tête doit TOUJOURS rester visible (y <= sh - HEADER_HEIGHT)
  const clampDragPosition = useCallback((x: number, y: number, width = sizeRef.current.width) => {
    const sw = dimensionsRef.current.width;
    const sh = dimensionsRef.current.height;
    const maxX = Math.max(0, sw - width);
    const maxY = Math.max(0, sh - HEADER_HEIGHT);
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }, []);

  useEffect(() => {
    setDragResponder(PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { dragStart.current = positionRef.current; },
      onPanResponderMove: (_, gesture) => {
        const next = clampDragPosition(dragStart.current.x + gesture.dx, dragStart.current.y + gesture.dy);
        positionRef.current = next;
        setWindowPosition(next);
      },
    }));

    setResizeResponder(PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { resizeStart.current = sizeRef.current; },
      onPanResponderMove: (_, gesture) => {
        const sw = dimensionsRef.current.width;
        const sh = dimensionsRef.current.height;
        // Position ancrée fixe : tirer en bas ne doit JAMAIS agrandir par le haut !
        const posX = positionRef.current.x;
        const posY = positionRef.current.y;
        const maxW = Math.max(MIN_WIDTH, sw - posX);
        const maxH = Math.max(MIN_HEIGHT, sh - posY);

        const width = Math.min(maxW, Math.max(Math.min(MIN_WIDTH, sw), resizeStart.current.width + gesture.dx));
        const height = Math.min(maxH, Math.max(Math.min(MIN_HEIGHT, sh), resizeStart.current.height + gesture.dy));
        const nextSize = { width, height };
        sizeRef.current = nextSize;
        setWindowSize(nextSize);
      },
    }));
  }, [clampDragPosition]);

  useEffect(() => {
    const sw = screenWidth;
    const sh = screenHeight;
    const maxW = Math.max(MIN_WIDTH, sw - positionRef.current.x);
    const maxH = Math.max(MIN_HEIGHT, sh - positionRef.current.y);
    const nextSize = {
      width: Math.min(maxW, Math.max(Math.min(MIN_WIDTH, sw), sizeRef.current.width)),
      height: Math.min(maxH, Math.max(Math.min(MIN_HEIGHT, sh), sizeRef.current.height)),
    };
    sizeRef.current = nextSize;
    setWindowSize(nextSize);

    const nextPos = clampDragPosition(positionRef.current.x, positionRef.current.y, nextSize.width);
    positionRef.current = nextPos;
    setWindowPosition(nextPos);
  }, [screenWidth, screenHeight, clampDragPosition]);
  
  const [isLinked, setIsLinked] = useState(Boolean(initialPartner));
  const [hasCoupleHistory, setHasCoupleHistory] = useState(Boolean(initialPartner));

  useEffect(() => {
    if (!myUid) return;
    return onSnapshot(doc(db, 'users', myUid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentPartner = data.linkedTo;
        const previousPartner = data.lastPartner;

        if (currentPartner) {
          setCId([myUid, currentPartner].sort().join('_'));
          setIsLinked(true);
          setHasCoupleHistory(true);
        } else if (previousPartner) {
          // Si on s'est fait quitter : on garde l'historique du chat précédent en lecture seule
          setCId([myUid, previousPartner].sort().join('_'));
          setIsLinked(false);
          setHasCoupleHistory(true);
        } else {
          // Jamais été en couple : chat non apparent
          setCId('');
          setIsLinked(false);
          setHasCoupleHistory(false);
          setMessages([]);
        }
      } else {
        setCId('');
        setIsLinked(false);
        setHasCoupleHistory(false);
        setMessages([]);
      }
    }, () => {
      setCId('');
      setIsLinked(false);
      setHasCoupleHistory(false);
      setMessages([]);
    });
  }, [myUid]);

  // Écoute continue des messages (pour le point rouge de notification quand le chat est fermé)
  useEffect(() => {
    if (!cId) {
      setMessages([]);
      setHasUnread(false);
      return;
    }
    
    const q = query(collection(db, `couples/${cId}/messages`), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      let unreadFound = false;
      const msgs = await Promise.all(snap.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let decryptedText = '🔒...';
        try {
          if (data.ciphertext && data.iv) {
            decryptedText = await decryptText({ ciphertext: data.ciphertext, iv: data.iv }, cId);
          } else {
            decryptedText = data.text || ''; 
          }
        } catch {
          if (data.text) {
            decryptedText = data.text;
          }
        }

        const createdAtMillis = data.createdAt?.toMillis
          ? data.createdAt.toMillis()
          : (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
        if (data.senderId !== myUid && createdAtMillis > lastReadRef.current) {
          unreadFound = true;
        }
        
        return {
          id: docSnap.id,
          senderId: data.senderId,
          text: decryptedText,
          createdAt: data.createdAt,
        };
      }));
      setMessages(msgs);
      if (unreadFound) {
        setHasUnread(true);
      }
    });
    return () => unsub();
  }, [cId, myUid]);

  const handleSend = async () => {
    if (!isLinked || !inputText.trim() || !cId || !myUid) return;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);
    
    try {
      const encrypted = await encryptText(textToSend, cId);
      await addDoc(collection(db, `couples/${cId}/messages`), {
        senderId: myUid,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        createdAt: serverTimestamp(),
      });
    } catch {
      setInputText(textToSend); 
    } finally {
      setSending(false);
    }
  };

  if (!hasCoupleHistory || !cId) return null; // Ne pas afficher si jamais été en couple

  return (
    <>
      {isOpen && (
        <Animated.View 
          entering={SlideInDown.duration(180)}
          exiting={SlideOutDown.duration(150)}
          style={[styles.chatWindow, {
            left: windowPosition.x,
            top: windowPosition.y,
            width: windowSize.width,
            height: windowSize.height,
          }]}
        >
          <View style={styles.header} {...(dragResponder?.panHandlers ?? {})}>
            <Text style={styles.headerTitle}>{isLinked ? 'Chat 🔒' : 'Chat 🔒 (Lecture seule)'}</Text>
            <Pressable 
              onPress={() => setIsOpen(false)} 
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              accessibilityRole="button"
              accessibilityLabel="Fermer le chat"
            >
              <X color="#4A3B39" size={22} />
            </Pressable>
          </View>
          
          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            inverted
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isMe = item.senderId === myUid;
              return (
                <View style={[styles.bubbleWrapper, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubblePartner]}>
                    <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextPartner]}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
          />
          
          <View style={[styles.inputArea, !isLinked && styles.inputAreaDisabled]}>
            <TextInput
              style={[styles.input, !isLinked && styles.inputDisabled]}
              placeholder={isLinked ? "Message..." : "Compte délié : envoi désactivé"}
              placeholderTextColor={isLinked ? "#A99693" : "#C084FC"}
              value={inputText}
              onChangeText={setInputText}
              editable={isLinked}
              multiline
              maxLength={500}
              returnKeyType="send"
              submitBehavior="submit"
              onSubmitEditing={handleSend}
              onKeyPress={(e: any) => {
                if (isLinked && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                  e.preventDefault?.();
                  handleSend();
                }
              }}
            />
            <Pressable 
              onPress={handleSend} 
              disabled={!isLinked || !inputText.trim() || sending} 
              style={({pressed}) => [
                styles.sendBtn, 
                (!isLinked || pressed || !inputText.trim()) && { opacity: 0.4, backgroundColor: '#A99693' }
              ]}
            >
              {sending ? <ActivityIndicator size="small" color="white" /> : <Send size={16} color="white" />}
            </Pressable>
          </View>
          <View style={styles.resizeHandle} {...(resizeResponder?.panHandlers ?? {})}>
            <Text style={styles.resizeHandleText}>↘</Text>
          </View>
        </Animated.View>
      )}

      {/* FAB */}
      {!isOpen && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.fabContainer}>
          <Pressable style={styles.fab} onPress={openChat}>
            <MessageCircle color="white" size={28} />
            {hasUnread && <View style={styles.unreadDot} />}
          </Pressable>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    bottom: 24,
    right: 24,
    zIndex: 9999,
  },
  fab: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FF6A88',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#FF6A88', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  unreadDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatWindow: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    left: 16,
    top: 96,
    width: 320,
    height: 450,
    backgroundColor: '#FFF5F2',
    borderRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    overflow: 'hidden',
    zIndex: 9999,
  },
  resizeHandle: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    ...(Platform.OS === 'web' ? { cursor: 'se-resize', userSelect: 'none' } : {}),
  },
  resizeHandleText: { color: '#FF6A88', fontSize: 18, fontWeight: '900' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#FFF5F2', borderBottomWidth: 1, borderBottomColor: '#F0E5E2',
    ...(Platform.OS === 'web' ? { cursor: 'grab', userSelect: 'none' } : {}),
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#4A3B39' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  listContent: { padding: 12, gap: 8 },
  bubbleWrapper: { width: '100%', marginBottom: 8 },
  bubbleRight: { alignItems: 'flex-end' },
  bubbleLeft: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18,
  },
  bubbleMe: { backgroundColor: '#FF6A88', borderBottomRightRadius: 4 },
  bubblePartner: { backgroundColor: 'white', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextMe: { color: 'white' },
  msgTextPartner: { color: '#4A3B39' },
  inputArea: {
    flexDirection: 'row', 
    paddingTop: 12, paddingBottom: 8, paddingLeft: 12, paddingRight: 8,
    backgroundColor: 'white', 
    borderTopWidth: 1, borderTopColor: '#F0E5E2', 
    alignItems: 'flex-end',
    justifyContent: 'flex-end'
  },
  inputAreaDisabled: {
    backgroundColor: '#F3EFEF',
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: '#F9F4F2', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8,
  },
  inputDisabled: {
    backgroundColor: '#E7DFDF',
    color: '#8A7A78',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF6A88', justifyContent: 'center', alignItems: 'center',
  }
});
