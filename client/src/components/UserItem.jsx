import React from 'react';
import Avatar from './Avatar';

export default function UserItem({ user, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3
                 hover:bg-vibe-hover transition-colors text-left"
    >
      <Avatar name={user.name} size="md" online={true} />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-vibe-text truncate">{user.name}</p>
        <p className="text-xs text-green-400">online</p>
      </div>

      {/* Ícone de iniciar conversa */}
      <svg className="w-4 h-4 text-vibe-muted flex-shrink-0"
           viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9
                 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    </button>
  );
}
