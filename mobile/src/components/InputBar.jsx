// mobile/src/components/InputBar.jsx
//
// Barra de entrada de mensagens para React Native
// Funcionalidades:
//   • Digitar e enviar texto
//   • Gravar e enviar áudio com expo-av
//   • Enviar arquivos/imagens com expo-image-picker
//   • Indicador de digitação

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  Animated, Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useChat } from '../context/ChatContext';
import { BASE_URL } from '../lib/api';
import { getToken } from '../lib/storage';

export default function InputBar({ conversationId }) {
  const { actions, state } = useChat();
  const { participants, me } = state;

  const [text,       setText]       = useState('');
  const [uploading,  setUploading]  = useState(false);
  const [recording,  setRecording]  = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);

  const typingRef    = useRef(false);
  const timerRef     = useRef(null);
  const recordingRef = useRef(null);   // Audio.Recording
  const recTimerRef  = useRef(null);
  const pulseAnim    = useRef(new Animated.Value(1)).current;

  // Animação de pulso no botão de gravação
  useEffect(() => {
    if (recording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [recording]);

  // ── Digitação ──────────────────────────────────────────────────────────────

  function handleChangeText(val) {
    setText(val);
    if (!typingRef.current) {
      typingRef.current = true;
      actions.setTyping(conversationId, true);
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      typingRef.current = false;
      actions.setTyping(conversationId, false);
    }, 2000);
  }

  // ── Enviar texto ───────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const content = text.trim();
    if (!content) return;
    setText('');
    clearTimeout(timerRef.current);
    typingRef.current = false;
    actions.setTyping(conversationId, false);
    actions.sendMessage(conversationId, content);
  }, [text, conversationId, actions]);

  // ── Upload de arquivo ──────────────────────────────────────────────────────

  async function handlePickFile() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos acessar sua galeria para enviar imagens.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    await uploadFile(asset.uri, asset.mimeType ?? 'image/jpeg');
  }

  async function uploadFile(uri, mimeType) {
    setUploading(true);
    try {
      const token    = await getToken();
      const filename = uri.split('/').pop();
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: mimeType });

      const res  = await fetch(`${BASE_URL}/api/upload`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      const data = await res.json();

      if (!data.ok) {
        Alert.alert('Erro', data.error ?? 'Erro ao enviar arquivo');
        return;
      }

      // Detecta tipo pelo mimetype
      const type = mimeType.startsWith('image/') ? 'image'
                 : mimeType.startsWith('audio/') ? 'audio'
                 : mimeType.startsWith('video/') ? 'video'
                 : 'image';

      actions.sendMessage(conversationId, data.url, type);
    } catch {
      Alert.alert('Erro', 'Falha ao enviar arquivo. Verifique sua conexão.');
    } finally {
      setUploading(false);
    }
  }

  // ── Gravação de áudio ──────────────────────────────────────────────────────

  async function startRecording() {
    try {
      // Pede permissão de microfone
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos do microfone para gravar áudio.');
        return;
      }

      // Configura o áudio para gravação
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:           true,
        playsInSilentModeIOS:         true,
        staysActiveInBackground:      false,
        shouldDuckAndroid:            true,
        playThroughEarpieceAndroid:   false,
      });

      // Inicia gravação com qualidade alta
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setRecording(true);
      setRecordSecs(0);

      // Contador de segundos
      recTimerRef.current = setInterval(() => {
        setRecordSecs(s => s + 1);
      }, 1000);

    } catch (err) {
      console.error('[Audio] startRecording:', err);
      Alert.alert('Erro', 'Não foi possível iniciar a gravação.');
    }
  }

  async function stopRecording() {
    clearInterval(recTimerRef.current);
    setRecording(false);
    setRecordSecs(0);

    try {
      const rec = recordingRef.current;
      if (!rec) return;

      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;

      if (uri) {
        await uploadAudio(uri);
      }
    } catch (err) {
      console.error('[Audio] stopRecording:', err);
    }
  }

  function cancelRecording() {
    clearInterval(recTimerRef.current);
    setRecording(false);
    setRecordSecs(0);

    try {
      recordingRef.current?.stopAndUnloadAsync();
    } catch {}
    recordingRef.current = null;
  }

  async function uploadAudio(uri) {
    setUploading(true);
    try {
      const token    = await getToken();
      const filename = `audio_${Date.now()}.m4a`;
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: 'audio/m4a' });

      const res  = await fetch(`${BASE_URL}/api/upload`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      const data = await res.json();

      if (!data.ok) {
        Alert.alert('Erro', data.error ?? 'Erro ao enviar áudio');
        return;
      }

      actions.sendMessage(conversationId, data.url, 'audio');
    } catch {
      Alert.alert('Erro', 'Falha ao enviar áudio. Verifique sua conexão.');
    } finally {
      setUploading(false);
    }
  }

  // ── Formata tempo de gravação ──────────────────────────────────────────────

  function formatSecs(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  // ── Render — modo gravação ─────────────────────────────────────────────────

  if (recording) {
    return (
      <View style={s.container}>
        <View style={s.recordingRow}>

          {/* Cancelar */}
          <TouchableOpacity onPress={cancelRecording} style={s.cancelBtn}>
            <Text style={s.cancelIcon}>✕</Text>
          </TouchableOpacity>

          {/* Indicador + tempo */}
          <View style={s.recordingInfo}>
            <Animated.View style={[s.recDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={s.recTime}>{formatSecs(recordSecs)}</Text>
            <Text style={s.recLabel}>Gravando...</Text>
          </View>

          {/* Enviar */}
          <TouchableOpacity
            onPress={stopRecording}
            style={s.sendBtn}
            activeOpacity={0.8}
          >
            {uploading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.sendIcon}>➤</Text>
            }
          </TouchableOpacity>

        </View>
      </View>
    );
  }

  // ── Render — modo normal ───────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <View style={s.row}>

        {/* Botão anexo */}
        <TouchableOpacity
          style={s.iconBtn}
          onPress={handlePickFile}
          disabled={uploading}
          activeOpacity={0.7}
        >
          {uploading
            ? <ActivityIndicator color="#a855f7" size="small" />
            : <Text style={s.iconText}>📎</Text>
          }
        </TouchableOpacity>

        {/* Campo de texto */}
        <TextInput
          style={s.input}
          value={text}
          onChangeText={handleChangeText}
          placeholder="Digite uma mensagem..."
          placeholderTextColor="#64748b"
          multiline
          returnKeyType="default"
          maxLength={4000}
        />

        {/* Botão enviar ou microfone */}
        {text.trim() ? (
          <TouchableOpacity
            style={s.sendBtn}
            onPress={handleSend}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Text style={s.sendIcon}>➤</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.micBtn}
            onPress={startRecording}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Text style={s.micIcon}>🎤</Text>
          </TouchableOpacity>
        )}

      </View>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    backgroundColor: '#13131e',
    borderTopWidth:  1,
    borderTopColor:  '#2a2a45',
    paddingHorizontal: 12,
    paddingVertical:   8,
  },

  // Modo normal
  row: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    gap:            8,
  },

  iconBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: '#1f1f32',
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconText: { fontSize: 18 },

  input: {
    flex:              1,
    backgroundColor:   '#1f1f32',
    borderRadius:      20,
    paddingHorizontal: 16,
    paddingVertical:   10,
    color:             '#e2e8f0',
    fontSize:          15,
    maxHeight:         120,
    borderWidth:       1,
    borderColor:       '#2a2a45',
  },

  sendBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: '#a855f7',
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendIcon: { color: '#fff', fontSize: 18 },

  micBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: '#a855f7',
    alignItems:      'center',
    justifyContent:  'center',
  },
  micIcon: { fontSize: 20 },

  // Modo gravação
  recordingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    backgroundColor: '#1a0a0a',
    borderRadius:   16,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderWidth:    1,
    borderColor:    '#7f1d1d',
  },

  cancelBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: '#2a2a45',
    alignItems:      'center',
    justifyContent:  'center',
  },
  cancelIcon: { color: '#e2e8f0', fontSize: 14 },

  recordingInfo: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
  },
  recDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: '#ef4444',
  },
  recTime: {
    color:               '#ef4444',
    fontSize:            15,
    fontWeight:          '700',
    fontVariantNumeric:  'tabular-nums',
  },
  recLabel: {
    color:    '#64748b',
    fontSize: 12,
  },
});
