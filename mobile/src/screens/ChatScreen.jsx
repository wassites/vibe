import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useChat } from '../context/ChatContext';

export default function ChatScreen({ route }) {
  const { conversationId, title } = route.params;
  const { state, actions } = useChat();
  const [text, setText]     = useState('');
  const flatRef             = useRef(null);
  const typingTimer         = useRef(null);

  const msgs    = state.messages[conversationId] ?? [];
  const typing  = [...(state.typing[conversationId] ?? [])];
  const isTyping = typing.filter(uid => uid !== state.me?.id).length > 0;

  // Marcar como lido ao abrir
  useEffect(() => {
    actions.markRead(conversationId);
  }, [conversationId]);

  // Rolar para o fim quando chegar mensagem nova
  useEffect(() => {
    if (msgs.length > 0) {
      flatRef.current?.scrollToEnd({ animated: true });
    }
  }, [msgs.length]);

  function handleChangeText(val) {
    setText(val);
    actions.setTyping(conversationId, true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      actions.setTyping(conversationId, false);
    }, 2000);
  }

  function handleSend() {
    if (!text.trim()) return;
    actions.sendMessage(conversationId, text.trim());
    setText('');
    clearTimeout(typingTimer.current);
    actions.setTyping(conversationId, false);
  }

  function renderStatus(msg) {
    if (msg.sender_id !== state.me?.id) return null;
    if (msg.status === 'read')      return <Text style={s.statusRead}>✓✓</Text>;
    if (msg.status === 'delivered') return <Text style={s.statusDone}>✓✓</Text>;
    return <Text style={s.statusSent}>✓</Text>;
  }

  function renderItem({ item }) {
    const isOwn = item.sender_id === state.me?.id;
    return (
      <View style={[s.bubble, isOwn ? s.bubbleOut : s.bubbleIn]}>
        <Text style={s.bubbleText}>{item.content}</Text>
        <View style={s.bubbleMeta}>
          <Text style={s.bubbleTime}>
            {new Date(item.created_at).toLocaleTimeString('pt-BR', {
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
          {renderStatus(item)}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Cabeçalho */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{title?.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={s.headerTitle}>{title}</Text>
      </View>

      {/* Mensagens */}
      <FlatList
        ref={flatRef}
        data={msgs}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Digitando */}
      {isTyping && (
        <Text style={s.typing}>digitando...</Text>
      )}

      {/* Input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={handleChangeText}
          placeholder="Digite uma mensagem..."
          placeholderTextColor="#64748b"
          multiline
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Text style={s.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0d0d14' },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 12,
                    backgroundColor: '#13131e', padding: 16, paddingTop: 50,
                    borderBottomWidth: 1, borderBottomColor: '#2a2a45' },
  avatar:         { width: 38, height: 38, borderRadius: 19,
                    backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  avatarText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerTitle:    { color: '#e2e8f0', fontWeight: '600', fontSize: 16 },

  bubble:         { maxWidth: '75%', borderRadius: 16, padding: 10,
                    marginBottom: 6 },
  bubbleOut:      { alignSelf: 'flex-end', backgroundColor: '#4c1d95',
                    borderBottomRightRadius: 4 },
  bubbleIn:       { alignSelf: 'flex-start', backgroundColor: '#1a1a2e',
                    borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2a2a45' },
  bubbleText:     { color: '#e2e8f0', fontSize: 15, lineHeight: 21 },
  bubbleMeta:     { flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  bubbleTime:     { color: '#64748b', fontSize: 11 },
  statusSent:     { color: '#64748b', fontSize: 11 },
  statusDone:     { color: '#64748b', fontSize: 11 },
  statusRead:     { color: '#a855f7', fontSize: 11 },

  typing:         { color: '#64748b', fontSize: 12, paddingHorizontal: 16,
                    paddingBottom: 4 },

  inputRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8,
                    padding: 12, backgroundColor: '#13131e',
                    borderTopWidth: 1, borderTopColor: '#2a2a45' },
  input:          { flex: 1, backgroundColor: '#1f1f32', borderRadius: 20,
                    paddingHorizontal: 16, paddingVertical: 10,
                    color: '#e2e8f0', fontSize: 15, maxHeight: 120,
                    borderWidth: 1, borderColor: '#2a2a45' },
  sendBtn:        { width: 44, height: 44, borderRadius: 22,
                    backgroundColor: '#a855f7',
                    alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:{ backgroundColor: '#2a2a45' },
  sendIcon:       { color: '#fff', fontSize: 18 },
});
