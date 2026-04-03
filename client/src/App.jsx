// client/src/App.jsx

import React, { useEffect, useRef } from 'react';
import { ChatProvider, useChat } from './context/ChatContext';
import { useCrypto } from './hooks/useCrypto';
import { useTheme } from './hooks/useTheme';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import DuplicateSession from './components/DuplicateSession';
import SyncRequest from './components/SyncRequest';
import IncomingCall from './components/IncomingCall';
import CallModal from './components/CallModal';

function Layout() {
  useTheme();
  const { state, actions } = useChat();
  const { initKeys, hasPrivateKey, recoverKeys } = useCrypto();

  const { me, duplicateSession, syncRequest, syncCode, call } = state;

  const onCodeReadyRef = useRef(null);

  // Inicializa chaves ao autenticar
  useEffect(() => {
    if (!me?.id) return;
    async function setup() {
      if (!hasPrivateKey(me.id)) {
        const recovered = await recoverKeys(me.id);
        if (!recovered) await initKeys(me.id);
      }
    }
    setup();
  }, [me?.id]);

  // Quando syncCode chegar no state, chama o callback registrado pela aba A
  useEffect(() => {
    if (syncCode && onCodeReadyRef.current) {
      onCodeReadyRef.current(syncCode);
      onCodeReadyRef.current = null;
    }
  }, [syncCode]);

  function handleAuthorize(onCodeReady) {
    onCodeReadyRef.current = onCodeReady;
    actions.syncAuthorize(syncRequest.sessionId);
  }

  function handleSync(code) {
    actions.syncConfirm(code);
  }

  if (!me) return <LoginScreen />;

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">

      {/* ── Layout principal ─────────────────────────────────────────────── */}
      <Sidebar />
      <ChatWindow />

      {/* ── Modais de sessão/sync ────────────────────────────────────────── */}

      {/* Aba B — sessão duplicada, aguardando autorização */}
      {duplicateSession && !syncRequest && (
        <DuplicateSession
          sessionId={duplicateSession.sessionId}
          onSync={handleSync}
          onContinueAlone={actions.dismissSync}
        />
      )}

      {/* Aba A — nova sessão detectada */}
      {syncRequest && (
        <SyncRequest
          onAuthorize={handleAuthorize}
          onDeny={actions.dismissSync}
        />
      )}

      {/* ── Chamadas — flutuam sobre tudo ────────────────────────────────── */}

      {/* Banner de chamada recebida (status === 'ringing') */}
      <IncomingCall />

      {/* Tela da chamada ativa (status === 'calling' | 'connected') */}
      {['calling', 'connected'].includes(call.status) && <CallModal />}

    </div>
  );
}

export default function App() {
  return (
    <ChatProvider>
      <Layout />
    </ChatProvider>
  );
}
