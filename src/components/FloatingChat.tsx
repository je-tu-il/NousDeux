import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, Platform, FlatList, ActivityIndicator } from 'react-native';
import { MessageCircle, X, Send } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { doc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useOnboardingStore } from '../store/onboardingStore';
import { encryptText, decryptText } from '../lib/crypto';

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const store = useOnboardingStore(s => s);
  const myUid = store.uid;
  const [cId, setCId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  
  useEffect(() => {
    if (!myUid) return;
    getDoc(doc(db, 'users', myUid)).then((docSnap) => {
      if (docSnap.exists() && docSnap.data().linkedTo) {
        setCId([myUid, docSnap.data().linkedTo].sort().join('_'));
      }
    });
  }, [myUid]);

  useEffect(() => {
    if (!cId || !isOpen) return;
    
    const q = query(collection(db, `couples/${cId}/messages`), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      const msgs = await Promise.all(snap.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let decryptedText = '🔒...';
        try {
          if (data.ciphertext && data.iv) {
            decryptedText = await decryptText({ ciphertext: data.ciphertext, iv: data.iv }, cId);
          } else {
            decryptedText = data.text || ''; 
          }
        } catch(e) {}
        
        return {
          id: docSnap.id,
          senderId: data.senderId,
          text: decryptedText,
          createdAt: data.createdAt,
        };
      }));
      setMessages(msgs);
    });
    return () => unsub();
  }, [cId, isOpen]);

  const handleSend = async () => {
    if (!inputText.trim() || !cId || !myUid) return;
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
      setInputText(textToSend); 
    } finally {
      setSending(false);
    }
  };

  if (!cId) return null; // Ne pas afficher si pas en couple

  return (
    <>
      {isOpen && (
        <Animated.View 
          entering={SlideInDown.springify().damping(20).stiffness(200)}
          exiting={SlideOutDown.duration(200)}
          style={styles.chatWindow}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Chat 🔒</Text>
            <Pressable onPress={() => setIsOpen(false)} style={styles.closeBtn}>
              <X color="#4A3B39" size={20} />
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
          
          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onKeyPress={(e: any) => {
                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Pressable onPress={handleSend} disabled={!inputText.trim() || sending} style={({pressed}) => [styles.sendBtn, { opacity: pressed || !inputText.trim() ? 0.6 : 1 }]}>
              {sending ? <ActivityIndicator size="small" color="white" /> : <Send size={16} color="white" />}
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* FAB */}
      {!isOpen && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.fabContainer}>
          <Pressable style={styles.fab} onPress={() => setIsOpen(true)}>
            <MessageCircle color="white" size={28} />
          </Pressable>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
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
  chatWindow: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 320,
    height: 450,
    backgroundColor: '#FFF5F2',
    borderRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    overflow: 'hidden',
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#FFF5F2', borderBottomWidth: 1, borderBottomColor: '#F0E5E2',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#4A3B39' },
  closeBtn: { padding: 4 },
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
  input: {
    flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: '#F9F4F2', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF6A88', justifyContent: 'center', alignItems: 'center',
  }
});
