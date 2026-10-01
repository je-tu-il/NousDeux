import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, Platform, KeyboardAvoidingView, ActivityIndicator, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { doc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useOnboardingStore } from '../store/onboardingStore';
import { Colors } from '../constants/Colors';
import { encryptText, decryptText } from '../lib/crypto';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useTopInset } from '@/hooks/useTopInset';

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  isDecrypted?: boolean;
}

export default function ChatScreen() {
  const store = useOnboardingStore((state) => state);
  const router = useRouter();
  const topInset = useTopInset();
  
  const theme = store.isDarkMode ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const myUid = store.uid;
  const [cId, setCId] = useState('');
  
  const [isLinked, setIsLinked] = useState(false);
  const [hasCoupleHistory, setHasCoupleHistory] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Initialiser l'ID du couple avec écoute en temps réel
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
          setCId([myUid, previousPartner].sort().join('_'));
          setIsLinked(false);
          setHasCoupleHistory(true);
        } else {
          setCId('');
          setIsLinked(false);
          setHasCoupleHistory(false);
          setMessages([]);
          setLoading(false);
        }
      } else {
        setCId('');
        setIsLinked(false);
        setHasCoupleHistory(false);
        setMessages([]);
        setLoading(false);
      }
    }, () => {
      setCId('');
      setIsLinked(false);
      setHasCoupleHistory(false);
      setMessages([]);
      setLoading(false);
    });
  }, [myUid]);

  // Écouter les messages
  useEffect(() => {
    if (!cId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    
    const messagesRef = collection(db, `couples/${cId}/messages`);
    const q = query(messagesRef, orderBy('createdAt', 'desc'));
    
    const unsub = onSnapshot(q, async (snap) => {
      const msgs = await Promise.all(snap.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let decryptedText = '💬 Message chiffré illisible';
        
        try {
          if (data.ciphertext && data.iv) {
            decryptedText = await decryptText({ ciphertext: data.ciphertext, iv: data.iv }, cId);
          } else {
            decryptedText = data.text || ''; // fallback si non chiffré
          }
        } catch(e) {
          if (data.text) decryptedText = data.text;
          console.warn("Erreur de déchiffrement", e);
        }
        
        return {
          id: docSnap.id,
          senderId: data.senderId,
          text: decryptedText,
          createdAt: data.createdAt,
          isDecrypted: true,
        };
      }));
      
      setMessages(msgs);
      setLoading(false);
    });
    
    return () => unsub();
  }, [cId]);

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
    } catch(e) {
      console.error(e);
      setInputText(textToSend); // Restore if error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === myUid;
    return (
      <Animated.View 
        layout={Layout.springify()} 
        entering={FadeInDown.duration(400).springify()}
        style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}
      >
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubblePartner]}>
          <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextPartner]}>
            {item.text}
          </Text>
        </View>
      </Animated.View>
    );
  };

  if (!hasCoupleHistory && !loading) {
    return (
      <View style={[styles.root, styles.center, { padding: 24 }]}>
        <Text style={[styles.headerTitle, { textAlign: 'center', marginBottom: 12 }]}>Messagerie Privée 🔒</Text>
        <Text style={{ textAlign: 'center', color: theme.tabIconDefault, fontSize: 16, marginBottom: 24 }}>
          Tu dois être en couple pour accéder au chat avec ton partenaire.
        </Text>
        <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/dashboard'); }} style={[styles.sendBtn, { width: 'auto', paddingHorizontal: 20, height: 44 }]}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Retour à l'accueil</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#FF9A8B" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isLinked ? 'Messagerie Privée 🔒' : 'Messagerie Privée 🔒 (Lecture seule)'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FF9A8B" size="large" />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input */}
      <View style={[styles.inputBar, !isLinked && { backgroundColor: '#F3EFEF' }]}>
        <TextInput
          style={[styles.input, !isLinked && { backgroundColor: '#E7DFDF', color: '#8A7A78' }]}
          placeholder={isLinked ? "Écris un message..." : "Compte délié : envoi désactivé"}
          placeholderTextColor={theme.tabIconDefault}
          value={inputText}
          onChangeText={setInputText}
          editable={isLinked}
          multiline
          maxLength={1000}
          onKeyPress={(e: any) => {
            if (isLinked && Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Pressable 
          style={({ pressed }) => [
            styles.sendBtn, 
            (!isLinked || pressed || !inputText.trim()) && { opacity: 0.4, backgroundColor: '#A99693' }
          ]}
          onPress={handleSend}
          disabled={!isLinked || !inputText.trim() || sending}
        >
          {sending ? <ActivityIndicator color="white" size="small" /> : <Send color="white" size={20} />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: theme.background,
    borderBottomWidth: 1, borderBottomColor: '#F0E5E2',
    zIndex: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FF9A8B', fontSize: 18, fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 24, gap: 12 },
  
  msgWrapper: { width: '100%', marginBottom: 12 },
  msgRight: { alignItems: 'flex-end' },
  msgLeft: { alignItems: 'flex-start' },
  
  bubble: {
    maxWidth: '80%', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 1,
  },
  bubbleMe: {
    backgroundColor: '#FF6A88',
    borderBottomRightRadius: 4,
  },
  bubblePartner: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextMe: { color: 'white' },
  msgTextPartner: { color: theme.text },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 12, paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    backgroundColor: 'white',
    borderTopWidth: 1, borderTopColor: '#F0E5E2',
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    backgroundColor: '#F9F4F2',
    borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: theme.text,
    marginRight: 10,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FF6A88',
    justifyContent: 'center', alignItems: 'center',
  }
});



