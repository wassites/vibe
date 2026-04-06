import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from '../context/ChatContext';
import { useCrypto } from '../hooks/useCrypto';
import { formatTime } from '../lib/utils';

// ── Ícone de status de entrega ────────────────────────────────────────────────

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

// ── Parse de conteúdo cifrado ─────────────────────────────────────────────────

function parseContent(raw) {
  if (!raw) return { type: 'plain', text: raw };
  if (raw.startsWith('{"v":2,')) {
    try { return { type: 'v2', ...JSON.parse(raw) }; } catch {}
  }
  if (raw.startsWith('{"v":1,')) {
    try { return { type: 'v1', ...JSON.parse(raw) }; } catch {}
  }
  return { type: 'plain', text: raw };
}

// ── Constante de janela de edição (15 minutos) ────────────────────────────────

const EDIT_WINDOW_MS = 15 * 60 * 1000;

// ── Contador regressivo ───────────────────────────────────────────────────────

function EditCountdown({ createdAt }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - new Date(createdAt).getTime();
      const left    = Math.max(0, EDIT_WINDOW_MS - elapsed);
      setRemaining(left);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  if (remaining === 0) return null;

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const pct  = (remaining / EDIT_WINDOW_MS) * 100;

  // Muda de cor conforme o tempo passa: verde → amarelo → vermelho
  const color = remaining > 8 * 60000 ? '#48bb78'
              : remaining > 3 * 60000 ? '#ed8936'
              : '#fc8181';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
      {/* Barra de progresso */}
      <div style={{
        flex: 1, height: 2, borderRadius: 2,
        background: 'rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: `${pct}%`,
          background: color,
          transition: 'width 1s linear, background 1s',
        }} />
      </div>
      <span style={{ fontSize: 9, color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {mins}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  );
}

// ── Modal de histórico de edições ─────────────────────────────────────────────

function EditHistoryModal({ history, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20,
          padding: '24px 20px', width: 'min(380px, 90vw)',
          maxHeight: '70vh', overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#111' }}>
            Histórico de edições
          </p>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', cursor: 'pointer',
            color: '#8696a0', fontSize: 18, lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...history].reverse().map((entry, i) => (
            <div key={i} style={{
              padding: '10px 14px',
              background: i === 0 ? '#f0fdf4' : '#f9fafb',
              borderRadius: 12,
              border: i === 0 ? '1px solid #bbf7d0' : '1px solid #e5e7eb',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                  color: i === 0 ? '#16a34a' : '#8696a0',
                  textTransform: 'uppercase',
                }}>
                  {i === 0 ? 'Versão atual' : `Versão ${history.length - i}`}
                </span>
                <span style={{ fontSize: 10, color: '#8696a0' }}>
                  {formatTime(entry.edited_at ?? entry.created_at)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                {entry.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function MessageBubble({ message, isOwn }) {
  const { state, actions } = useChat();
  const { decrypt }        = useCrypto();
  const { me }             = state;

  const [displayContent, setDisplayContent] = useState(null);
  const [decrypting, setDecrypting]         = useState(false);
  const [menu, setMenu]                     = useState(null);

  // ── Estado de edição ────────────────────────────────────────────────────────
  const [editing, setEditing]           = useState(false);
  const [editText, setEditText]         = useState('');
  const [editError, setEditError]       = useState('');
  const [showHistory, setShowHistory]   = useState(false);
  const [canEdit, setCanEdit]           = useState(false);

  const menuRef    = useRef(null);
  const editRef    = useRef(null);

  const isMedia   = ['image', 'audio', 'video'].includes(message.type);
  const isEdited  = !!(message.edit_history?.length > 0 || message.edited_at);
  const editHistory = message.edit_history ?? [];

  // Verifica se ainda está dentro da janela de 15 min
  useEffect(() => {
    function check() {
      const elapsed = Date.now() - new Date(message.created_at).getTime();
      setCanEdit(isOwn && !isMedia && elapsed < EDIT_WINDOW_MS);
    }
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [message.created_at, isOwn, isMedia]);

  // Decifra conteúdo
  useEffect(() => {
    if (isMedia) { setDisplayContent(message.content); return; }

    const parsed = parseContent(message.content);

    if (parsed.type === 'plain') { setDisplayContent(parsed.text); return; }

    if (parsed.type === 'v2') {
      if (isOwn) {
        setDisplayContent(parsed.plain ?? '🔒');
      } else {
        setDecrypting(true);
        decrypt(parsed.encrypted, me?.id).then(result => {
          setDisplayContent(result ?? '🔒 Não foi possível decifrar');
          setDecrypting(false);
        });
      }
      return;
    }

    if (parsed.type === 'v1') {
      setDecrypting(true);
      decrypt(message.content, me?.id).then(result => {
        setDisplayContent(result ?? '🔒 Não foi possível decifrar');
        setDecrypting(false);
      });
    }
  }, [message.content, me?.id, isOwn]);

  // Fecha menu ao clicar fora
  useEffect(() => {
    if (!menu) return;
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menu]);

  // Foca o textarea ao abrir edição
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      const len = editRef.current.value.length;
      editRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  // ── Abre modo edição ────────────────────────────────────────────────────────

  function openEdit() {
    const parsed = parseContent(message.content);
    const plain  = parsed.type === 'v2' ? (parsed.plain ?? '') : (displayContent ?? message.content ?? '');
    setEditText(plain);
    setEditError('');
    setEditing(true);
    setMenu(null);
  }

  // ── Confirma edição ─────────────────────────────────────────────────────────

  const confirmEdit = useCallback(async () => {
    const newText = editText.trim();
    if (!newText) { setEditError('Mensagem não pode ser vazia.'); return; }

    const parsed   = parseContent(message.content);
    const original = parsed.type === 'v2' ? (parsed.plain ?? '') : (displayContent ?? '');
    if (newText === original) { setEditing(false); return; }

    // Verifica janela de tempo novamente antes de enviar
    const elapsed = Date.now() - new Date(message.created_at).getTime();
    if (elapsed >= EDIT_WINDOW_MS) {
      setEditError('Tempo de edição expirou.');
      setEditing(false);
      return;
    }

    actions.editMessage(message.id, newText);
    setEditing(false);
    setEditError('');
  }, [editText, message, displayContent, actions]);

  function cancelEdit() {
    setEditing(false);
    setEditError('');
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmEdit(); }
    if (e.key === 'Escape') cancelEdit();
  }

  // Preview para ConversationItem
  const previewText = (() => {
    const parsed = parseContent(message.content);
    if (parsed.type === 'v2') return parsed.plain ?? '🔒 Mensagem cifrada';
    if (parsed.type === 'v1') return '🔒 Mensagem cifrada';
    return message.content;
  })();

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className={`flex w-full mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
        onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
        data-preview={previewText}
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
          {/* ── Mídia ────────────────────────────────────────────────────── */}
          {message.type === 'image' && (
            <img src={message.content} alt="imagem"
                 className="rounded-xl max-w-full max-h-60 object-cover mb-1 cursor-pointer"
                 onClick={() => window.open(message.content, '_blank')} />
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

          {/* ── Texto normal ─────────────────────────────────────────────── */}
          {!isMedia && !editing && (
            <p className="leading-relaxed break-words whitespace-pre-wrap" style={{ color: '#111827' }}>
              {decrypting
                ? <span style={{ color: '#8696a0', fontSize: '12px' }}>🔐 decifrando...</span>
                : (displayContent ?? message.content)
              }
            </p>
          )}

          {/* ── Modo edição inline ───────────────────────────────────────── */}
          {!isMedia && editing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                ref={editRef}
                value={editText}
                onChange={e => { setEditText(e.target.value); setEditError(''); }}
                onKeyDown={handleEditKeyDown}
                rows={Math.min(6, editText.split('\n').length + 1)}
                style={{
                  width: '100%', border: '1.5px solid #25d366',
                  borderRadius: 10, padding: '6px 10px',
                  fontSize: 13, lineHeight: 1.5,
                  resize: 'none', outline: 'none',
                  background: 'rgba(255,255,255,0.9)',
                  color: '#111827',
                  fontFamily: 'inherit',
                }}
              />
              {editError && (
                <span style={{ fontSize: 11, color: '#ef4444' }}>{editError}</span>
              )}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  onClick={cancelEdit}
                  style={{
                    padding: '3px 12px', borderRadius: 8, fontSize: 12,
                    border: '1px solid #e5e7eb', background: '#fff',
                    cursor: 'pointer', color: '#6b7280',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmEdit}
                  style={{
                    padding: '3px 12px', borderRadius: 8, fontSize: 12,
                    border: 'none', background: '#25d366',
                    cursor: 'pointer', color: '#fff', fontWeight: 600,
                  }}
                >
                  Salvar
                </button>
              </div>
              {/* Contador regressivo dentro do modo edição */}
              <EditCountdown createdAt={message.created_at} />
            </div>
          )}

          {/* ── Rodapé: hora + status + editado ──────────────────────────── */}
          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
               style={{ flexWrap: 'wrap' }}>

            {/* Badge "editado" clicável — abre histórico */}
            {isEdited && !editing && (
              <button
                onClick={() => editHistory.length > 0 && setShowHistory(true)}
                style={{
                  fontSize: 10, color: '#8696a0',
                  background: 'none', border: 'none', padding: 0,
                  cursor: editHistory.length > 0 ? 'pointer' : 'default',
                  textDecoration: editHistory.length > 0 ? 'underline dotted' : 'none',
                  textUnderlineOffset: 2,
                }}
                title={editHistory.length > 0 ? 'Ver histórico de edições' : ''}
              >
                editado
              </button>
            )}

            <span style={{ fontSize: '10px', color: '#8696a0' }}>
              {formatTime(message.created_at)}
            </span>
            {isOwn && <StatusIcon status={message.status} />}
          </div>

          {/* Contador regressivo fora do modo edição (visível só pro remetente) */}
          {canEdit && !editing && (
            <EditCountdown createdAt={message.created_at} />
          )}
        </div>
      </div>

      {/* ── Menu de contexto ─────────────────────────────────────────────────── */}
      {menu && (
        <div ref={menuRef}
             className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-40"
             style={{ top: menu.y, left: menu.x }}>

          {/* Editar — só para o remetente dentro da janela de 15 min */}
          {canEdit && (
            <button
              onClick={openEdit}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700
                         hover:bg-gray-50 transition-colors text-left"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-400">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              Editar mensagem
            </button>
          )}

          {/* Ver histórico — se tiver edições e for o remetente */}
          {isEdited && isOwn && editHistory.length > 0 && (
            <button
              onClick={() => { setShowHistory(true); setMenu(null); }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700
                         hover:bg-gray-50 transition-colors text-left"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-400">
                <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
              </svg>
              Ver histórico
            </button>
          )}

          <div className="border-t border-gray-100 my-1" />

          <button
            onClick={() => { actions.deleteMessage(message.id, false); setMenu(null); }}
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
              onClick={() => { actions.deleteMessage(message.id, true); setMenu(null); }}
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

      {/* ── Modal de histórico de edições ────────────────────────────────────── */}
      {showHistory && (
        <EditHistoryModal
          history={[
            // Inclui versão original se existir
            ...(message.original_content
              ? [{ text: message.original_content, edited_at: message.created_at }]
              : []),
            ...editHistory,
            // Versão atual
            { text: displayContent ?? message.content, edited_at: message.edited_at ?? message.created_at },
          ]}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}
