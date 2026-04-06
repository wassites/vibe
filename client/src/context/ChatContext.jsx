import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

// ─── Estado inicial ────────────────────────────────────────────────────────────

const initial = {
  connected:         false,
  me:                null,
  conversations:     [],
  activeConvId:      null,
  messages:          {},
  participants:      {},
  users:             {},
  typing:            {},
  contacts:          [],
  contactSuggestion: null,
  duplicateSession:  null,
  syncRequest:       null,
  syncCode:          null,
  syncSendTo:        null,

  call: {
    status:         'idle',
    type:           null,
    conversationId: null,
    peerId:         null,
    peerName:       null,
    peerAvatar:     null,
    localStream:    null,
    remoteStream:   null,
    isMuted:        false,
    isCameraOff:    false,
    startedAt:      null,
  },
};

// ─── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    case 'CONNECTED':    return { ...state, connected: true };
    case 'DISCONNECTED': return { ...state, connected: false, me: null };

    case 'AUTHENTICATED': {
      const users = { ...state.users };
      if (action.user) users[action.user.id] = action.user;
      action.contacts?.forEach(c => { users[c.id] = c; });
      if (action.usersMap) Object.values(action.usersMap).forEach(u => { if (u) users[u.id] = u; });
      return {
        ...state,
        me:               action.user,
        conversations:    action.conversations   ?? [],
        contacts:         action.contacts        ?? [],
        participants:     action.participantsMap ?? {},
        users,
        duplicateSession: null,
        syncRequest:      null,
        syncCode:         null,
        syncSendTo:       null,
      };
    }

    case 'DUPLICATE_SESSION':
      return {
        ...state,
        me:               action.user,
        conversations:    action.conversations   ?? [],
        contacts:         action.contacts        ?? [],
        participants:     action.participantsMap ?? {},
        duplicateSession: { sessionId: action.sessionId },
        users: (() => {
          const users = { ...state.users };
          if (action.user) users[action.user.id] = action.user;
          action.contacts?.forEach(c => { users[c.id] = c; });
          if (action.usersMap) Object.values(action.usersMap).forEach(u => { if (u) users[u.id] = u; });
          return users;
        })(),
      };

    case 'NEW_SESSION_DETECTED':
      return { ...state, syncRequest: { sessionId: action.sessionId } };

    case 'SYNC_CODE_GENERATED':
      return { ...state, syncCode: action.code };

    case 'SYNC_SEND_KEYS':
      return { ...state, syncSendTo: action.targetSessionId };

    case 'SYNC_COMPLETE':
      return { ...state, duplicateSession: null, syncRequest: null, syncCode: null, syncSendTo: null };

    case 'DISMISS_SYNC':
      return { ...state, duplicateSession: null, syncRequest: null, syncCode: null, syncSendTo: null };

    case 'CONVERSATION_READY': {
      const messages     = { ...state.messages,    [action.conversation.id]: action.history      ?? [] };
      const participants = { ...state.participants, [action.conversation.id]: action.participants ?? [] };
      const users        = { ...state.users };
      action.participants?.forEach(u => { if (u) users[u.id] = u; });
      const filtered = state.conversations.filter(c => c.id !== action.conversation.id);
      return {
        ...state,
        conversations: [action.conversation, ...filtered],
        activeConvId:  action.conversation.id,
        messages, participants, users,
      };
    }

    // ── Histórico carregado via get_history ───────────────────────────────────
    // Mescla mensagens novas que já chegaram com o histórico antigo
    // sem duplicar e mantendo a ordem cronológica
    case 'HISTORY_LOADED': {
      const prev   = state.messages[action.conversationId] ?? [];
      const merged = [...action.messages];
      prev.forEach(m => {
        if (!merged.some(x => x.id === m.id)) merged.push(m);
      });
      merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return {
        ...state,
        messages: { ...state.messages, [action.conversationId]: merged },
      };
    }

    case 'GROUP_CREATED': {
      const users        = { ...state.users };
      const participants = { ...state.participants, [action.conversation.id]: action.participants ?? [] };
      action.participants?.forEach(u => { if (u) users[u.id] = u; });
      const exists = state.conversations.some(c => c.id === action.conversation.id);
      return {
        ...state,
        conversations: exists ? state.conversations : [action.conversation, ...state.conversations],
        messages:      { ...state.messages, [action.conversation.id]: [] },
        participants, users,
      };
    }

    case 'NEW_MESSAGE':
    case 'MESSAGE_SENT': {
      const m    = action.message;
      const prev = state.messages[m.conversation_id] ?? [];
      if (prev.some(x => x.id === m.id)) return state;
      const convExists    = state.conversations.some(c => c.id === m.conversation_id);
      const conversations = convExists
        ? state.conversations
        : [{ id: m.conversation_id, type: 'direct', name: null, created_at: m.created_at }, ...state.conversations];
      return { ...state, conversations, messages: { ...state.messages, [m.conversation_id]: [...prev, m] } };
    }

    case 'MESSAGE_DELETED': {
      const { messageId, conversationId } = action;
      const prev = state.messages[conversationId] ?? [];
      return { ...state, messages: { ...state.messages, [conversationId]: prev.filter(m => m.id !== messageId) } };
    }

    case 'MESSAGE_EDITED': {
      const { messageId, conversationId, newContent, editHistory, editedAt } = action;
      const prev = state.messages[conversationId] ?? [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: prev.map(m =>
            m.id === messageId
              ? { ...m, content: newContent, edited_at: editedAt, edit_history: editHistory ?? [] }
              : m
          ),
        },
      };
    }

    case 'CONVERSATION_DELETED': {
      const { conversationId } = action;
      const messages     = { ...state.messages };
      const participants = { ...state.participants };
      delete messages[conversationId];
      delete participants[conversationId];
      return {
        ...state,
        conversations: state.conversations.filter(c => c.id !== conversationId),
        activeConvId:  state.activeConvId === conversationId ? null : state.activeConvId,
        messages, participants,
      };
    }

    // Confirmação de visualização — atualiza ticks para azul
    case 'MESSAGES_READ': {
      const prev = state.messages[action.conversationId] ?? [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.conversationId]: prev.map(m =>
            m.sender_id === state.me?.id ? { ...m, status: 'read' } : m
          ),
        },
      };
    }

    case 'PRESENCE': {
      const users = { ...state.users };
      if (users[action.userId]) {
        users[action.userId] = {
          ...users[action.userId],
          status: action.status,
          ...(action.name      ? { name:       action.name }      : {}),
          ...(action.avatarUrl ? { avatar_url: action.avatarUrl } : {}),
        };
      }
      const contacts = state.contacts.map(c =>
        c.id === action.userId
          ? { ...c, status: action.status,
              ...(action.name      ? { name:       action.name }      : {}),
              ...(action.avatarUrl ? { avatar_url: action.avatarUrl } : {}) }
          : c
      );
      return { ...state, users, contacts };
    }

    case 'TYPING': {
      const typing = { ...state.typing };
      const set    = new Set(typing[action.conversationId] ?? []);
      action.isTyping ? set.add(action.userId) : set.delete(action.userId);
      return { ...state, typing: { ...typing, [action.conversationId]: set } };
    }

    case 'CONTACT_ADDED': {
      const users    = { ...state.users, [action.contact.id]: action.contact };
      const already  = state.contacts.some(c => c.id === action.contact.id);
      const contacts = already ? state.contacts : [...state.contacts, action.contact];
      return { ...state, contacts, users };
    }

    case 'CONTACT_REMOVED':
      return { ...state, contacts: state.contacts.filter(c => c.id !== action.contactId) };

    case 'CONTACTS': {
      const users = { ...state.users };
      action.contacts.forEach(c => { users[c.id] = c; });
      return { ...state, contacts: action.contacts, users };
    }

    case 'CONTACT_SUGGESTION':
      return { ...state, contactSuggestion: action.suggestion };

    case 'DISMISS_SUGGESTION':
      return { ...state, contactSuggestion: null };

    case 'SET_ACTIVE':
      return { ...state, activeConvId: action.convId };

    // ── Chamadas ──────────────────────────────────────────────────────────────

    case 'CALL_OUTGOING':
      return {
        ...state,
        call: {
          ...initial.call,
          status:         'calling',
          type:           action.callType,
          conversationId: action.conversationId,
          peerId:         action.peerId,
          peerName:       action.peerName,
          peerAvatar:     action.peerAvatar,
          localStream:    action.localStream,
        },
      };

    case 'CALL_INCOMING':
      return {
        ...state,
        call: {
          ...initial.call,
          status:         'ringing',
          type:           action.callType,
          conversationId: action.conversationId,
          peerId:         action.peerId,
          peerName:       action.peerName,
          peerAvatar:     action.peerAvatar,
        },
      };

    case 'CALL_CONNECTED':
      return {
        ...state,
        call: {
          ...state.call,
          status:       'connected',
          localStream:  action.localStream  ?? state.call.localStream,
          remoteStream: action.remoteStream ?? state.call.remoteStream,
          startedAt:    Date.now(),
        },
      };

    case 'CALL_REMOTE_STREAM':
      return { ...state, call: { ...state.call, remoteStream: action.remoteStream } };

    case 'CALL_TOGGLE_MUTE':
      return { ...state, call: { ...state.call, isMuted: !state.call.isMuted } };

    case 'CALL_TOGGLE_CAMERA':
      return { ...state, call: { ...state.call, isCameraOff: !state.call.isCameraOff } };

    case 'CALL_ENDED':
      return { ...state, call: { ...initial.call } };

    default: return state;
  }
}

