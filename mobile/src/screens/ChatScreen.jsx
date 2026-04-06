// mobile/src/screens/ChatScreen.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, Image,
  TouchableOpacity, KeyboardAvoidingView,
  Platform, StyleSheet, Alert, Pressable,
  ActionSheetIOS, ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../context/ChatContext';
import InputBar from '../components/InputBar';

// ── Extrai texto legível de mensagens cifradas ────────────────────────────────

function getDisplayContent(content, type) {
  if (!content) return '';
  if (type === 'image') return null; // renderiza imagem
  if (type === 'audio') return null; // renderiza player
  if (type === 'video') return '🎥 Vídeo';
  if (content.startsWith('{"v":2,')) {
    try { return JSON.parse(content).plain ?? '🔒 Mensagem cifrada'; } catch {}
  }
  if (content.startsWith('{"v":1,')) return '🔒 Mensagem cifrada';
  return content;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 38 }) {
  const colors = ['#7c3aed','#2563eb','#059669','#dc2626','#d97706'];
  const color  = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.42 }}>
        {(name ?? '?')[0].toUpperCase()}
      </Text>
    </View>
  );
}

// ── Status ticks ──────────────────────────────────────────────────────────────

function StatusTick({ status }) {
  if (status === 'read')      return <Text style={[s.tick, { color: '#a855f7' }]}>✓✓</Text>;
  if (status === 'delivered') return <Text style={[s.tick, { color: '#64748b' }]}>✓✓</Text>;
  return <Text style={[s.tick, { color: '#64748b' }]}>✓</Text>;
}

// ── Player de áudio ───────────────────────────────────────────────────────────

function AudioPlayer({ url }) {
  const [sound,    setSound]    = useState(null);
  const [playing,  setPlaying]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => { sound?.unloadAsync(); };
  }, [sound]);

  async function togglePlay() {
    if (loading) return;
    try {
      if (!sound) {
        setLoading(true);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setPosition(status.positionMillis ?? 0);
              setDuration(status.durationMillis ?? 0);
              setPlaying(status.isPlaying);
              if (status.didJustFinish) {
                setPlaying(false);
                setPosition(0);
              }
            }
          }
        );
        setSound(s);
        setLoading(false);
        setPlaying(true);
      } else {
        if (playing) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
      }
    } catch (err) {
      console.error('[Audio]', err);
      setLoading(false);
    }
  }

  function formatMs(ms) {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={s.audioPlayer}>
      <TouchableOpacity onPress={togglePlay} style={s.audioBtn} activeOpacity={0.7}>
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={{ color: '#fff', fontSize: 16 }}>{playing ? '⏸' : '▶'}</Text>
        }
      </TouchableOpacity>

      <View style={s.audioBar}>
        <View style={[s.audioProgress, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={s.audioDuration}>
        {duration > 0 ? formatMs(playing ? position : duration) : '—:——'}
      </Text>
    </View>
  );
}

// ── Balão de mensagem ─────────────────────────────────────────────────────────

