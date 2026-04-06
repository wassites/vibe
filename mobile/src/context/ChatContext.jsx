// mobile/src/context/ChatContext.jsx

import React, {
  createContext, useContext,
  useReducer, useCallback, useRef,
} from 'react';
import { WS_URL } from '../lib/api';
import { getUser, clearAll } from '../lib/storage';

// ─── Estado inicial ───────────────────────────────────────────────────────────

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

  // Estado da chamada
  call: {
    status:         'idle',     // idle | calling | ringing | connected
    type:           null,       // 'audio' | 'video'
    conversationId: null,
    peerId:         null,
    peerName:       null,
    peerAvatar:     null,
    isMuted:        false,
    isCameraOff:    false,
    startedAt:      null,
  },
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    case 'CONNECTED':    return { ...state, connected: true };
    case 'DISCONNECTED': return { ...state, connected: false };
    case 'LOGOUT':       return { ...initial };

    case 'AUTHENTICATED': {
      const users = { ...state.users };
      if (action.user) users[action.user.id] = action.user;
      action.contacts?.forEach(c => { users[c.id] = c; });
      if (action.usersMap)
        Object.values(action.usersMap).forEach(u => { if (u) users[u.id] = u; });
      return {
        ...state,
        me:            action.user,
        conversations: action.conversations   ?? [],
        contacts:      action.contacts        ?? [],
        participants:  action.participantsMap ?? {},
        users,
      };
    }

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
      const participants = {
        ...state.participants,
        [action.conversation.id]: action.participants ?? [],
      };
      action.participants?.forEach(u => { if (u) users[u.id] = u; });
      const exists = state.conversations.some(c => c.id === action.conversation.id);
      return {
        ...state,
        conversations: exists
          ? state.conversations
          : [action.conversation, ...state.conversations],
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
      return {
        ...state,
        conversations,
        messages: { ...state.messages, [m.conversation_id]: [...prev, m] },
      };
    }

    case 'MESSAGE_DELETED': {
      const { messageId, conversationId } = action;
      const prev = state.messages[conversationId] ?? [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: prev.filter(m => m.id !== messageId),
        },
      };
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
      return {
        ...state,
        contacts: state.contacts.filter(c => c.id !== action.contactId),
      };

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
          status:    'connected',
          startedAt: Date.now(),
        },
      };

    case 'CALL_TOGGLE_MUTE':
      return { ...state, call: { ...state.call, isMuted: !state.call.isMuted } };

    case 'CALL_TOGGLE_CAMERA':
      return { ...state, call: { ...state.call, isCameraOff: !state.call.isCameraOff } };

    case 'CALL_ENDED':
      return { ...state, call: { ...initial.call } };

    default: return state;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);
  const isConnecting = useRef(false);

  // pendingOffer guarda o SDP do offer recebido até atender
  const pendingOfferRef = useRef(null);

  // ── send ───────────────────────────────────────────────────────────────────

  function send(event, payload = {}) {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, ...payload }));
    } else {
      console.warn('[WS] não conectado, descartando:', event);
    }
  }

  // ── handleMessage ──────────────────────────────────────────────────────────

  function handleMessage(data) {
    switch (data.event) {

      case 'authenticated':
        dispatch({
          type:            'AUTHENTICATED',
          user:            data.user,
          conversations:   data.conversations,
          contacts:        data.contacts,
          participantsMap: data.participantsMap,
          usersMap:        data.usersMap,
        });
        break;

      case 'conversation_ready':
        dispatch({ type: 'CONVERSATION_READY', ...data });
        break;

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
        dispatch({
          type:      'PRESENCE',
          userId:    data.userId,
          status:    data.status,
          name:      data.name,
          avatarUrl: data.avatarUrl,
        });
        break;

      case 'typing':
        dispatch({
          type:           'TYPING',
          conversationId: data.conversationId,
          userId:         data.userId,
          isTyping:       data.isTyping,
        });
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
        dispatch({
          type: 'CONTACT_SUGGESTION',
          suggestion: { user: data.user, conversationId: data.conversationId, message: data.message },
        });
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

      // ── Sinalização WebRTC ────────────────────────────────────────────────

      case 'call_offer': {
        // Guarda o SDP para usar quando atender
        pendingOfferRef.current = data.sdp;
        const peer = data.fromUser ?? {};
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

      case 'call_answer':
        // O useWebRTC trata isso diretamente via ref
        // Emitimos um evento customizado para o hook
        dispatch({ type: 'CALL_CONNECTED' });
        break;

      case 'call_ice':
        // O useWebRTC trata os ICE candidates diretamente
        // Armazenamos no ref para o hook consumir
        if (wsRef._iceHandler) wsRef._iceHandler(data.candidate);
        break;

      case 'call_reject':
      case 'call_end':
      case 'call_busy':
      case 'call_unavailable':
        pendingOfferRef.current = null;
        dispatch({ type: 'CALL_ENDED' });
        break;
    }
  }

  // ── connect ────────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (isConnecting.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    isConnecting.current = true;

    try {
      const user = await getUser();
      if (!user) { isConnecting.current = false; return; }

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnecting.current = false;
        dispatch({ type: 'CONNECTED' });
        clearTimeout(reconnectRef.current);
        send('auth', { userId: user.id, name: user.name, avatarUrl: user.avatar_url ?? null });
      };

      ws.onmessage = (e) => {
        let data;
        try { data = JSON.parse(e.data); } catch { return; }
        handleMessage(data);
      };

      ws.onclose = () => {
        isConnecting.current = false;
        dispatch({ type: 'DISCONNECTED' });
        dispatch({ type: 'CALL_ENDED' });
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        isConnecting.current = false;
        ws.close();
      };

    } catch (err) {
      isConnecting.current = false;
      console.error('[WS] connect error:', err);
      reconnectRef.current = setTimeout(connect, 5000);
    }
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const actions = {
    connect,
    disconnect: async () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current        = null;
      isConnecting.current = false;
      await clearAll();
      dispatch({ type: 'LOGOUT' });
    },

    // Conversas
    openDirect:         (targetUserId)                         => send('open_direct',         { targetUserId }),
    sendMessage:        (conversationId, content, type='text') => send('send_message',        { conversationId, content, type }),
    editMessage:        (messageId, newContent)                => send('edit_message',        { messageId, newContent }),
    deleteMessage:      (messageId, forEveryone=false)         => send('delete_message',      { messageId, forEveryone }),
    deleteConversation: (conversationId, forEveryone=false)    => send('delete_conversation', { conversationId, forEveryone }),
    createGroup:        (name, memberIds)                      => send('create_group',        { name, memberIds }),
    getHistory:         (conversationId, limit=50)             => send('get_history',         { conversationId, limit }),
    markRead:           (conversationId)                       => send('message_read',        { conversationId }),
    setTyping:          (conversationId, isTyping)             => send('typing',              { conversationId, isTyping }),

    // Contatos
    addContact:        (contactId, nickname) => send('add_contact',         { contactId, nickname }),
    addContactByName:  (name, nickname)      => send('add_contact_by_name', { name, nickname }),
    removeContact:     (contactId)           => send('remove_contact',      { contactId }),
    getContacts:       ()                    => send('get_contacts'),
    dismissSuggestion: ()                    => dispatch({ type: 'DISMISS_SUGGESTION' }),
    setActive:         (convId)              => dispatch({ type: 'SET_ACTIVE', convId }),

    // Chamadas — sinalização pelo socket
    sendCallSignal: (event, to, payload) => send(event, { to, ...payload }),

    // Chamadas — estado local
    dispatchCall: (action) => dispatch(action),

    // Expose pendingOffer para o useWebRTC
    getPendingOffer: () => pendingOfferRef.current,
    clearPendingOffer: () => { pendingOfferRef.current = null; },

    // Expose wsRef para o useWebRTC registrar handler de ICE
    registerIceHandler: (fn) => { wsRef._iceHandler = fn; },
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
