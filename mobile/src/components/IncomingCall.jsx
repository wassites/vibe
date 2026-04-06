// mobile/src/components/IncomingCall.jsx
//
// Banner de chamada recebida para React Native
// Aparece quando state.call.status === 'ringing'
// Usa Animated para animações nativas sem useNativeDriver issues

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Vibration, Modal,
} from 'react-native';
import { useChat } from '../context/ChatContext';
import { useWebRTC } from '../hooks/useWebRTC';

// ── Avatar com inicial ────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl, size = 80 }) {
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

// ── Componente principal ──────────────────────────────────────────────────────

export default function IncomingCall() {
  const { state }                  = useChat();
  const { answerCall, rejectCall } = useWebRTC();
  const { call }                   = state;

  const isRinging = call.status === 'ringing';
  const isVideo   = call.type   === 'video';

  // Animações
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const ring1     = useRef(new Animated.Value(1)).current;
  const ring2     = useRef(new Animated.Value(1)).current;
  const ring3     = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRinging) {
      // Entrada com fade + scale
      Animated.parallel([
        Animated.spring(fadeAnim,  { toValue: 1, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50 }),
      ]).start();

      // Anéis pulsantes
      function ringPulse(anim, delay) {
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1.8, duration: 1200, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1.0, duration: 0,    useNativeDriver: true }),
          ])
        ).start();
      }
      ringPulse(ring1, 0);
      ringPulse(ring2, 400);
      ringPulse(ring3, 800);

      // Vibração padrão de chamada
      Vibration.vibrate([0, 1000, 500, 1000, 500, 1000], true);

    } else {
      // Saída
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      ]).start();

      Vibration.cancel();
      ring1.setValue(1);
      ring2.setValue(1);
      ring3.setValue(1);
    }
  }, [isRinging]);

  if (!isRinging) return null;

  const bgColor = isVideo ? '#1a1a2e' : '#0d1f0d';
  const accent  = isVideo ? '#3182ce' : '#38a169';

  return (
    <Modal
      transparent
      animationType="none"
      visible={isRinging}
      statusBarTranslucent
    >
      {/* Overlay */}
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>

        {/* Card */}
        <Animated.View style={[
          s.card,
          { backgroundColor: bgColor, transform: [{ scale: scaleAnim }] }
        ]}>

          {/* Badge de tipo */}
          <View style={[s.badge, { borderColor: accent }]}>
            <Text style={[s.badgeText, { color: accent }]}>
              {isVideo ? '📹 Chamada de vídeo' : '📞 Chamada de áudio'}
            </Text>
          </View>

          {/* Avatar com anéis */}
          <View style={s.avatarArea}>
            {[ring1, ring2, ring3].map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  s.ring,
                  {
                    borderColor: accent + (i === 0 ? '60' : i === 1 ? '40' : '20'),
                    transform:   [{ scale: anim }],
                    position:    'absolute',
                    width:  100 + i * 20,
                    height: 100 + i * 20,
                    borderRadius: (100 + i * 20) / 2,
                  }
                ]}
              />
            ))}
            <Avatar name={call.peerName} size={80} />
          </View>

          {/* Nome */}
          <Text style={s.peerName}>{call.peerName ?? 'Desconhecido'}</Text>
          <Text style={s.callingText}>Chamando...</Text>

          {/* Botões */}
          <View style={s.buttons}>

            {/* Recusar */}
            <View style={s.btnWrapper}>
              <TouchableOpacity
                style={[s.btn, s.btnReject]}
                onPress={rejectCall}
                activeOpacity={0.8}
              >
                <Text style={s.btnIcon}>📵</Text>
              </TouchableOpacity>
              <Text style={s.btnLabel}>Recusar</Text>
            </View>

            {/* Atender */}
            <View style={s.btnWrapper}>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: accent }]}
                onPress={answerCall}
                activeOpacity={0.8}
              >
                <Text style={s.btnIcon}>
                  {isVideo ? '📹' : '📞'}
                </Text>
              </TouchableOpacity>
              <Text style={s.btnLabel}>Atender</Text>
            </View>

          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
  },

  card: {
    width:         320,
    borderRadius:  28,
    padding:       28,
    alignItems:    'center',
    gap:           12,
    shadowColor:   '#000',
    shadowOpacity: 0.5,
    shadowRadius:  30,
    elevation:     20,
  },

  badge: {
    borderWidth:   1,
    borderRadius:  20,
    paddingHorizontal: 14,
    paddingVertical:    5,
  },
  badgeText: {
    fontSize:   13,
    fontWeight: '600',
  },

  avatarArea: {
    width:          120,
    height:         120,
    alignItems:     'center',
    justifyContent: 'center',
    marginVertical: 12,
  },

  ring: {
    borderWidth: 1.5,
  },

  peerName: {
    color:       '#fff',
    fontSize:    24,
    fontWeight:  '700',
    letterSpacing: -0.5,
  },

  callingText: {
    color:    'rgba(255,255,255,0.5)',
    fontSize: 14,
  },

  buttons: {
    flexDirection:  'row',
    gap:            56,
    marginTop:      20,
    alignItems:     'center',
    justifyContent: 'center',
  },

  btnWrapper: {
    alignItems: 'center',
    gap:        8,
  },

  btn: {
    width:          64,
    height:         64,
    borderRadius:   32,
    alignItems:     'center',
    justifyContent: 'center',
    shadowOpacity:  0.4,
    shadowRadius:   12,
    elevation:      8,
  },

  btnReject: {
    backgroundColor: '#ef4444',
    shadowColor:     '#ef4444',
  },

  btnIcon:  { fontSize: 26 },

  btnLabel: {
    color:    'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
});
