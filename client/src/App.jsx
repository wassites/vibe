import React from 'react';
import { ChatProvider, useChat } from './context/ChatContext';
import { useTheme } from './hooks/useTheme';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';

function Layout() {
  useTheme(); // aplica o tema salvo ao carregar
  const { state } = useChat();

  if (!state.me) return <LoginScreen />;

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <ChatWindow />
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
