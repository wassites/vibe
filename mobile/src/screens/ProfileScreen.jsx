import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar, ScrollView, Alert,
} from 'react-native';
import { post } from '../lib/api';
import { saveToken, saveUser, getToken } from '../lib/storage';

export default function ProfileScreen({ navigation, route }) {
  const { phone, token: authToken } = route.params ?? {};

  const [name, setName]     = useState('');
  const [bio, setBio]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  async function handleSave() {
    if (!name.trim()) {
      setError('O nome é obrigatório');
      return;
    }
    if (name.trim().length < 2) {
      setError('Nome muito curto (mín. 2 caracteres)');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const token = authToken ?? await getToken();

      const res = await post('/auth/profile', {
        name: name.trim(),
        bio:  bio.trim() || null,
        phone,
      }, token);

      if (res.ok) {
        // Salvar token e dados do usuário localmente
        await saveToken(res.token ?? token);
        await saveUser(res.user);

        // Ir para a tela principal
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      } else {
        setError(res.error ?? 'Erro ao salvar perfil');
      }
    } catch (err) {
      setError('Servidor fora do ar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0d0d14" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >

        {/* Avatar placeholder */}
        <TouchableOpacity style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {name ? name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarBadgeText}>📷</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.title}>Seu perfil</Text>
        <Text style={styles.subtitle}>
          Como você quer aparecer para seus contatos?
        </Text>

        {/* Nome */}
        <Text style={styles.label}>Nome *</Text>
        <TextInput
          style={styles.input}
          placeholder="Seu nome completo"
          placeholderTextColor="#64748b"
          value={name}
          onChangeText={setName}
          maxLength={32}
          autoFocus
          returnKeyType="next"
        />

        {/* Bio */}
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Uma frase sobre você... (opcional)"
          placeholderTextColor="#64748b"
          value={bio}
          onChangeText={setBio}
          maxLength={100}
          multiline
          numberOfLines={3}
          returnKeyType="done"
        />
        <Text style={styles.charCount}>{bio.length}/100</Text>

        {/* Telefone — só exibição */}
        {phone && (
          <>
            <Text style={styles.label}>Telefone</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.phoneText}>{phone}</Text>
              <Text style={styles.phoneVerified}>✓ verificado</Text>
            </View>
          </>
        )}

        {/* Erro */}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Botão salvar */}
        <TouchableOpacity
          style={[styles.btn, (!name.trim() || loading) && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Entrar no Vibe ⚡</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0d0d14' },
  scroll:          { paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  avatarWrapper:   { alignSelf: 'center', marginBottom: 28, position: 'relative' },
  avatar:          { width: 96, height: 96, borderRadius: 48,
                     backgroundColor: '#4c1d95', justifyContent: 'center',
                     alignItems: 'center', borderWidth: 3, borderColor: '#a855f7' },
  avatarText:      { color: '#fff', fontSize: 40, fontWeight: '700' },
  avatarBadge:     { position: 'absolute', bottom: 0, right: 0,
                     backgroundColor: '#1a1a2e', borderRadius: 14,
                     width: 28, height: 28, justifyContent: 'center',
                     alignItems: 'center', borderWidth: 2, borderColor: '#0d0d14' },
  avatarBadgeText: { fontSize: 14 },
  title:           { fontSize: 26, fontWeight: '800', color: '#e2e8f0',
                     textAlign: 'center', marginBottom: 8 },
  subtitle:        { fontSize: 14, color: '#64748b', textAlign: 'center',
                     marginBottom: 32, lineHeight: 22 },
  label:           { color: '#94a3b8', fontSize: 12, fontWeight: '600',
                     marginBottom: 6, marginTop: 16, textTransform: 'uppercase',
                     letterSpacing: 0.8 },
  input:           { backgroundColor: '#1a1a2e', borderWidth: 1,
                     borderColor: '#2a2a45', borderRadius: 12,
                     paddingHorizontal: 16, paddingVertical: 14,
                     color: '#e2e8f0', fontSize: 15 },
  inputMulti:      { height: 90, textAlignVertical: 'top', paddingTop: 12 },
  charCount:       { color: '#64748b', fontSize: 11, textAlign: 'right',
                     marginTop: 4 },
  phoneRow:        { flexDirection: 'row', justifyContent: 'space-between',
                     alignItems: 'center', backgroundColor: '#1a1a2e',
                     borderWidth: 1, borderColor: '#2a2a45', borderRadius: 12,
                     paddingHorizontal: 16, paddingVertical: 14 },
  phoneText:       { color: '#e2e8f0', fontSize: 15 },
  phoneVerified:   { color: '#4ade80', fontSize: 12, fontWeight: '600' },
  error:           { color: '#f87171', fontSize: 13, marginTop: 12,
                     textAlign: 'center' },
  btn:             { backgroundColor: '#7c3aed', borderRadius: 14,
                     paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  btnDisabled:     { opacity: 0.4 },
  btnText:         { color: '#fff', fontSize: 16, fontWeight: '700' },
});
