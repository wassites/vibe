import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { getToken } from '../lib/storage';
import { post } from '../lib/api';

export default function ContactsScreen({ navigation }) {
  const [loading, setLoading]   = useState(true);
  const [vibeContacts, setVibeContacts] = useState([]); // contatos que estão no Vibe
  const [syncing, setSyncing]   = useState(false);

  useEffect(() => {
    syncContacts();
  }, []);

  async function syncContacts() {
    try {
      setSyncing(true);

      // 1. Pedir permissão da agenda
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão negada',
          'Precisamos acessar sua agenda para encontrar seus contatos no Vibe.'
        );
        setLoading(false);
        return;
      }

      // 2. Buscar todos os contatos do celular
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      // 3. Extrair os números de telefone
      const phones = [];
      for (const contact of data) {
        if (!contact.phoneNumbers) continue;
        for (const p of contact.phoneNumbers) {
          // Normalizar: remover espaços, traços, parênteses
          const normalized = p.number.replace(/\D/g, '');
          if (normalized.length >= 8) {
            phones.push({
              phone:    normalized,
              name:     contact.name,
            });
          }
        }
      }

      // 4. Enviar para o servidor verificar quem está no Vibe
      const token = await getToken();
      const res   = await post('/api/contacts/sync', { phones }, token);

      if (res.found) {
        setVibeContacts(res.found);
      }

    } catch (err) {
      console.error('[CONTACTS]', err.message);
      Alert.alert('Erro', 'Não foi possível sincronizar os contatos.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  function renderContact({ item }) {
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate('Chat', { contact: item })}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.phone}>{item.phone}</Text>
        </View>

        {/* Status online */}
        {item.status === 'online' && (
          <View style={styles.onlineDot} />
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={styles.loadingText}>Sincronizando contatos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.title}>Contatos</Text>
        <TouchableOpacity onPress={syncContacts} disabled={syncing}>
          <Text style={styles.syncBtn}>
            {syncing ? 'Sincronizando...' : '↻ Sincronizar'}
          </Text>
        </TouchableOpacity>
      </View>

      {vibeContacts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>
            Nenhum contato seu está no Vibe ainda.
          </Text>
          <Text style={styles.emptySubtext}>
            Convide seus amigos para entrar!
          </Text>
        </View>
      ) : (
        <FlatList
          data={vibeContacts}
          keyExtractor={item => item.id}
          renderItem={renderContact}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0d0d14' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  header:       { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center', padding: 16,
                  borderBottomWidth: 1, borderBottomColor: '#2a2a45' },
  title:        { fontSize: 20, fontWeight: '700', color: '#e2e8f0' },
  syncBtn:      { fontSize: 13, color: '#a855f7' },
  loadingText:  { color: '#64748b', marginTop: 12 },
  emptyIcon:    { fontSize: 48, marginBottom: 8 },
  emptyText:    { color: '#e2e8f0', fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: '#64748b', fontSize: 13 },
  item:         { flexDirection: 'row', alignItems: 'center',
                  padding: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  avatar:       { width: 46, height: 46, borderRadius: 23,
                  backgroundColor: '#4c1d95', justifyContent: 'center',
                  alignItems: 'center', marginRight: 12 },
  avatarLetter: { color: '#fff', fontSize: 18, fontWeight: '700' },
  info:         { flex: 1 },
  name:         { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  phone:        { color: '#64748b', fontSize: 13, marginTop: 2 },
  onlineDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ade80' },
});