function Bubble({ msg, isOwn, onLongPress }) {
  const isEdited   = !!(msg.edited_at);
  const display    = getDisplayContent(msg.content, msg.type);
  const isCiphered = typeof display === 'string' && display.startsWith('🔒');

  return (
    <Pressable
      onLongPress={() => onLongPress(msg)}
      delayLongPress={350}
      style={[s.bubble, isOwn ? s.bubbleOut : s.bubbleIn]}
    >
      {/* Imagem */}
      {msg.type === 'image' && (
        <TouchableOpacity onPress={() => {}}>
          <Image
            source={{ uri: msg.content }}
            style={s.bubbleImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}

      {/* Áudio */}
      {msg.type === 'audio' && (
        <AudioPlayer url={msg.content} />
      )}

      {/* Texto / outros */}
      {msg.type !== 'image' && msg.type !== 'audio' && display !== null && (
        <Text style={[
          s.bubbleText,
          isCiphered && s.bubbleTextCiphered,
          msg.type === 'video' && s.bubbleTextMedia,
        ]}>
          {display}
        </Text>
      )}

      {/* Rodapé */}
      <View style={s.bubbleMeta}>
        {isEdited && <Text style={s.editedLabel}>editado</Text>}
        <Text style={s.bubbleTime}>
          {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit',
          })}
        </Text>
        {isOwn && <StatusTick status={msg.status} />}
      </View>
    </Pressable>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────

export default function ChatScreen({ route, navigation }) {
  const { conversationId, title, peerId } = route.params;
  const { state, actions } = useChat();
  const insets = useSafeAreaInsets();

  const flatRef = useRef(null);

  const msgs      = state.messages[conversationId] ?? [];
  const typingSet = state.typing[conversationId] ?? new Set();
  const isTyping  = [...typingSet].some(uid => uid !== state.me?.id);

  // Abre conversa e carrega histórico
  useEffect(() => {
    actions.markRead(conversationId);
    if (msgs.length === 0) {
      if (peerId) {
        actions.openDirect(peerId);
      } else {
        actions.getHistory(conversationId);
      }
    }
  }, [conversationId]);

  // Rola para o fim quando chegar nova mensagem
  useEffect(() => {
    if (msgs.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [msgs.length]);

  // ── Long press — menu de ações ─────────────────────────────────────────────

  function handleBubbleLongPress(msg) {
    const isOwn   = msg.sender_id === state.me?.id;
    const elapsed = Date.now() - new Date(msg.created_at).getTime();
    const canEdit = isOwn && msg.type === 'text'
                    && elapsed < 15 * 60 * 1000
                    && !msg.content?.startsWith('{"v":');

    const options  = [];
    const handlers = [];

    if (canEdit) {
      options.push('Editar');
      handlers.push(() => {
        // Passa para o InputBar via state — implementado no InputBar
        Alert.alert('Editar', 'Funcionalidade de edição via long press em desenvolvimento');
      });
    }

    options.push('Apagar para mim');
    handlers.push(() => actions.deleteMessage(msg.id, false));

    if (isOwn) {
      options.push('Apagar para todos');
      handlers.push(() => actions.deleteMessage(msg.id, true));
    }

    options.push('Cancelar');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: options.indexOf('Apagar para todos') },
        (idx) => { if (idx < handlers.length) handlers[idx](); }
      );
    } else {
      Alert.alert('Mensagem', null, [
        ...handlers.map((fn, i) => ({ text: options[i], onPress: fn })),
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  }

  const renderItem = useCallback(({ item }) => (
    <Bubble
      msg={item}
      isOwn={item.sender_id === state.me?.id}
      onLongPress={handleBubbleLongPress}
    />
  ), [state.me?.id]);

  // ── Botão de chamada ───────────────────────────────────────────────────────

  function CallButton({ icon, label, onPress }) {
    return (
      <TouchableOpacity onPress={onPress} style={s.callBtn} activeOpacity={0.7}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </TouchableOpacity>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>

        <Avatar name={title} size={36} />

        <View style={s.headerInfo}>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
          <Text style={s.headerStatus}>
            {state.connected ? '● online' : '○ conectando...'}
          </Text>
        </View>

        {peerId && (
          <View style={s.callBtns}>
            <CallButton icon="📞" onPress={() =>
              Alert.alert('Em breve', 'Chamadas chegam no próximo update!')
            }/>
            <CallButton icon="📹" onPress={() =>
              Alert.alert('Em breve', 'Chamadas de vídeo chegam no próximo update!')
            }/>
          </View>
        )}
      </View>

      {/* Mensagens */}
      <FlatList
        ref={flatRef}
        data={msgs}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>Nenhuma mensagem ainda. Diga olá! 👋</Text>
          </View>
        }
      />

      {/* Digitando */}
      {isTyping && <Text style={s.typing}>digitando...</Text>}

      {/* InputBar — componente separado com áudio e anexos */}
      <View style={{ paddingBottom: insets.bottom }}>
        <InputBar conversationId={conversationId} />
      </View>

    </KeyboardAvoidingView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0d0d14' },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center',
                 backgroundColor: '#13131e', paddingHorizontal: 12,
                 paddingBottom: 12, borderBottomWidth: 1,
                 borderBottomColor: '#2a2a45', gap: 10 },
  backBtn:     { paddingRight: 4 },
  backIcon:    { color: '#a855f7', fontSize: 32, fontWeight: '300', lineHeight: 36 },
  headerInfo:  { flex: 1 },
  headerTitle: { color: '#e2e8f0', fontWeight: '600', fontSize: 15 },
  headerStatus:{ color: '#64748b', fontSize: 11, marginTop: 1 },
  callBtns:    { flexDirection: 'row', gap: 4 },
  callBtn:     { width: 36, height: 36, borderRadius: 18,
                 backgroundColor: '#1f1f32', alignItems: 'center',
                 justifyContent: 'center' },

  // Lista
  list:        { padding: 12, paddingBottom: 8 },
  empty:       { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText:   { color: '#64748b', fontSize: 14 },

  // Digitando
  typing:      { color: '#64748b', fontSize: 12,
                 paddingHorizontal: 16, paddingBottom: 4 },

  // Balões
  bubble:          { maxWidth: '75%', borderRadius: 16, padding: 10, marginBottom: 6 },
  bubbleOut:       { alignSelf: 'flex-end', backgroundColor: '#4c1d95',
                     borderBottomRightRadius: 4 },
  bubbleIn:        { alignSelf: 'flex-start', backgroundColor: '#1a1a2e',
                     borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2a2a45' },
  bubbleText:      { color: '#e2e8f0', fontSize: 15, lineHeight: 21 },
  bubbleTextCiphered: { color: '#64748b', fontStyle: 'italic', fontSize: 13 },
  bubbleTextMedia: { color: '#a855f7', fontSize: 13 },
  bubbleMeta:      { flexDirection: 'row', alignItems: 'center',
                     justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  bubbleTime:      { color: '#64748b', fontSize: 11 },
  editedLabel:     { color: '#64748b', fontSize: 10, fontStyle: 'italic' },
  tick:            { fontSize: 11 },

  // Imagem no balão
  bubbleImage: {
    width: 200, height: 160,
    borderRadius: 12, marginBottom: 4,
  },

  // Player de áudio
  audioPlayer: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, minWidth: 180,
  },
  audioBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#a855f7',
    alignItems: 'center', justifyContent: 'center',
  },
  audioBar: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  audioProgress: {
    height: '100%', borderRadius: 2,
    backgroundColor: '#a855f7',
  },
  audioDuration: {
    color: '#64748b', fontSize: 11,
    fontVariantNumeric: 'tabular-nums',
  },
});