// ─── Contexto ──────────────────────────────────────────────────────────────────

const ChatContext = createContext(null);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302'  },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const pcRef          = useRef(null);
  const localStreamRef = useRef(null);
  const sendRef        = useRef(null);

  // ── Helpers WebRTC ──────────────────────────────────────────────────────────

  function stopLocalStream() {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
  }

  function closePC() {
    if (pcRef.current) {
      pcRef.current.onicecandidate          = null;
      pcRef.current.ontrack                 = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
  }

  function cleanupCall() {
    stopLocalStream();
    closePC();
    dispatch({ type: 'CALL_ENDED' });
  }

  function createPC(peerId) {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendRef.current?.('call_ice', { to: peerId, candidate });
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      dispatch({ type: 'CALL_REMOTE_STREAM', remoteStream });
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanupCall();
      }
    };

    pcRef.current = pc;
    return pc;
  }

  // ── Handler de mensagens do socket ─────────────────────────────────────────

  const handleMessage = useCallback((data) => {
    switch (data.event) {

      case 'authenticated':
        dispatch({ type: 'AUTHENTICATED', user: data.user, conversations: data.conversations, contacts: data.contacts, participantsMap: data.participantsMap, usersMap: data.usersMap });
        break;
      case 'duplicate_session':
        dispatch({ type: 'DUPLICATE_SESSION', user: data.user, conversations: data.conversations, contacts: data.contacts, participantsMap: data.participantsMap, usersMap: data.usersMap, sessionId: data.sessionId });
        break;
      case 'new_session_detected':
        dispatch({ type: 'NEW_SESSION_DETECTED', sessionId: data.sessionId });
        break;
      case 'sync_code_generated':
        dispatch({ type: 'SYNC_CODE_GENERATED', code: data.code });
        break;
      case 'sync_send_keys':
        dispatch({ type: 'SYNC_SEND_KEYS', targetSessionId: data.targetSessionId });
        break;
      case 'sync_result':
        if (!data.ok) console.error('[SYNC] erro:', data.error);
        break;
      case 'sync_complete':
        dispatch({ type: 'SYNC_COMPLETE' });
        break;
      case 'sync_data':
        if (data.privateKey) {
          const userId = localStorage.getItem('vibe_userId');
          if (userId) localStorage.setItem(`vibe_privkey_${userId}`, data.privateKey);
        }
        dispatch({ type: 'SYNC_COMPLETE' });
        break;

      case 'conversation_ready':
        dispatch({ type: 'CONVERSATION_READY', ...data });
        break;

      // Histórico carregado via get_history
      case 'history':
        dispatch({
          type:           'HISTORY_LOADED',
          conversationId: data.conversationId,
          messages:       data.messages ?? [],
        });
        break;

      case 'group_created':
        dispatch({ type: 'GROUP_CREATED', conversation: data.conversation, participants: data.participants });
        break;
      case 'new_message':
        dispatch({ type: 'NEW_MESSAGE',  message: data.message });
        break;
      case 'message_sent':
        dispatch({ type: 'MESSAGE_SENT', message: data.message });
        break;
      case 'message_deleted':
        dispatch({ type: 'MESSAGE_DELETED', messageId: data.messageId, conversationId: data.conversationId });
        break;
      case 'message_edited':
        dispatch({
          type:           'MESSAGE_EDITED',
          messageId:      data.messageId,
          conversationId: data.conversationId,
          newContent:     data.newContent,
          editHistory:    data.editHistory,
          editedAt:       data.editedAt,
        });
        break;
      case 'conversation_deleted':
        dispatch({ type: 'CONVERSATION_DELETED', conversationId: data.conversationId });
        break;
      case 'messages_read':
        dispatch({ type: 'MESSAGES_READ', conversationId: data.conversationId });
        break;
      case 'presence':
        dispatch({ type: 'PRESENCE', userId: data.userId, status: data.status, name: data.name, avatarUrl: data.avatarUrl });
        break;
      case 'typing':
        dispatch({ type: 'TYPING', ...data });
        break;
      case 'contact_added':
        dispatch({ type: 'CONTACT_ADDED', contact: data.contact });
        break;
      case 'contact_removed':
        dispatch({ type: 'CONTACT_REMOVED', contactId: data.contactId });
        break;
      case 'contacts':
        dispatch({ type: 'CONTACTS', contacts: data.contacts });
        break;
      case 'contact_suggestion':
        dispatch({ type: 'CONTACT_SUGGESTION', suggestion: { user: data.user, conversationId: data.conversationId, message: data.message } });
        break;
      case 'offline_queue':
        data.messages?.forEach(entry => {
          if (entry.event_type === 'new_message' && entry.payload?.message)
            dispatch({ type: 'NEW_MESSAGE', message: entry.payload.message });
        });
        break;
      case 'error':
        console.error('[WS]', data.message);
        break;

      // ── Sinalização WebRTC ──────────────────────────────────────────────────

      case 'call_offer': {
        const peer = data.fromUser ?? {};
        pcRef._pendingOffer = data.sdp;
        dispatch({
          type:           'CALL_INCOMING',
          callType:       data.callType,
          conversationId: data.conversationId,
          peerId:         data.from,
          peerName:       peer.name       ?? 'Desconhecido',
          peerAvatar:     peer.avatar_url ?? null,
        });
        break;
      }

      case 'call_answer': {
        if (pcRef.current) {
          pcRef.current
            .setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }))
            .catch(err => console.error('[WebRTC] setRemoteDescription answer:', err));
        }
        dispatch({ type: 'CALL_CONNECTED' });
        break;
      }

      case 'call_ice': {
        if (pcRef.current && data.candidate) {
          pcRef.current
            .addIceCandidate(new RTCIceCandidate(data.candidate))
            .catch(err => console.error('[WebRTC] addIceCandidate:', err));
        }
        break;
      }

      case 'call_unavailable':
        console.warn('[WebRTC] peer indisponível');
        cleanupCall();
        alert('Usuário indisponível no momento.');
        break;
      case 'call_reject':
        cleanupCall();
        break;
      case 'call_end':
        cleanupCall();
        break;
      case 'call_busy':
        cleanupCall();
        alert('Usuário ocupado em outra chamada.');
        break;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { send } = useSocket({
    onOpen:    () => dispatch({ type: 'CONNECTED' }),
    onClose:   () => { dispatch({ type: 'DISCONNECTED' }); cleanupCall(); },
    onMessage: handleMessage,
  });

  sendRef.current = send;

  // ── Actions ────────────────────────────────────────────────────────────────

  const actions = {

    // ── Mensagens e conversas ────────────────────────────────────────────────
    auth:               (userId, name, avatarUrl)              => { localStorage.setItem('vibe_userId', userId); send('auth', { userId, name, avatarUrl }); },
    addContact:         (contactId, nickname)                  => send('add_contact',         { contactId, nickname }),
    addContactByName:   (name, nickname)                       => send('add_contact_by_name', { name, nickname }),
    removeContact:      (contactId)                            => send('remove_contact',      { contactId }),
    getContacts:        ()                                     => send('get_contacts'),
    openDirect:         (targetUserId)                         => send('open_direct',         { targetUserId }),
    sendMessage:        (conversationId, content, type='text') => send('send_message',        { conversationId, content, type }),
    editMessage:        (messageId, newContent)                => send('edit_message',        { messageId, newContent }),
    markRead:           (conversationId)                       => send('message_read',        { conversationId }),
    setTyping:          (conversationId, isTyping)             => send('typing',              { conversationId, isTyping }),
    createGroup:        (name, memberIds)                      => send('create_group',        { name, memberIds }),
    deleteMessage:      (messageId, forEveryone=false)         => send('delete_message',      { messageId, forEveryone }),
    deleteConversation: (conversationId, forEveryone=false)    => send('delete_conversation', { conversationId, forEveryone }),
    dismissSuggestion:  ()                                     => dispatch({ type: 'DISMISS_SUGGESTION' }),
    syncAuthorize:      (targetSessionId)                      => send('sync_authorize',      { targetSessionId }),
    syncConfirm:        (code)                                 => send('sync_confirm',        { code }),
    syncTransfer:       (targetSessionId, privateKey)          => send('sync_transfer',       { targetSessionId, privateKey, conversationHistory: {} }),
    dismissSync:        ()                                     => dispatch({ type: 'DISMISS_SYNC' }),
    setActive:          (convId)                               => dispatch({ type: 'SET_ACTIVE', convId }),

    // Carrega histórico de conversa existente
    // Útil quando o usuário abre uma conversa que já existia
    // mas ainda não tem mensagens carregadas na sessão atual
    getHistory: (conversationId, limit = 50) =>
      send('get_history', { conversationId, limit }),

    // ── Chamadas ─────────────────────────────────────────────────────────────

    startCall: async (conversationId, peerId, callType = 'audio') => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });
        localStreamRef.current = stream;
        const pc = createPC(peerId);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const peer = state.users[peerId] ?? {};
        dispatch({
          type:           'CALL_OUTGOING',
          callType,
          conversationId,
          peerId,
          peerName:       peer.name       ?? 'Desconhecido',
          peerAvatar:     peer.avatar_url ?? null,
          localStream:    stream,
        });
        send('call_offer', { to: peerId, conversationId, callType, sdp: offer.sdp });
      } catch (err) {
        console.error('[WebRTC] startCall:', err);
        cleanupCall();
        if (err.name === 'NotAllowedError') {
          alert('Permissão de câmera/microfone negada. Verifique as configurações do navegador.');
        } else if (err.name === 'NotFoundError') {
          alert('Câmera ou microfone não encontrado neste dispositivo.');
        } else {
          alert('Não foi possível iniciar a chamada.');
        }
      }
    },

    answerCall: async () => {
      const { peerId, type: callType } = state.call;
      const pendingSdp = pcRef._pendingOffer;
      if (!peerId || !pendingSdp) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });
        localStreamRef.current = stream;
        const pc = createPC(peerId);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: pendingSdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        dispatch({ type: 'CALL_CONNECTED', localStream: stream });
        send('call_answer', { to: peerId, sdp: answer.sdp });
        pcRef._pendingOffer = null;
      } catch (err) {
        console.error('[WebRTC] answerCall:', err);
        cleanupCall();
        if (err.name === 'NotAllowedError') {
          alert('Permissão de câmera/microfone negada.');
        } else {
          alert('Não foi possível atender a chamada.');
        }
      }
    },

    rejectCall: () => {
      const { peerId } = state.call;
      if (peerId) send('call_reject', { to: peerId });
      cleanupCall();
    },

    endCall: () => {
      const { peerId } = state.call;
      if (peerId) send('call_end', { to: peerId });
      cleanupCall();
    },

    toggleMute: () => {
      const stream = localStreamRef.current;
      if (stream) {
        const nowMuted = !state.call.isMuted;
        stream.getAudioTracks().forEach(t => { t.enabled = !nowMuted; });
      }
      dispatch({ type: 'CALL_TOGGLE_MUTE' });
    },

    toggleCamera: () => {
      const stream = localStreamRef.current;
      if (stream) {
        const nowOff = !state.call.isCameraOff;
        stream.getVideoTracks().forEach(t => { t.enabled = !nowOff; });
      }
      dispatch({ type: 'CALL_TOGGLE_CAMERA' });
    },

    switchCamera: async (localVideoRef) => {
      const stream = localStreamRef.current;
      const pc     = pcRef.current;
      if (!stream || !pc) return;
      const currentTrack  = stream.getVideoTracks()[0];
      if (!currentTrack) return;
      const currentFacing = currentTrack.getSettings().facingMode ?? 'user';
      const nextFacing    = currentFacing === 'user' ? 'environment' : 'user';
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacing } });
        const newTrack  = newStream.getVideoTracks()[0];
        const sender    = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(newTrack);
        stream.removeTrack(currentTrack);
        currentTrack.stop();
        stream.addTrack(newTrack);
        if (localVideoRef?.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.error('[WebRTC] switchCamera:', err);
      }
    },
  };

  return (
    <ChatContext.Provider value={{ state, actions }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat precisa estar dentro de <ChatProvider>');
  return ctx;
}
