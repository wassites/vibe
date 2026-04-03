import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';

const API = `http://${window.location.hostname}:3001`;

export default function LoginScreen() {
  const { actions } = useChat();

  const [tab,      setTab]      = useState('login');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
      const body     = tab === 'login'
        ? { email, password }
        : { name, email, password };

      const res  = await fetch(API + endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      localStorage.setItem('vibe_token', data.token);
      actions.auth(data.user.id, data.user.name, data.user.avatar_url);

    } catch {
      setError('Erro de conexão com o servidor');
      setLoading(false);
    }
  }

  const isValid = tab === 'login'
    ? email.trim() && password.trim()
    : name.trim() && email.trim() && password.length >= 6;

  const inputClass = `w-full bg-white border border-gray-300 rounded-xl
                      px-4 py-3 text-gray-900 placeholder-gray-400 text-sm
                      focus:outline-none focus:border-green-500
                      disabled:opacity-50 transition-colors`;

  return (
    <div className="flex h-screen w-screen items-center justify-center"
         style={{ background: 'var(--bg, #f0f2f5)' }}>

      <div className="relative z-10 w-full max-w-sm px-6">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">⚡</div>
          <h1 className="text-4xl font-bold" style={{ color: 'var(--accent, #25d366)' }}>
            Vibe
          </h1>
          <p className="text-gray-500 mt-2 text-sm">Mensageiro em tempo real</p>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 shadow-sm">
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{
                background: tab === t ? 'var(--accent, #25d366)' : 'transparent',
                color:      tab === t ? '#ffffff' : '#6b7280',
              }}
            >
              {t === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          ))}
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-3">

          {tab === 'register' && (
            <input
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={32}
              autoFocus
              disabled={loading}
              className={inputClass}
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus={tab === 'login'}
            disabled={loading}
            autoComplete="email"
            className={inputClass}
          />

          <input
            type="password"
            placeholder={tab === 'register' ? 'Senha (mín. 6 caracteres)' : 'Senha'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            className={inputClass}
          />

          {error && (
            <p className="text-red-500 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white
                       hover:opacity-90 active:scale-95
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-150"
            style={{ background: 'var(--accent, #25d366)' }}
          >
            {loading
              ? (tab === 'login' ? 'Entrando...' : 'Cadastrando...')
              : (tab === 'login' ? 'Entrar'      : 'Criar conta')
            }
          </button>
        </form>

      </div>
    </div>
  );
}
