import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar,
} from 'react-native';
import { post } from '../lib/api';
import { saveToken } from '../lib/storage';

const CODE_LENGTH = 6;

export default function VerifyScreen({ navigation, route }) {
  const { phone } = route.params ?? {};

  const [code, setCode]       = useState(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const inputs = useRef([]);

  // Countdown para reenvio
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function handleInput(text, index) {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next  = [...code];
    next[index] = digit;
    setCode(next);
    setError(null);

    // Avançar para o próximo input
    if (digit && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }

    // Se preencheu todos, confirmar automaticamente
    if (digit && index === CODE_LENGTH - 1) {
      const full = [...next.slice(0, CODE_LENGTH - 1), digit].join('');
      if (full.length === CODE_LENGTH) handleVerify(full);
    }
  }

  function handleKeyPress(key, index) {
    // Backspace volta para o input anterior
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(codeStr) {
    const fullCode = codeStr ?? code.join('');
    if (fullCode.length < CODE_LENGTH) {
      setError('Digite o código completo');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await post('/auth/phone/verify', {
        phone,
        code: fullCode,
      });

      if (res.ok) {
        if (res.token) await saveToken(res.token);

        if (res.isNewUser) {
          // Primeiro acesso → completar perfil
          navigation.navigate('Profile', { phone, token: res.token });
        } else {
          // Já tem perfil → ir direto para o app
          navigation.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          });
        }
      } else {
        setError(res.error ?? 'Código inválido');
        setCode(Array(CODE_LENGTH).fill(''));
        inputs.current[0]?.focus();
      }
    } catch (err) {
      setError('Servidor fora do ar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setResending(true);
    setError(null);
    try {
      await post('/auth/phone/send', { phone });
      setCountdown(30);
      setCode(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } catch {
      setError('Erro ao reenviar. Tente novamente.');
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0d0d14" />

      {/* Voltar */}
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>

      <View style={styles.content}>

        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>Código enviado</Text>
        <Text style={styles.subtitle}>
          Digite o código de 6 dígitos enviado para{'\n'}
          <Text style={styles.phone}>{phone}</Text>
        </Text>

        {/* 6 inputs do código */}
        <View style={styles.codeRow}>
          {Array(CODE_LENGTH).fill(0).map((_, i) => (
            <TextInput
              key={i}
              ref={ref => inputs.current[i] = ref}
              style={[
                styles.codeInput,
                code[i] ? styles.codeInputFilled : null,
                error    ? styles.codeInputError  : null,
              ]}
              value={code[i]}
              onChangeText={t => handleInput(t, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              autoFocus={i === 0}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Erro */}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Botão confirmar */}
        <TouchableOpacity
          style={[styles.btn, (code.join('').length < CODE_LENGTH || loading) && styles.btnDisabled]}
          onPress={() => handleVerify()}
          disabled={code.join('').length < CODE_LENGTH || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Confirmar</Text>
          }
        </TouchableOpacity>

        {/* Reenviar */}
        <TouchableOpacity
          style={styles.resendBtn}
          onPress={handleResend}
          disabled={countdown > 0 || resending}
        >
          <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
            {resending
              ? 'Reenviando...'
              : countdown > 0
                ? `Reenviar código em ${countdown}s`
                : 'Reenviar código'
            }
          </Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0d0d14' },
  back:            { marginTop: 56, marginLeft: 20 },
  backText:        { color: '#a855f7', fontSize: 15 },
  content:         { flex: 1, paddingHorizontal: 28, paddingTop: 32,
                     alignItems: 'center' },
  icon:            { fontSize: 52, marginBottom: 16 },
  title:           { fontSize: 26, fontWeight: '800', color: '#e2e8f0',
                     marginBottom: 10 },
  subtitle:        { fontSize: 14, color: '#64748b', textAlign: 'center',
                     lineHeight: 22, marginBottom: 36 },
  phone:           { color: '#a855f7', fontWeight: '700' },
  codeRow:         { flexDirection: 'row', gap: 10, marginBottom: 16 },
  codeInput:       { width: 46, height: 56, borderRadius: 12,
                     backgroundColor: '#1a1a2e', borderWidth: 1.5,
                     borderColor: '#2a2a45', color: '#e2e8f0',
                     fontSize: 22, fontWeight: '700' },
  codeInputFilled: { borderColor: '#a855f7', backgroundColor: '#1e1030' },
  codeInputError:  { borderColor: '#f87171' },
  error:           { color: '#f87171', fontSize: 13, marginBottom: 16 },
  btn:             { backgroundColor: '#7c3aed', borderRadius: 14,
                     paddingVertical: 16, alignItems: 'center',
                     width: '100%', marginTop: 8 },
  btnDisabled:     { opacity: 0.4 },
  btnText:         { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendBtn:       { marginTop: 20, padding: 8 },
  resendText:      { color: '#a855f7', fontSize: 14 },
  resendDisabled:  { color: '#64748b' },
});
