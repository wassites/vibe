import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';

export default function AddContact({ onClose }) {
  const { actions, state } = useChat();

  const [tab, setTab]       = useState('nome');   // 'nome' | 'id'
  const [value, setValue]   = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, msg }

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim()) return;

    setLoading(true);
    setFeedback(null);

    if (tab === 'nome') {
      actions.addContactByName(value.trim(), nickname.trim() || null);
    } else {
      actions.addContact(value.trim(), nickname.trim() || null);
    }

    // Feedback visual — o servidor responde com contact_added ou error
    // Aguarda 1.5s e fecha se não tiver erro
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 1500);
  }

  // Meu link de convite
  const myLink = `${window.location.origin}/add/${state.me?.id}`;

  function copyLink() {
    navigator.clipboard.writeText(myLink);
    setFeedback({ ok: true, msg: 'Link copiado!' });
    setTimeout(() => setFeedback(null), 2000);
  }

  return (
    // Overlay
    <div className="absolute inset-0 z-50 flex items-center justify-center
                    bg-black/60 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="w-80 bg-vibe-surface border border-vibe-border rounded-2xl
                      shadow-glow-purple overflow-hidden">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3
                        border-b border-vibe-border">
          <h2 className="text-sm font-semibold text-vibe-text">
            Adicionar contato
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg
                       text-vibe-muted hover:text-vibe-text hover:bg-vibe-hover
                       transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/>
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">

          {/* Abas: por nome / por ID */}
          <div className="flex gap-1 bg-vibe-panel rounded-lg p-1">
            {['nome', 'id'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setValue(''); setFeedback(null); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize
                            transition-colors
                            ${tab === t
                              ? 'bg-vibe-purple text-white'
                              : 'text-vibe-muted hover:text-vibe-text'
                            }`}
              >
                Por {t}
              </button>
            ))}
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder={tab === 'nome' ? 'Nome do usuário' : 'ID do usuário'}
              value={value}
              onChange={e => setValue(e.target.value)}
              autoFocus
              className="w-full bg-vibe-input border border-vibe-border rounded-xl
                         px-3 py-2.5 text-sm text-vibe-text placeholder-vibe-muted
                         focus:outline-none focus:border-vibe-purple transition-colors"
            />

            <input
              type="text"
              placeholder="Apelido (opcional)"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="w-full bg-vibe-input border border-vibe-border rounded-xl
                         px-3 py-2.5 text-sm text-vibe-text placeholder-vibe-muted
                         focus:outline-none focus:border-vibe-purple transition-colors"
            />

            {/* Feedback */}
            {feedback && (
              <p className={`text-xs text-center ${feedback.ok ? 'text-green-400' : 'text-red-400'}`}>
                {feedback.msg}
              </p>
            )}

            <button
              type="submit"
              disabled={!value.trim() || loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                         bg-gradient-vibe
                         hover:opacity-90 active:scale-95
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </form>

          {/* Divisor */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-vibe-border" />
            <span className="text-xs text-vibe-muted">ou</span>
            <div className="flex-1 h-px bg-vibe-border" />
          </div>

          {/* Meu link de convite */}
          <div className="space-y-2">
            <p className="text-xs text-vibe-muted text-center">
              Compartilhe seu link e peça para te adicionarem
            </p>
            <div className="flex items-center gap-2 bg-vibe-panel
                            border border-vibe-border rounded-xl px-3 py-2">
              <p className="flex-1 text-xs text-vibe-muted truncate">
                {myLink}
              </p>
              <button
                onClick={copyLink}
                className="text-vibe-purple hover:opacity-80 transition-opacity flex-shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M16 1H4C3 1 2 2 2 3v14h2V3h12V1zm3 4H8C7 5 6 6 6 7v14c0 1 1 2 2 2h11c1 0 2-1 2-2V7c0-1-1-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
