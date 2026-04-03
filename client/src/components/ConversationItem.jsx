import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import Avatar from './Avatar';
import { formatTime } from '../lib/utils';

function getPreview(msg, meId) {
  if (!msg) return 'Nenhuma mensagem ainda';
  const prefix = msg.sender_id === meId ? 'Você: ' : '';

  if (['image','audio','video'].includes(msg.type))
    return prefix + `[${msg.type}]`;

  const raw = msg.content ?? '';

  // Formato v2 — tem campo plain com texto original
  if (raw.startsWith('{"v":2,')) {
    try {
      const parsed = JSON.parse(raw);
      return prefix + (parsed.plain ?? '🔒 Mensagem cifrada');
    } catch {}
  }

  // Formato v1 — cifrado puro
  if (raw.startsWith('{"v":1,')) return prefix + '🔒 Mensagem cifrada';

  return prefix + raw;
}

export default function ConversationItem({ conversation, isActive, onClick }) {
  const { state, actions } = useChat();
  const { messages, participants, users, me } = state;
  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);

  const msgs      = messages[conversation.id] ?? [];
  const last      = msgs[msgs.length - 1];
  const others    = (participants[conversation.id] ?? []).filter(u => u?.id !== me?.id);
  const otherUser = conversation.type === 'direct' ? users[others[0]?.id] : null;

  const title     = conversation.type === 'group'
    ? conversation.name
    : otherUser?.name ?? others[0]?.name ?? 'Conversa';

  const avatarUrl = conversation.type === 'direct' ? otherUser?.avatar_url ?? null : null;
  const isOnline  = conversation.type === 'direct' ? otherUser?.status === 'online' : false;
  const preview   = getPreview(last, me?.id);

  useEffect(() => {
    if (!menu) return;
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menu]);

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-100
                    ${isActive
                      ? 'bg-vibe-hover border-l-2 border-vibe-accent'
                      : 'hover:bg-vibe-hover border-l-2 border-transparent'
                    }`}
      >
        <Avatar name={title} avatarUrl={avatarUrl} size="md" online={isOnline} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-vibe-text truncate">{title}</p>
            {last && (
              <span className="text-xs text-vibe-muted flex-shrink-0">
                {formatTime(last.created_at)}
              </span>
            )}
          </div>
          <p className="text-xs text-vibe-muted truncate mt-0.5">{preview}</p>
        </div>
      </button>

      {menu && (
        <div ref={menuRef}
             className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-44"
             style={{ top: menu.y, left: menu.x }}>
          <button
            onClick={() => { actions.deleteConversation(conversation.id, false); setMenu(null); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700
                       hover:bg-gray-50 transition-colors text-left"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-400">
              <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
            </svg>
            Apagar para mim
          </button>
          <button
            onClick={() => {
              if (!confirm('Apagar conversa para todos?')) return;
              actions.deleteConversation(conversation.id, true);
              setMenu(null);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500
                       hover:bg-red-50 transition-colors text-left"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
            </svg>
            Apagar para todos
          </button>
        </div>
      )}
    </>
  );
}
