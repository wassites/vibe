import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';

const initial = {
  connected:        false,
  me:               null,
  conversations:    [],
  activeConvId:     null,
  messages:         {},
  participants:     {},
  users:            {},
  typing:           {},
  contacts:         [],
  contactSuggestion: null, // { user, conversationId, message }
};

function reducer(state, action) {
  switch (action.type) {

    case 'CONNECTED':    return { ...state, connected: true };
    case 'DISCONNECTED': return { ...state, connected: false };

    case 'AUTHENTICATED': {
      const users = { ...state.users };
      if (action.user) users[action.user.id] = action.user;
      action.contacts?.forEach(c => { users[c.id] = c; });
      // Carrega usuários das conversas vindos do servidor
      if (action.usersMap) {
        Object.values(action.usersMap).forEach(u => { if (u) users[u.id] = u; });
      }
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

      // Sempre substitui a conversa com dados completos
      const filtered = state.conversations.filter(c => c.id !== action.conversation.id);
      return {
        ...state,
        conversations: [action.conversation, ...filtered],
        activeConvId:  action.conversation.id,
        messages, participants, users,
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
        participants,
        users,
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
        messages: { ...state.messages, [conversationId]: prev.filter(m => m.id !== messageId) },
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
        messages,
        participants,
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
          ? {
              ...c,
              status: action.status,
              ...(action.name      ? { name:       action.name }      : {}),
              ...(action.avatarUrl ? { avatar_url: action.avatarUrl } : {}),
            }
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

    case 'CONTACT_REMOVED': {
      const contacts = state.contacts.filter(c => c.id !== action.contactId);
      return { ...state, contacts };
    }

    case 'CONTACTS': {
      const users = { ...state.users };
      action.contacts.forEach(c => { users[c.id] = c; });
      return { ...state, contacts: action.contacts, users };
    }

    case 'CONTACT_SUGGESTION':
      return { ...state, contactSuggestion: action.suggestion };

    case 'DISMISS_SUGGESTION':
      return { ...state, contactSuggestion: null };

    case 'SET_ACTIVE': return { ...state, activeConvId: action.convId };

    default: return state;
  }
}

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const handleMessage = useCallback((data) => {
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
      case 'group_created':
        dispatch({ type: 'GROUP_CREATED', conversation: data.conversation, participants: data.participants });
        break;
      case 'new_message':
        dispatch({ type: 'NEW_MESSAGE', message: data.message });
        break;
      case 'message_sent':
        dispatch({ type: 'MESSAGE_SENT', message: data.message });
        break;
      case 'message_deleted':
        dispatch({ type: 'MESSAGE_DELETED', messageId: data.messageId, conversationId: data.conversationId });
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
    }
  }, []);

  const { send } = useSocket({
    onOpen:    () => dispatch({ type: 'CONNECTED' }),
    onClose:   () => dispatch({ type: 'DISCONNECTED' }),
    onMessage: handleMessage,
  });

  const actions = {
    auth:               (userId, name, avatarUrl)             => send('auth',                { userId, name, avatarUrl }),
    addContact:         (contactId, nickname)                  => send('add_contact',         { contactId, nickname }),
    addContactByName:   (name, nickname)                       => send('add_contact_by_name', { name, nickname }),
    removeContact:      (contactId)                            => send('remove_contact',      { contactId }),
    getContacts:        ()                                     => send('get_contacts'),
    openDirect:         (targetUserId)                         => send('open_direct',         { targetUserId }),
    sendMessage:        (conversationId, content, type='text') => send('send_message',        { conversationId, content, type }),
    markRead:           (conversationId)                       => send('message_read',        { conversationId }),
    setTyping:          (conversationId, isTyping)             => send('typing',              { conversationId, isTyping }),
    createGroup:        (name, memberIds)                      => send('create_group',        { name, memberIds }),
    deleteMessage:      (messageId, forEveryone=false)         => send('delete_message',      { messageId, forEveryone }),
    deleteConversation: (conversationId, forEveryone=false)    => send('delete_conversation', { conversationId, forEveryone }),
    dismissSuggestion:  ()                                     => dispatch({ type: 'DISMISS_SUGGESTION' }),
    setActive:          (convId)                               => dispatch({ type: 'SET_ACTIVE', convId }),
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
