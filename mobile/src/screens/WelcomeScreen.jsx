// mobile/src/screens/WelcomeScreen.jsx
// Botões apontam para Login em vez de Phone

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated,
} from 'react-native';

export default function WelcomeScreen({ navigation }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d14" />

      <View style={styles.glowPurple} />
      <View style={styles.glowAmber} />

      <Animated.View style={[
        styles.content,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}>
        <View style={styles.logoWrapper}>
          <Text style={styles.logoIcon}>⚡</Text>
        </View>
        <Text style={styles.logoText}>Vibe</Text>
        <Text style={styles.tagline}>Mensageiro em tempo real</Text>

        <View style={styles.features}>
          {[
            { icon: '🔒', text: 'Mensagens seguras' },
            { icon: '💬', text: 'Chat em tempo real' },
            { icon: '⚡', text: 'Entrega instantânea' },
          ].map((f, i) => (
            <View key={i} style={styles.featureItem}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View style={[styles.buttons, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>✉️  Entrar com email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryText}>Criar nova conta</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0d0d14' },
  glowPurple:      { position: 'absolute', width: 300, height: 300,
                     borderRadius: 150, backgroundColor: '#a855f7',
                     opacity: 0.08, top: 80, alignSelf: 'center' },
  glowAmber:       { position: 'absolute', width: 200, height: 200,
                     borderRadius: 100, backgroundColor: '#f59e0b',
                     opacity: 0.07, top: 200, right: 20 },
  content:         { flex: 1, alignItems: 'center', justifyContent: 'center',
                     paddingHorizontal: 32 },
  logoWrapper:     { width: 96, height: 96, borderRadius: 28,
                     backgroundColor: '#1a1a2e', borderWidth: 2,
                     borderColor: '#2a2a45', justifyContent: 'center',
                     alignItems: 'center', marginBottom: 16 },
  logoIcon:        { fontSize: 48 },
  logoText:        { fontSize: 42, fontWeight: '800', color: '#e2e8f0',
                     letterSpacing: -1, marginBottom: 6 },
  tagline:         { fontSize: 15, color: '#64748b', marginBottom: 48 },
  features:        { gap: 14, alignSelf: 'stretch' },
  featureItem:     { flexDirection: 'row', alignItems: 'center', gap: 14,
                     backgroundColor: '#13131e', borderWidth: 1,
                     borderColor: '#2a2a45', borderRadius: 14,
                     paddingHorizontal: 18, paddingVertical: 14 },
  featureIcon:     { fontSize: 22 },
  featureText:     { color: '#e2e8f0', fontSize: 14, fontWeight: '500' },
  buttons:         { paddingHorizontal: 28, paddingBottom: 48, gap: 12 },
  btnPrimary:      { backgroundColor: '#7c3aed', borderRadius: 16,
                     paddingVertical: 17, alignItems: 'center' },
  btnPrimaryText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary:    { backgroundColor: 'transparent', borderRadius: 16,
                     borderWidth: 1.5, borderColor: '#2a2a45',
                     paddingVertical: 15, alignItems: 'center' },
  btnSecondaryText:{ color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
