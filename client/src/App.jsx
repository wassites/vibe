import React, { useEffect, useRef } from 'react';
import { ChatProvider, useChat } from './context/ChatContext';
import { useCrypto } from './hooks/useCrypto';
import { useTheme } from './hooks/useTheme';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import DuplicateSession from './components/DuplicateSession';
import SyncRequest from './components/SyncRequest';

function Layout() {
  useTheme();
  const { state, actions } = useChat();
  const { initKeys, hasPrivateKey, recoverKeys } = useCrypto();

  const { me, duplicateSession, syncRequest, syncCode } = state;

  // Callback para quando o código for gerado — guardado em ref para não criar closure stale
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

  // Aba A — usuário clicou em Autorizar
  function handleAuthorize(onCodeReady) {
    onCodeReadyRef.current = onCodeReady;
    actions.syncAuthorize(syncRequest.sessionId);
  }

  // Aba B — usuário digitou o código
  function handleSync(code) {
    actions.syncConfirm(code);
  }

  if (!me) return <LoginScreen />;

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      <Sidebar />
      <ChatWindow />

      {/* Modal na aba B — sessão duplicada, aguardando autorização */}
      {duplicateSession && !syncRequest && (
        <DuplicateSession
          sessionId={duplicateSession.sessionId}
          onSync={handleSync}
          onContinueAlone={actions.dismissSync}
        />
      )}

      {/* Modal na aba A — nova sessão detectada */}
      {syncRequest && (
        <SyncRequest
          onAuthorize={handleAuthorize}
          onDeny={actions.dismissSync}
        />
      )}
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
