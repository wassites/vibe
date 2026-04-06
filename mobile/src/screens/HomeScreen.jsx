// mobile/src/screens/HomeScreen.jsx

import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../context/ChatContext';

// ── Avatar com cor baseada no nome ────────────────────────────────────────────

function Avatar({ name, size = 50 }) {
  const colors = ['#7c3aed','#2563eb','#059669','#dc2626','#d97706','#0891b2'];
  const color  = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, alignItems: 'center',
      justifyContent: 'center', marginRight: 12,
    }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>
        {(name ?? '?')[0].toUpperCase()}
      </Text>
    </View>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { state, actions } = useChat();
  const insets = useSafeAreaInsets();
  const { conversations, messages, participants, users, me } = state;

  // ── Resolve título e peerId de uma conversa ──────────────────────────────

  function getConvInfo(conv) {
    if (conv.type === 'group') {
      return { title: conv.name ?? 'Grupo', peerId: null };
    }

    // Conversa direta — pega o outro participante
    const parts   = participants[conv.id] ?? [];
    const other   = parts.find(p => {
      const uid = typeof p === 'string' ? p : p?.id;
      return uid && uid !== me?.id;
    });
    const otherId = typeof other === 'string' ? other : other?.id;
    const title   = users[otherId]?.name ?? 'Conversa';

    return { title, peerId: otherId ?? null };
  }

  // ── Última mensagem da conversa ──────────────────────────────────────────

  function getLastMessage(conv) {
    const msgs = messages[conv.id] ?? [];
    const last  = msgs[msgs.length - 1];
    if (!last) return 'Nenhuma mensagem ainda';
    if (last.type === 'image') return '📷 Imagem';
    if (last.type === 'audio') return '🎵 Áudio';
    if (last.type === 'video') return '🎥 Vídeo';
    const prefix = last.sender_id === me?.id ? 'Você: ' : '';
    // Remove JSON de criptografia do preview
    if (last.content?.startsWith('{"v":')) return prefix + '🔒 Mensagem cifrada';
    return prefix + last.content;
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ── Abre conversa passando title e peerId corretamente ───────────────────

  function openConversation(conv) {
    const { title, peerId } = getConvInfo(conv);
    actions.setActive(conv.id);
    navigation.navigate('Chat', {
      conversationId: conv.id,
      title,
      peerId,
    });
  }

  // ── Render item ──────────────────────────────────────────────────────────

  function renderItem({ item: conv }) {
    const { title } = getConvInfo(conv);
    const msgs = messages[conv.id] ?? [];
    const last = msgs[msgs.length - 1];

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => openConversation(conv)}
        activeOpacity={0.7}
      >
        <Avatar name={title} />

        <View style={styles.info}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>{title}</Text>
            {last && (
              <Text style={styles.time}>{formatTime(last.created_at)}</Text>
            )}
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            {getLastMessage(conv)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d14" />

      {/* Cabeçalho */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.title}>Vibe ⚡</Text>
          {me?.name && (
            <Text style={styles.subtitle}>Olá, {me.name.split(' ')[0]}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('Contacts')}
          activeOpacity={0.8}
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0d0d14' },

  header:       { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center', paddingHorizontal: 16,
                  paddingBottom: 16, borderBottomWidth: 1,
                  borderBottomColor: '#2a2a45' },

  title:        { fontSize: 24, fontWeight: '800', color: '#e2e8f0' },
  subtitle:     { fontSize: 12, color: '#64748b', marginTop: 2 },

  newBtn:       { backgroundColor: '#4c1d95', paddingHorizontal: 14,
                  paddingVertical: 8, borderRadius: 20 },
  newBtnText:   { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },

  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon:    { fontSize: 52, marginBottom: 4 },
  emptyText:    { color: '#e2e8f0', fontSize: 17, fontWeight: '600' },
  emptySubtext: { color: '#64748b', fontSize: 13, textAlign: 'center',
                  paddingHorizontal: 40 },

  item:         { flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },

  info:         { flex: 1 },
  row:          { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 3 },
  name:         { color: '#e2e8f0', fontSize: 15, fontWeight: '600', flex: 1 },
  time:         { color: '#64748b', fontSize: 12, marginLeft: 8 },
  preview:      { color: '#64748b', fontSize: 13 },
});
