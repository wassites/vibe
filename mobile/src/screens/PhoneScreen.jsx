import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar,
} from 'react-native';
import { post } from '../lib/api';

// DDIs mais comuns — pode expandir
const COUNTRIES = [
  { code: '+55', flag: '🇧🇷', name: 'Brasil' },
  { code: '+1',  flag: '🇺🇸', name: 'EUA' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+244', flag: '🇦🇴', name: 'Angola' },
];

export default function PhoneScreen({ navigation }) {
  const [ddi, setDdi]         = useState('+55');
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [showDdi, setShowDdi] = useState(false);

  // Formata enquanto digita: (11) 91234-5678
  function formatPhone(text) {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 2)  return `(${digits}`;
    if (digits.length <= 7)  return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7,11)}`;
  }

  async function handleSend() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Digite um número válido');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const fullPhone = ddi + digits;
      const res = await post('/auth/phone/send', { phone: fullPhone });

      if (res.ok) {
        navigation.navigate('Verify', { phone: fullPhone });
      } else {
        setError(res.error ?? 'Erro ao enviar código');
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

      {/* Botão voltar */}
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>

      <View style={styles.content}>

        {/* Ícone e título */}
        <Text style={styles.icon}>📱</Text>
        <Text style={styles.title}>Seu número</Text>
        <Text style={styles.subtitle}>
          Vamos enviar um código para confirmar seu telefone
        </Text>

        {/* Seletor de DDI + input */}
        <View style={styles.inputRow}>

          {/* DDI */}
          <TouchableOpacity
            style={styles.ddiBtn}
            onPress={() => setShowDdi(!showDdi)}
          >
            <Text style={styles.ddiText}>
              {COUNTRIES.find(c => c.code === ddi)?.flag} {ddi}
            </Text>
          </TouchableOpacity>

          {/* Número */}
          <TextInput
            style={styles.input}
            placeholder="(11) 91234-5678"
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={t => setPhone(formatPhone(t))}
            maxLength={15}
            autoFocus
          />
        </View>

        {/* Dropdown de DDI */}
        {showDdi && (
          <View style={styles.dropdown}>
            {COUNTRIES.map(c => (
              <TouchableOpacity
                key={c.code}
                style={styles.dropdownItem}
                onPress={() => { setDdi(c.code); setShowDdi(false); }}
              >
                <Text style={styles.dropdownText}>
                  {c.flag} {c.name} ({c.code})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Erro */}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Botão enviar */}
        <TouchableOpacity
          style={[styles.btn, (!phone.trim() || loading) && styles.btnDisabled]}
          onPress={handleSend}
          disabled={!phone.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Enviar código</Text>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>
          Ao continuar, você concorda com nossos Termos de Uso.
        </Text>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0d0d14' },
  back:         { marginTop: 56, marginLeft: 20 },
  backText:     { color: '#a855f7', fontSize: 15 },
  content:      { flex: 1, paddingHorizontal: 28, paddingTop: 40 },
  icon:         { fontSize: 52, textAlign: 'center', marginBottom: 16 },
  title:        { fontSize: 26, fontWeight: '800', color: '#e2e8f0',
                  textAlign: 'center', marginBottom: 8 },
  subtitle:     { fontSize: 14, color: '#64748b', textAlign: 'center',
                  marginBottom: 36, lineHeight: 22 },
  inputRow:     { flexDirection: 'row', gap: 10, marginBottom: 8 },
  ddiBtn:       { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a45',
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
                  justifyContent: 'center' },
  ddiText:      { color: '#e2e8f0', fontSize: 15 },
  input:        { flex: 1, backgroundColor: '#1a1a2e', borderWidth: 1,
                  borderColor: '#2a2a45', borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 14,
                  color: '#e2e8f0', fontSize: 16 },
  dropdown:     { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a45',
                  borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a45' },
  dropdownText: { color: '#e2e8f0', fontSize: 14 },
  error:        { color: '#f87171', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btn:          { backgroundColor: '#7c3aed', borderRadius: 14,
                  paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled:  { opacity: 0.4 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint:         { color: '#64748b', fontSize: 12, textAlign: 'center',
                  marginTop: 20, lineHeight: 18 },
});
