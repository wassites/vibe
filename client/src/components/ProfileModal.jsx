import React, { useState, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { useTheme } from '../hooks/useTheme';
import Avatar from './Avatar';

const API = `http://${window.location.hostname}:3001`;

const COLOR_OPTIONS = [
  { label: 'Verde WhatsApp', accent: '#25d366', accentDim: '#128c7e', bubbleOut: '#dcf8c6' },
  { label: 'Azul',           accent: '#3b82f6', accentDim: '#1d4ed8', bubbleOut: '#dbeafe' },
  { label: 'Roxo',           accent: '#8b5cf6', accentDim: '#6d28d9', bubbleOut: '#ede9fe' },
  { label: 'Rosa',           accent: '#ec4899', accentDim: '#be185d', bubbleOut: '#fce7f3' },
  { label: 'Laranja',        accent: '#f97316', accentDim: '#c2410c', bubbleOut: '#ffedd5' },
  { label: 'Cinza escuro',   accent: '#374151', accentDim: '#111827', bubbleOut: '#f3f4f6' },
];

const BG_OPTIONS = [
  { label: 'Branco',       bg: '#f0f2f5', panel: '#ffffff', text: '#111827' },
  { label: 'Bege',         bg: '#fdf6e3', panel: '#fffbf0', text: '#111827' },
  { label: 'Escuro',       bg: '#111827', panel: '#1f2937', text: '#f9fafb' },
  { label: 'Cinza escuro', bg: '#1a1a2e', panel: '#16213e', text: '#e2e8f0' },
];

export default function ProfileModal({ onClose }) {
  const { state, actions } = useChat();
  const { theme, setTheme, resetTheme } = useTheme();
  const { me } = state;

  const [tab,          setTab]          = useState('perfil');
  const [name,         setName]         = useState(me?.name      ?? '');
  const [bio,          setBio]          = useState(me?.bio       ?? '');
  const [avatarUrl,    setAvatarUrl]    = useState(me?.avatar_url ?? null);
  const [loading,      setLoading]      = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [feedback,     setFeedback]     = useState(null);
  const [copied,       setCopied]       = useState(false);
  const fileRef = useRef(null);

  function copyId() {
    navigator.clipboard.writeText(me?.id ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Upload da foto de perfil
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploadingPic(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`${API}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!data.ok) return setFeedback({ ok: false, msg: data.error ?? 'Erro ao enviar foto' });
      setAvatarUrl(data.url);
      setFeedback({ ok: true, msg: 'Foto carregada! Clique em Salvar para confirmar.' });
    } catch {
      setFeedback({ ok: false, msg: 'Erro de conexão' });
    } finally {
      setUploadingPic(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setFeedback(null);
    try {
      const token = localStorage.getItem('vibe_token');
      const res   = await fetch(`${API}/api/users/${me.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ name: name.trim(), bio: bio.trim(), avatarUrl }),
      });
      const data = await res.json();
      if (!data.ok) {
        setFeedback({ ok: false, msg: data.error ?? 'Erro ao salvar' });
      } else {
        actions.auth(data.user.id, data.user.name, data.user.avatar_url);
        setFeedback({ ok: true, msg: 'Perfil atualizado!' });
        setTimeout(onClose, 1000);
      }
    } catch {
      setFeedback({ ok: false, msg: 'Erro de conexão' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
           style={{ width: '340px' }}>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Configurações</h2>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg
                       text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/>
            </svg>
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-gray-100">
          {[['perfil', 'Perfil'], ['cores', 'Aparência']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors
                          ${tab === t
                            ? 'text-green-600 border-b-2 border-green-500'
                            : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4 max-h-[480px] overflow-y-auto">

          {/* ── ABA PERFIL ── */}
          {tab === 'perfil' && (
            <>
              {/* Avatar clicável */}
              <div className="flex justify-center">
                <div className="relative cursor-pointer group"
                     onClick={() => fileRef.current?.click()}>
                  <Avatar name={me?.name} avatarUrl={avatarUrl} size="lg" online={true} />

                  {/* Overlay ao hover */}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center
                                  justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingPic
                      ? <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
                          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                        </svg>
                      : <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                          <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/>
                          <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                        </svg>
                    }
                  </div>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <p className="text-xs text-gray-400 text-center -mt-2">
                Clique na foto para alterar
              </p>

              {/* ID único */}
              <div className="space-y-1">
                <p className="text-xs text-gray-500 font-medium">Seu ID único</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <p className="flex-1 text-xs font-mono text-gray-700 truncate">{me?.id}</p>
                  <button onClick={copyId} title="Copiar ID"
                    className="text-green-600 hover:opacity-70 transition-opacity flex-shrink-0">
                    {copied
                      ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-500">
                          <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                        </svg>
                      : <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M16 1H4C3 1 2 2 2 3v14h2V3h12V1zm3 4H8C7 5 6 6 6 7v14c0 1 1 2 2 2h11c1 0 2-1 2-2V7c0-1-1-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                    }
                  </button>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-3">
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={32}
                  disabled={loading}
                  className="w-full bg-white border border-gray-300 rounded-xl
                             px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400
                             focus:outline-none focus:border-green-500
                             disabled:opacity-50 transition-colors"
                />
                <textarea
                  placeholder="Bio (opcional)"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  maxLength={120}
                  rows={2}
                  disabled={loading}
                  className="w-full bg-white border border-gray-300 rounded-xl
                             px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400
                             focus:outline-none focus:border-green-500
                             resize-none disabled:opacity-50 transition-colors"
                />
                {feedback && (
                  <p className={`text-xs text-center ${feedback.ok ? 'text-green-600' : 'text-red-500'}`}>
                    {feedback.msg}
                  </p>
                )}
                <button type="submit" disabled={!name.trim() || loading || uploadingPic}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                             bg-green-500 hover:bg-green-600 active:scale-95
                             disabled:opacity-40 disabled:cursor-not-allowed
                             transition-all duration-150">
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </form>
            </>
          )}

          {/* ── ABA CORES ── */}
          {tab === 'cores' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cor de destaque</p>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_OPTIONS.map(opt => (
                    <button key={opt.label}
                      onClick={() => setTheme({ accent: opt.accent, accentDim: opt.accentDim, bubbleOut: opt.bubbleOut })}
                      className="flex items-center gap-2 px-2 py-2 rounded-xl border text-xs font-medium transition-all hover:scale-105"
                      style={{
                        borderColor: theme.accent === opt.accent ? opt.accent : '#e5e7eb',
                        background:  theme.accent === opt.accent ? opt.accent + '15' : '#f9fafb',
                        color: '#374151',
                      }}>
                      <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: opt.accent }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Fundo</p>
                <div className="grid grid-cols-2 gap-2">
                  {BG_OPTIONS.map(opt => (
                    <button key={opt.label}
                      onClick={() => setTheme({ bg: opt.bg, panel: opt.panel, text: opt.text })}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all hover:scale-105"
                      style={{
                        borderColor: theme.bg === opt.bg ? theme.accent : '#e5e7eb',
                        background: opt.panel,
                        color: opt.text,
                      }}>
                      <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                            style={{ background: opt.bg }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Preview</p>
                <div className="rounded-xl p-3 space-y-2" style={{ background: theme.bg }}>
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-2xl rounded-bl-sm text-xs max-w-xs shadow-sm"
                         style={{ background: theme.panel, color: theme.text, border: '1px solid #e5e7eb' }}>
                      Olá! Como vai?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="px-3 py-2 rounded-2xl rounded-br-sm text-xs max-w-xs shadow-sm"
                         style={{ background: theme.bubbleOut, color: '#111827' }}>
                      Tudo bem, e você?
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={resetTheme}
                className="w-full py-2 rounded-xl text-xs font-medium text-gray-500
                           border border-gray-200 hover:bg-gray-50 hover:text-gray-700 transition-colors">
                Restaurar cores padrão
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}