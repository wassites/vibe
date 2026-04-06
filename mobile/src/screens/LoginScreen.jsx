// mobile/src/screens/LoginScreen.jsx

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { post } from '../lib/api';
import { saveToken, saveUser } from '../lib/storage';
import { useChat } from '../context/ChatContext';

export default function LoginScreen({ onLogin }) {
  const { actions, state } = useChat();
  const insets             = useSafeAreaInsets();

  const [tab,      setTab]      = useState('login');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  // Quando state.me for preenchido pelo WebSocket → navega
  useEffect(() => {
    if (state.me && loading) {
      setLoading(false);
      onLogin?.();
    }
  }, [state.me]);

  const isValid = tab === 'login'
    ? email.trim() && password.trim()
    : name.trim() && email.trim() && password.length >= 6;

  async function handleSubmit() {
    if (!isValid || loading) return;
    setError(null);
    setLoading(true);

    try {
      const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
      const body     = tab === 'login'
        ? { email: email.trim(), password }
        : { name: name.trim(), email: email.trim(), password };

      const data = await post(endpoint, body);

      if (!data.ok) {
        setError(data.error ?? 'Erro ao autenticar');
        setLoading(false);
        return;
      }

      await saveToken(data.token);
      await saveUser(data.user);

      // Conecta WS — useEffect acima dispara onLogin quando state.me chegar
      actions.connect();

    } catch {
      setError('Erro de conexão com o servidor');
      setLoading(false);
    }
  }

  function switchTab(t) {
    setTab(t);
    setError(null);
    setName('');
    setEmail('');
    setPassword('');
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.logoArea}>
          <Text style={s.logoIcon}>⚡</Text>
          <Text style={s.logoTitle}>Vibe</Text>
          <Text style={s.logoSub}>Mensageiro em tempo real</Text>
        </View>

        <View style={s.tabs}>
          {['login', 'register'].map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => switchTab(t)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'login' ? 'Entrar' : 'Cadastrar'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.form}>

          {tab === 'register' && (
            <TextInput
              style={s.input}
              placeholder="Seu nome"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
              maxLength={32}
              autoCapitalize="words"
              editable={!loading}
              returnKeyType="next"
            />
          )}

          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            returnKeyType="next"
          />

          <TextInput
            style={s.input}
            placeholder={tab === 'register' ? 'Senha (mín. 6 caracteres)' : 'Senha'}
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {error && <Text style={s.error}>{error}</Text>}

          {loading && (
            <Text style={s.connecting}>
              {state.connected ? 'Autenticando...' : 'Conectando ao servidor...'}
            </Text>
          )}

          <TouchableOpacity
            style={[s.btn, (!isValid || loading) && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnText}>
                  {tab === 'login' ? 'Entrar' : 'Criar conta'}
                </Text>
            }
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f0f2f5' },
  scroll:       { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24 },

  logoArea:     { alignItems: 'center', marginBottom: 36 },
  logoIcon:     { fontSize: 64, marginBottom: 8 },
  logoTitle:    { fontSize: 36, fontWeight: '800', color: '#25d366' },
  logoSub:      { fontSize: 14, color: '#6b7280', marginTop: 4 },

  tabs:         { flexDirection: 'row', backgroundColor: '#fff',
                  borderRadius: 14, padding: 4, width: '100%',
                  marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb',
                  elevation: 2 },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive:    { backgroundColor: '#25d366' },
  tabText:      { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive:{ color: '#fff' },

  form:         { width: '100%', gap: 12 },
  input:        { width: '100%', backgroundColor: '#fff', borderWidth: 1,
                  borderColor: '#d1d5db', borderRadius: 14,
                  paddingHorizontal: 16, paddingVertical: 14,
                  fontSize: 15, color: '#111827' },

  error:        { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  connecting:   { color: '#6b7280', fontSize: 12, textAlign: 'center' },

  btn:          { width: '100%', backgroundColor: '#25d366', borderRadius: 14,
                  paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled:  { opacity: 0.45 },
  btnText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
});
