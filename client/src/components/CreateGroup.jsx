import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import Avatar from './Avatar';

export default function CreateGroup({ onClose }) {
  const { state, actions } = useChat();
  const { contacts } = state;

  const [name,     setName]     = useState('');
  const [selected, setSelected] = useState(new Set());
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  function toggleContact(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleCreate() {
    if (!name.trim())        return setError('Digite um nome para o grupo');
    if (selected.size === 0) return setError('Selecione ao menos um contato');

    setLoading(true);
    actions.createGroup(name.trim(), [...selected]);

    // Servidor responde com group_created — fecha após 1s
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 1000);
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
          <h2 className="text-sm font-semibold text-gray-800">Novo grupo</h2>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg
                       text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/>
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">

          {/* Nome do grupo */}
          <input
            type="text"
            placeholder="Nome do grupo"
            value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            maxLength={40}
            autoFocus
            disabled={loading}
            className="w-full bg-white border border-gray-300 rounded-xl
                       px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:border-green-500
                       disabled:opacity-50 transition-colors"
          />

          {/* Lista de contatos */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Adicionar participantes ({selected.size} selecionado{selected.size !== 1 ? 's' : ''})
            </p>

            {contacts.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Você não tem contatos ainda.
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {contacts.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => toggleContact(contact.id)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl
                               hover:bg-gray-50 transition-colors text-left"
                  >
                    <Avatar name={contact.nickname ?? contact.name} size="sm"
                            online={contact.status === 'online'} />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">
                        {contact.nickname ?? contact.name}
                      </p>
                      <p className={`text-xs ${contact.status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>
                        {contact.status === 'online' ? 'online' : 'offline'}
                      </p>
                    </div>

                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                                     transition-colors
                                     ${selected.has(contact.id)
                                       ? 'border-green-500 bg-green-500'
                                       : 'border-gray-300 bg-white'}`}>
                      {selected.has(contact.id) && (
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                          <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={!name.trim() || selected.size === 0 || loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                       bg-green-500 hover:bg-green-600 active:scale-95
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-150"
          >
            {loading ? 'Criando...' : `Criar grupo${selected.size > 0 ? ` (${selected.size + 1})` : ''}`}
          </button>

        </div>
      </div>
    </div>
  );
}
