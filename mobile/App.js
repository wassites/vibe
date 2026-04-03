import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { getToken, getUser } from './src/lib/storage';
import { ChatProvider } from './src/context/ChatContext';
import Navigation from './src/navigation';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      // Verificar se já tem token salvo no SecureStore
      const token = await getToken();
      const user  = await getUser();
      setIsLoggedIn(!!(token && user));
    } catch {
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }

  // Tela de splash enquanto verifica o token
  if (loading) {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <ChatProvider>
      <StatusBar style="light" />
      <Navigation isLoggedIn={isLoggedIn} />
    </ChatProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex:            1,
    backgroundColor: '#0d0d14',
    justifyContent:  'center',
    alignItems:      'center',
  },
});
