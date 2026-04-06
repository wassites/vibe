// mobile/src/components/CallModal.jsx
//
// Tela fullscreen da chamada ativa para React Native
// Aparece quando state.call.status === 'calling' | 'connected'
// Usa RTCView do react-native-webrtc para exibir os vídeos

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Platform,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { useChat }   from '../context/ChatContext';
import { useWebRTC } from '../hooks/useWebRTC';

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 100 }) {
  const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#DDA0DD'];
  const color  = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>
        {(name ?? '?')[0].toUpperCase()}
      </Text>
    </View>
  );
}

// ── Timer da chamada ──────────────────────────────────────────────────────────

function CallTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const h   = Math.floor(elapsed / 3600);
  const m   = Math.floor((elapsed % 3600) / 60);
  const sec = elapsed % 60;
  const pad = n => String(n).padStart(2, '0');

  return (
    <Text style={s.timer}>
      {h > 0 ? `${pad(h)}:` : ''}{pad(m)}:{pad(sec)}
    </Text>
  );
}

// ── Botão de controle ─────────────────────────────────────────────────────────

function CtrlBtn({ onPress, icon, label, active = true, danger = false, large = false }) {
  const size = large ? 68 : 54;
  const bg   = danger ? '#ef4444'
             : active ? 'rgba(255,255,255,0.18)'
             :           'rgba(255,255,255,0.08)';

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[s.ctrlBtn, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}
      >
        <Text style={{ fontSize: large ? 28 : 22 }}>{icon}</Text>
      </TouchableOpacity>
      {label && <Text style={s.ctrlLabel}>{label}</Text>}
    </View>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CallModal() {
  const { state }  = useChat();
  const {
    localStream,
    remoteStream,
    hangup,
    toggleMute,
    toggleCamera,
    switchCamera,
    callStatus,
    callType,
    isMuted,
    isCameraOff,
    peerName,
    startedAt,
  } = useWebRTC();

  const { call } = state;
  const isActive    = ['calling', 'connected'].includes(call.status);
  const isVideo     = call.type === 'video';
  const isConnected = call.status === 'connected';

  // Controla visibilidade dos controles (auto-hide em vídeo)
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef(null);
  const fadeCtrl  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isVideo || !isConnected) {
      setShowControls(true);
      return;
    }
    scheduleHide();
  }, [isVideo, isConnected]);

  function scheduleHide() {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(fadeCtrl, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      setShowControls(false);
    }, 4000);
  }

  function revealControls() {
    clearTimeout(hideTimer.current);
    Animated.timing(fadeCtrl, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setShowControls(true);
    if (isVideo && isConnected) scheduleHide();
  }

  if (!isActive) return null;

  // ── Layout vídeo ─────────────────────────────────────────────────────────

  if (isVideo) {
    return (
      <View style={s.container} onTouchStart={revealControls}>
        <StatusBar hidden />

        {/* Vídeo remoto — fullscreen */}
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={s.remoteVideo}
            objectFit="cover"
            mirror={false}
          />
        ) : (
          // Fallback quando stream remoto ainda não chegou
          <View style={s.videoFallback}>
            <Avatar name={peerName} size={100} />
            <Text style={s.fallbackName}>{peerName}</Text>
            <Text style={s.fallbackStatus}>
              {isConnected ? 'Conectando vídeo...' : 'Chamando...'}
            </Text>
          </View>
        )}

        {/* Vídeo local — PiP no canto */}
        {localStream && (
          <View style={s.localVideoWrapper}>
            <RTCView
              streamURL={localStream.toURL()}
              style={s.localVideo}
              objectFit="cover"
              mirror={true}
            />
          </View>
        )}

        {/* Header com nome + timer */}
        <Animated.View style={[s.videoHeader, { opacity: fadeCtrl }]}>
          <Text style={s.videoPeerName}>{peerName}</Text>
          {isConnected
            ? <CallTimer startedAt={startedAt} />
            : <Text style={s.timer}>Chamando...</Text>
          }
        </Animated.View>

        {/* Controles */}
        <Animated.View style={[s.videoControls, { opacity: fadeCtrl }]}>
          <CtrlBtn
            icon={isMuted ? '🔇' : '🎤'}
            label={isMuted ? 'Ativar mic' : 'Mudo'}
            active={!isMuted}
            onPress={toggleMute}
          />
          <CtrlBtn
            icon={isCameraOff ? '📷' : '📹'}
            label={isCameraOff ? 'Ligar cam' : 'Câmera'}
            active={!isCameraOff}
            onPress={toggleCamera}
          />
          <CtrlBtn
            icon="📵"
            label="Encerrar"
            danger
            large
            onPress={hangup}
          />
          <CtrlBtn
            icon="🔄"
            label="Virar cam"
            onPress={switchCamera}
          />
          <CtrlBtn
            icon="🔊"
            label="Alto-fal"
            onPress={() => {}}
          />
        </Animated.View>

      </View>
    );
  }

  // ── Layout áudio ──────────────────────────────────────────────────────────

  return (
    <View style={[s.container, s.audioContainer]}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1f0d" />

      {/* Círculos decorativos pulsantes */}
      {[180, 260, 340].map((size, i) => (
        <View
          key={i}
          style={[s.audioRing, {
            width: size, height: size, borderRadius: size / 2,
            opacity: 0.06 - i * 0.015,
          }]}
        />
      ))}

      {/* Área superior */}
      <View style={s.audioTop}>
        <Text style={s.audioStatus}>
          {isConnected ? 'Em chamada' : 'Chamando...'}
        </Text>

        {/* Avatar */}
        <View style={s.audioAvatarWrapper}>
          {isConnected && (
            <View style={[s.audioAvatarGlow, { borderColor: '#38a169' }]} />
          )}
          <Avatar name={peerName} size={100} />
        </View>

        <Text style={s.audioPeerName}>{peerName}</Text>

        {isConnected
          ? <CallTimer startedAt={startedAt} />
          : <Text style={[s.timer, { opacity: 0.5 }]}>Aguardando resposta...</Text>
        }
      </View>

      {/* Controles secundários */}
      <View style={s.audioSecondary}>
        <CtrlBtn
          icon={isMuted ? '🔇' : '🎤'}
          label={isMuted ? 'Ativar mic' : 'Mudo'}
          active={!isMuted}
          onPress={toggleMute}
        />
        <CtrlBtn
          icon="🔊"
          label="Alto-fal"
          onPress={() => {}}
        />
      </View>

      {/* Botão encerrar */}
      <View style={s.audioHangup}>
        <CtrlBtn
          icon="📵"
          label="Encerrar chamada"
          danger
          large
          onPress={hangup}
        />
      </View>

    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex:         9999,
    backgroundColor: '#000',
  },

  // ── Vídeo ──────────────────────────────────────────────────────────────────

  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },

  videoFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             16,
  },
  fallbackName:   { color: '#fff', fontSize: 22, fontWeight: '700' },
  fallbackStatus: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },

  localVideoWrapper: {
    position:     'absolute',
    top:          60,
    right:        16,
    width:        100,
    height:       140,
    borderRadius: 14,
    overflow:     'hidden',
    borderWidth:  2,
    borderColor:  'rgba(255,255,255,0.2)',
    zIndex:       10,
  },
  localVideo: { width: '100%', height: '100%' },

  videoHeader: {
    position:   'absolute',
    top:        0, left: 0, right: 0,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
    background: 'transparent',
  },
  videoPeerName: { color: '#fff', fontSize: 18, fontWeight: '700' },

  videoControls: {
    position:      'absolute',
    bottom:        0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems:    'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    paddingTop:    40,
  },

  // ── Áudio ──────────────────────────────────────────────────────────────────

  audioContainer: {
    background:     'transparent',
    backgroundColor: '#0d1f0d',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingTop:     Platform.OS === 'ios' ? 80 : 60,
    paddingBottom:  Platform.OS === 'ios' ? 52 : 40,
  },

  audioRing: {
    position:        'absolute',
    top:             '30%',
    alignSelf:       'center',
    borderWidth:     1,
    borderColor:     '#38a169',
    backgroundColor: '#38a169',
    transform:       [{ translateY: -100 }],
  },

  audioTop: {
    alignItems: 'center',
    gap:        12,
  },

  audioStatus: {
    color:         '#68d391',
    fontSize:      13,
    fontWeight:    '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  audioAvatarWrapper: {
    position: 'relative',
    marginVertical: 8,
  },

  audioAvatarGlow: {
    position:     'absolute',
    inset:        -8,
    borderRadius: 60,
    borderWidth:  2,
    opacity:      0.5,
    top:          -8, left: -8, right: -8, bottom: -8,
  },

  audioPeerName: {
    color:       '#fff',
    fontSize:    28,
    fontWeight:  '700',
    letterSpacing: -0.5,
  },

  timer: {
    color:    'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontVariantNumeric: 'tabular-nums',
  },

  audioSecondary: {
    flexDirection:  'row',
    gap:            40,
    justifyContent: 'center',
  },

  audioHangup: {
    alignItems: 'center',
  },

  // ── Controles ──────────────────────────────────────────────────────────────

  ctrlBtn: {
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#000',
    shadowOpacity:  0.3,
    shadowRadius:   8,
    elevation:      4,
  },

  ctrlLabel: {
    color:    'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
  },
});
