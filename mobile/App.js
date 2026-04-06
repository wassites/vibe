// mobile/App.js

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { getToken, getUser } from './src/lib/storage';
import { ChatProvider, useChat } from './src/context/ChatContext';
import Navigation   from './src/navigation';
import IncomingCall from './src/components/IncomingCall';
import CallModal    from './src/components/CallModal';

// ── Componente interno ────────────────────────────────────────────────────────
// Separado do App pois useChat() só funciona dentro do ChatProvider

function AppContent() {
  const { actions } = useChat();
  const [loading,    setLoading]    = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token  = await getToken();
      const user   = await getUser();
      const logged = !!(token && user);
      setIsLoggedIn(logged);

      // Se já tem sessão salva, conecta o WebSocket automaticamente
      if (logged) {
        actions.connect();
      }
    } catch {
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }

  // Splash enquanto verifica token
  if (loading) {
    return (
      <View style={{
        flex: 1, backgroundColor: '#0d0d14',
        justifyContent: 'center', alignItems: 'center',
      }}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <>
      {/* Navegação principal */}
      <Navigation
        isLoggedIn={isLoggedIn}
        onLogin={() => setIsLoggedIn(true)}
      />

      {/* Chamada recebida — flutua sobre tudo */}
      <IncomingCall />

      {/* Tela da chamada ativa — flutua sobre tudo */}
      <CallModal />
    </>
  );
}

// ── App raiz ──────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ChatProvider>
      <AppContent />
    </ChatProvider>
  );
}
