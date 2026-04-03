import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { getToken, getUser } from './src/lib/storage';
import { ChatProvider } from './src/context/ChatContext';
import Navigation from './src/navigation';

export default function App() {
  const [loading, setLoading]     = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await getToken();
      const user  = await getUser();
      setIsLoggedIn(!!(token && user));
    } catch {
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }

  // Splash enquanto verifica o token salvo
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d0d14',
                     justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <ChatProvider>
      <Navigation isLoggedIn={isLoggedIn} />
    </ChatProvider>
  );
}
