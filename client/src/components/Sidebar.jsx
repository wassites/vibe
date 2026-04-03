import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import Avatar from './Avatar';
import ConversationItem from './ConversationItem';
import AddContact from './AddContact';
import ProfileModal from './ProfileModal';
import CreateGroup from './CreateGroup';

export default function Sidebar() {
  const { state, actions } = useChat();
  const { me, conversations, contacts, activeConvId, connected, messages } = state;

  const [tab,             setTab]             = useState('conversas');
  const [showAddContact,  setShowAddContact]  = useState(false);
  const [showProfile,     setShowProfile]     = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const onlineCount = contacts.filter(c => c.status === 'online').length;

  const totalMsgs = Object.values(messages).reduce((acc, msgs) => acc + msgs.length, 0);
  useEffect(() => {
    if (totalMsgs > 0) setTab('conversas');
  }, [totalMsgs]);

  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-vibe-panel border-r border-vibe-border">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-vibe-border">
        <button onClick={() => setShowProfile(true)} className="flex-shrink-0">
          <Avatar name={me?.name} avatarUrl={me?.avatar_url} size="md" online={connected} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-vibe-text truncate">{me?.name}</p>
          <p className="text-xs text-vibe-muted">
            {connected ? 'online' : 'reconectando...'}
          </p>
        </div>
        <button
          onClick={() => setShowProfile(true)}
          title="Configurações"
          className="w-8 h-8 flex items-center justify-center rounded-lg
                     text-vibe-muted hover:text-vibe-accent hover:bg-vibe-hover
                     transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0
                     .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.02 7.02 0 0 0-1.62-.94
                     l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94
                     l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94
                     s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96
                     c.5.37 1.04.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54
                     c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61
                     l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
        </button>
      </div>

      {/* Abas */}
      <div className="flex border-b border-vibe-border">
        {['conversas', 'contatos'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors
                        ${tab === t
                          ? 'text-vibe-accent border-b-2 border-vibe-accent'
                          : 'text-vibe-muted hover:text-vibe-text'
                        }`}
          >
            {t}
            {t === 'contatos' && onlineCount > 0 && (
              <span className="ml-1.5 text-white text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--accent)' }}>
                {onlineCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto">

        {tab === 'conversas' && (
          <>
            {conversations.length === 0 ? (
              <p className="text-center text-vibe-muted text-xs mt-8 px-4">
                Nenhuma conversa ainda.<br />
                Vá em "contatos" e inicie uma!
              </p>
            ) : (
              conversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConvId}
                  onClick={() => actions.setActive(conv.id)}
                />
              ))
            )}
          </>
        )}

        {tab === 'contatos' && (
          <>
            <button
              onClick={() => setShowAddContact(true)}
              className="w-full flex items-center gap-3 px-4 py-3
                         hover:bg-vibe-hover transition-colors text-left
                         border-b border-vibe-border"
            >
              <div className="w-10 h-10 rounded-full bg-vibe-surface border border-vibe-border
                              flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-vibe-accent">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-vibe-accent">Adicionar contato</span>
            </button>

            <button
              onClick={() => setShowCreateGroup(true)}
              className="w-full flex items-center gap-3 px-4 py-3
                         hover:bg-vibe-hover transition-colors text-left
                         border-b border-vibe-border"
            >
              <div className="w-10 h-10 rounded-full bg-vibe-surface border border-vibe-border
                              flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-vibe-accent">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-vibe-accent">Criar grupo</span>
            </button>

            {contacts.length === 0 ? (
              <p className="text-center text-vibe-muted text-xs mt-8 px-4">
                Nenhum contato ainda.<br />
                Adicione alguém pelo nome ou link.
              </p>
            ) : (
              contacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => actions.openDirect(contact.id)}
                  className="w-full flex items-center gap-3 px-4 py-3
                             hover:bg-vibe-hover transition-colors text-left"
                >
                  <Avatar
                    name={contact.nickname ?? contact.name}
                    avatarUrl={contact.avatar_url}
                    size="md"
                    online={contact.status === 'online'}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-vibe-text truncate">
                      {contact.nickname ?? contact.name}
                    </p>
                    <p className={`text-xs ${contact.status === 'online' ? 'text-green-500' : 'text-vibe-muted'}`}>
                      {contact.status === 'online' ? 'online' : 'offline'}
                    </p>
                  </div>
                  <span
                    onClick={ev => { ev.stopPropagation(); actions.removeContact(contact.id); }}
                    title="Remover contato"
                    className="w-6 h-6 flex items-center justify-center rounded
                               text-vibe-muted hover:text-red-400 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/>
                    </svg>
                  </span>
                </button>
              ))
            )}
          </>
        )}
      </div>

      {showAddContact  && <AddContact   onClose={() => setShowAddContact(false)}  />}
      {showProfile     && <ProfileModal onClose={() => setShowProfile(false)}     />}
      {showCreateGroup && <CreateGroup  onClose={() => setShowCreateGroup(false)} />}
    </div>
  );
}
