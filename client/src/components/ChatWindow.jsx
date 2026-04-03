import React, { useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import Avatar from './Avatar';

export default function ChatWindow() {
  const { state, actions } = useChat();
  const bottomRef = useRef(null);

  const { activeConvId, conversations, messages, participants, users, me, typing, contactSuggestion } = state;

  const conv   = conversations.find(c => c.id === activeConvId);
  const msgs   = messages[activeConvId] ?? [];
  const others = (participants[activeConvId] ?? []).filter(u => u?.id !== me?.id);

  const otherUser = conv?.type === 'direct' ? users[others[0]?.id] : null;
  const title     = conv?.type === 'group' ? conv.name : otherUser?.name ?? others[0]?.name ?? 'Conversa';
  const avatarUrl = conv?.type === 'direct' ? otherUser?.avatar_url ?? null : null;
  const isOnline  = conv?.type === 'direct' ? otherUser?.status === 'online' : false;

  const typingUsers = [...(typing[activeConvId] ?? [])]
    .map(uid => users[uid]?.name)
    .filter(Boolean);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  useEffect(() => {
    if (activeConvId) actions.markRead(activeConvId);
  }, [activeConvId, msgs.length]);

  // Quando conversa sem participantes é aberta, busca dados completos
  useEffect(() => {
    if (!activeConvId) return;
    const parts = participants[activeConvId];
    if (!parts || parts.length === 0) {
      const convMsgs = messages[activeConvId] ?? [];
      const otherId  = convMsgs.find(m => m.sender_id !== me?.id)?.sender_id;
      if (otherId) actions.openDirect(otherId);
    }
  }, [activeConvId]);

  if (!conv) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-vibe-bg">
        <div className="text-5xl mb-4">⚡</div>
        <p className="text-vibe-muted text-sm">Selecione uma conversa para começar</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-vibe-bg overflow-hidden">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3 px-4 py-3
                      bg-vibe-panel border-b border-vibe-border flex-shrink-0">
        <Avatar name={title} avatarUrl={avatarUrl} size="md" online={isOnline} />
        <div className="flex-1 min-w-0">
          <p className="text-vibe-text font-medium text-sm truncate">{title}</p>
          <p className="text-xs text-vibe-muted">{isOnline ? 'online' : 'offline'}</p>
        </div>
      </div>

      {/* Banner de sugestão de contato */}
      {contactSuggestion && contactSuggestion.conversationId === activeConvId && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border-b border-green-100">
          <Avatar
            name={contactSuggestion.user.name}
            avatarUrl={contactSuggestion.user.avatar_url}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700">{contactSuggestion.message}</p>
          </div>
          <button
            onClick={() => {
              actions.addContact(contactSuggestion.user.id);
              actions.dismissSuggestion();
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white
                       bg-green-500 hover:bg-green-600 transition-colors flex-shrink-0"
          >
            Adicionar
          </button>
          <button
            onClick={actions.dismissSuggestion}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400
                       hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/>
            </svg>
          </button>
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {msgs.length === 0 && (
          <p className="text-center text-vibe-muted text-xs mt-8">
            Nenhuma mensagem ainda. Diga olá! 👋
          </p>
        )}

        {msgs.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender_id === me?.id}
          />
        ))}

        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-vibe-muted rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-vibe-muted rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-vibe-muted rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-vibe-muted">
              {typingUsers.join(', ')} digitando...
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <InputBar conversationId={activeConvId} />
    </div>
  );
}
