import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { formatTime } from '../lib/utils';

function StatusIcon({ status }) {
  if (status === 'read') {
    return (
      <svg className="w-3.5 h-3.5" style={{ color: '#53bdeb' }} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 7l-8 8-4-4-1.5 1.5L10 18 19.5 8.5z"/>
        <path d="M22 7l-8 8-1.5-1.5L20 7z" opacity="0.8"/>
      </svg>
    );
  }
  if (status === 'delivered') {
    return (
      <svg className="w-3.5 h-3.5" style={{ color: '#8696a0' }} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 7l-8 8-4-4-1.5 1.5L10 18 19.5 8.5z"/>
        <path d="M22 7l-8 8-1.5-1.5L20 7z" opacity="0.6"/>
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5" style={{ color: '#8696a0' }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 7l-8 8-4-4-1.5 1.5L10 18 19.5 8.5z"/>
    </svg>
  );
}

export default function MessageBubble({ message, isOwn }) {
  const { actions } = useChat();
  const [menu, setMenu] = useState(null); // { x, y }
  const menuRef = useRef(null);
  const isMedia = ['image', 'audio', 'video'].includes(message.type);

  // Fecha menu ao clicar fora
  useEffect(() => {
    if (!menu) return;
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menu]);

  function handleContextMenu(e) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  function handleDeleteMe() {
    actions.deleteMessage(message.id, false);
    setMenu(null);
  }

  function handleDeleteAll() {
    actions.deleteMessage(message.id, true);
    setMenu(null);
  }

  return (
    <>
      <div
        className={`flex w-full mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
        onContextMenu={handleContextMenu}
      >
        <div
          style={{
            background:   isOwn ? 'var(--bubble-out, #dcf8c6)' : '#ffffff',
            color:        '#111827',
            border:       isOwn ? 'none' : '1px solid #e5e7eb',
            boxShadow:    '0 1px 2px rgba(0,0,0,0.08)',
            borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          }}
          className="relative max-w-[70%] px-3 py-2 text-sm"
        >
          {message.type === 'image' && (
            <img
              src={message.content}
              alt="imagem"
              className="rounded-xl max-w-full max-h-60 object-cover mb-1 cursor-pointer"
              onClick={() => window.open(message.content, '_blank')}
            />
          )}

          {message.type === 'audio' && (
            <audio controls className="w-full mb-1" style={{ minWidth: '220px' }}>
              <source src={message.content} />
            </audio>
          )}

          {message.type === 'video' && (
            <video controls className="rounded-xl max-w-full max-h-60 mb-1">
              <source src={message.content} />
            </video>
          )}

          {!isMedia && (
            <p className="leading-relaxed break-words whitespace-pre-wrap" style={{ color: '#111827' }}>
              {message.content}
            </p>
          )}

          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span style={{ fontSize: '10px', color: '#8696a0' }}>
              {formatTime(message.created_at)}
            </span>
            {isOwn && <StatusIcon status={message.status} />}
          </div>
        </div>
      </div>

      {/* Menu de contexto */}
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-40"
          style={{ top: menu.y, left: menu.x }}
        >
          <button
            onClick={handleDeleteMe}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700
                       hover:bg-gray-50 transition-colors text-left"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-400">
              <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
            </svg>
            Apagar para mim
          </button>

          {isOwn && (
            <button
              onClick={handleDeleteAll}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500
                         hover:bg-red-50 transition-colors text-left"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
              </svg>
              Apagar para todos
            </button>
          )}
        </div>
      )}
    </>
  );
}
