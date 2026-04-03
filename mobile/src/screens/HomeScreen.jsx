import React, { useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar,
} from 'react-native';
import { useChat } from '../context/ChatContext';

export default function HomeScreen({ navigation }) {
  const { state, actions } = useChat();
  const { conversations, messages, users, me } = state;

  // Navegar para o chat ao abrir uma conversa
  function openConversation(conv) {
    actions.setActive(conv.id);
    navigation.navigate('Chat', { conversationId: conv.id });
  }

  function getConvTitle(conv) {
    if (conv.type === 'group') return conv.name;
    const otherId = Object.keys(users).find(
      uid => uid !== me?.id && conversations
        .find(c => c.id === conv.id)
    );
    return users[otherId]?.name ?? 'Conversa';
  }

  function getLastMessage(conv) {
    const msgs = messages[conv.id] ?? [];
    const last  = msgs[msgs.length - 1];
    if (!last) return 'Nenhuma mensagem ainda';
    const prefix = last.sender_id === me?.id ? 'Você: ' : '';
    return prefix + last.content;
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderItem({ item: conv }) {
    const msgs  = messages[conv.id] ?? [];
    const last  = msgs[msgs.length - 1];
    const title = conv.type === 'group' ? conv.name : '?';

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => openConversation(conv)}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>
            {(conv.name ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {conv.name ?? 'Conversa'}
            </Text>
            {last && (
              <Text style={styles.time}>
                {formatTime(last.created_at)}
              </Text>
            )}
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            {getLastMessage(conv)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d14" />

      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.title}>Vibe ⚡</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('Contacts')}
        >
          <Text style={styles.newBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de conversas */}
      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyText}>Nenhuma conversa ainda</Text>
          <Text style={styles.emptySubtext}>
            Vá em Contatos e inicie uma conversa!
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0d0d14' },
  header:       { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center', paddingHorizontal: 16,
                  paddingTop: 56, paddingBottom: 16,
                  borderBottomWidth: 1, borderBottomColor: '#2a2a45' },
  title:        { fontSize: 24, fontWeight: '800', color: '#e2e8f0' },
  newBtn:       { backgroundColor: '#4c1d95', paddingHorizontal: 14,
                  paddingVertical: 7, borderRadius: 20 },
  newBtnText:   { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon:    { fontSize: 52, marginBottom: 4 },
  emptyText:    { color: '#e2e8f0', fontSize: 17, fontWeight: '600' },
  emptySubtext: { color: '#64748b', fontSize: 13, textAlign: 'center',
                  paddingHorizontal: 40 },
  item:         { flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  avatar:       { width: 50, height: 50, borderRadius: 25,
                  backgroundColor: '#4c1d95', justifyContent: 'center',
                  alignItems: 'center', marginRight: 12 },
  avatarLetter: { color: '#fff', fontSize: 20, fontWeight: '700' },
  info:         { flex: 1 },
  row:          { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 3 },
  name:         { color: '#e2e8f0', fontSize: 15, fontWeight: '600', flex: 1 },
  time:         { color: '#64748b', fontSize: 12, marginLeft: 8 },
  preview:      { color: '#64748b', fontSize: 13 },
});
