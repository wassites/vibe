// mobile/src/screens/ContactsScreen.jsx

import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from '../context/ChatContext';

function Avatar({ name, size = 46 }) {
  const colors = ['#7c3aed','#2563eb','#059669','#dc2626','#d97706','#0891b2'];
  const color  = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, alignItems: 'center',
      justifyContent: 'center', marginRight: 12,
    }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>
        {(name ?? '?')[0].toUpperCase()}
      </Text>
    </View>
  );
}

export default function ContactsScreen({ navigation }) {
  const { state, actions } = useChat();
  const insets = useSafeAreaInsets();
  const { contacts, conversations, participants, me } = state;

  const [search,  setSearch]  = useState('');
  const [adding,  setAdding]  = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [opening, setOpening] = useState(null); // id do contato sendo aberto

  // Carrega contatos ao abrir
  useEffect(() => {
    actions.getContacts();
  }, []);

  // Quando conversation_ready chegar, navega para o chat
  // Isso é disparado quando o servidor responde ao openDirect
  useEffect(() => {
    if (!opening) return;

    // Procura a conversa direta com o contato que estamos abrindo
    const conv = conversations.find(c => {
      if (c.type !== 'direct') return false;
      const parts = participants[c.id] ?? [];
      return parts.some(p => {
        const uid = typeof p === 'string' ? p : p?.id;
        return uid === opening;
      });
    });

    if (conv) {
      setOpening(null);
      // Navega para o chat com os dados corretos
      navigation.navigate('Home', {
        screen: 'HomeScreen',
      });
      // Pequeno delay para garantir que a navegação aconteceu
      setTimeout(() => {
        const contact = contacts.find(c => c.id === opening);
        navigation.navigate('Home', {
          screen: 'Chat',
          params: {
            conversationId: conv.id,
            title:          contact?.name ?? 'Conversa',
            peerId:         opening,
          },
        });
      }, 100);
    }
  }, [conversations, opening]);

  // Filtra contatos pelo search
  const filtered = contacts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Abre conversa direta — envia evento e espera conversation_ready
  function openChat(contact) {
    setOpening(contact.id);
    actions.openDirect(contact.id);
  }

  // Adiciona contato por nome
  async function handleAddContact() {
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      actions.addContactByName(name);
      // Aguarda um momento para o servidor responder
      setTimeout(() => {
        actions.getContacts();
        setNewName('');
        setAdding(false);
        setLoading(false);
      }, 1000);
    } catch {
      setError('Usuário não encontrado');
      setLoading(false);
    }
  }

  function handleRemove(contact) {
    Alert.alert(
      'Remover contato',
      `Remover ${contact.name} dos seus contatos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => actions.removeContact(contact.id),
        },
      ]
    );
  }

  function renderContact({ item }) {
    const isOnline  = item.status === 'online';
    const isOpening = opening === item.id;

    return (
      <TouchableOpacity
        style={s.item}
        onPress={() => openChat(item)}
        onLongPress={() => handleRemove(item)}
        activeOpacity={0.7}
        disabled={!!opening}
      >
        {/* Avatar com dot online */}
        <View style={{ position: 'relative' }}>
          <Avatar name={item.name} />
          {isOnline && <View style={s.onlineDot} />}
        </View>

        {/* Info */}
        <View style={s.info}>
          <Text style={s.name}>{item.name}</Text>
          <Text style={[s.status, isOnline && s.statusOnline]}>
            {isOnline ? '● online' : '○ offline'}
          </Text>
        </View>

        {/* Ícone ou loading */}
        {isOpening
          ? <ActivityIndicator color="#a855f7" size="small" />
          : <Text style={s.chatIcon}>💬</Text>
        }
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.container}>

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Contatos</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => { setAdding(v => !v); setError(null); setNewName(''); }}
          activeOpacity={0.8}
        >
          <Text style={s.addBtnText}>{adding ? '✕' : '+ Adicionar'}</Text>
        </TouchableOpacity>
      </View>

      {/* Adicionar por nome */}
      {adding && (
        <View style={s.addBox}>
          <TextInput
            style={s.addInput}
            placeholder="Nome do usuário..."
            placeholderTextColor="#64748b"
            value={newName}
            onChangeText={t => { setNewName(t); setError(null); }}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAddContact}
            editable={!loading}
          />
          <TouchableOpacity
            style={[s.addConfirm, (!newName.trim() || loading) && s.addConfirmDisabled]}
            onPress={handleAddContact}
            disabled={!newName.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.addConfirmText}>Adicionar</Text>
            }
          </TouchableOpacity>
          {error && <Text style={s.error}>{error}</Text>}
        </View>
      )}

      {/* Busca */}
      {contacts.length > 0 && (
        <View style={s.searchBox}>
          <TextInput
            style={s.searchInput}
            placeholder="Buscar contato..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>👥</Text>
          <Text style={s.emptyText}>
            {contacts.length === 0 ? 'Nenhum contato ainda' : 'Nenhum resultado'}
          </Text>
          <Text style={s.emptySub}>
            {contacts.length === 0
              ? 'Toque em "+ Adicionar" para buscar pelo nome'
              : 'Tente outro nome'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          renderItem={renderContact}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        />
      )}

    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0d0d14' },

  header:     { flexDirection: 'row', justifyContent: 'space-between',
                alignItems: 'center', paddingHorizontal: 16,
                paddingBottom: 16, borderBottomWidth: 1,
                borderBottomColor: '#2a2a45' },
  title:      { fontSize: 22, fontWeight: '800', color: '#e2e8f0' },
  addBtn:     { backgroundColor: '#4c1d95', paddingHorizontal: 14,
                paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },

  addBox:     { padding: 16, borderBottomWidth: 1,
                borderBottomColor: '#2a2a45', gap: 8 },
  addInput:   { backgroundColor: '#1a1a2e', borderWidth: 1,
                borderColor: '#2a2a45', borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 12,
                color: '#e2e8f0', fontSize: 15 },
  addConfirm: { backgroundColor: '#7c3aed', borderRadius: 12,
                paddingVertical: 12, alignItems: 'center' },
  addConfirmDisabled: { opacity: 0.4 },
  addConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error:      { color: '#f87171', fontSize: 13, textAlign: 'center' },

  searchBox:  { paddingHorizontal: 16, paddingVertical: 10,
                borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  searchInput:{ backgroundColor: '#1a1a2e', borderWidth: 1,
                borderColor: '#2a2a45', borderRadius: 10,
                paddingHorizontal: 14, paddingVertical: 10,
                color: '#e2e8f0', fontSize: 14 },

  item:       { flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  info:       { flex: 1 },
  name:       { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  status:     { color: '#64748b', fontSize: 12, marginTop: 2 },
  statusOnline: { color: '#4ade80' },
  chatIcon:   { fontSize: 20 },
  onlineDot:  { position: 'absolute', bottom: 0, right: 12,
                width: 12, height: 12, borderRadius: 6,
                backgroundColor: '#4ade80',
                borderWidth: 2, borderColor: '#0d0d14' },

  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon:  { fontSize: 48, marginBottom: 4 },
  emptyText:  { color: '#e2e8f0', fontSize: 16, fontWeight: '600' },
  emptySub:   { color: '#64748b', fontSize: 13, textAlign: 'center',
                paddingHorizontal: 40 },
});
