'use strict';
const WebSocket = require('ws');
const db = require('../db/db_index');
const {
  socketMap, syncCodes,
  addSocket, removeSocket, countSockets,
  socketSend, socketSendTo,
  deliver, deliverToConversation,
} = require('../middleware/socketMap');

const e = (ws, msg) => ws.send(JSON.stringify({ event: 'error', message: msg }));

module.exports = {

  async auth({ ws, payload }) {
    const { userId, name, avatarUrl } = payload;
    if (!userId?.trim() || !name?.trim()) return e(ws, 'userId e name são obrigatórios');

    const exists = await db.users.exists(userId.trim());
    if (!exists) await db.users.create(userId.trim(), name.trim(), { avatarUrl });

    const sessionCount = countSockets(userId);

    // Registra o novo socket
    addSocket(userId, ws);
    ws._userId    = userId;
    ws._sessionId = `${userId}_${Date.now()}`;
    await db.users.setStatus(userId, 'online');

    const [user, conversations, contacts] = await Promise.all([
      db.users.findById(userId),
      db.conversations.listForUser(userId),
      db.contacts.list(userId),
    ]);

    // Carrega participantes de todas as conversas
    const participantsMap = {};
    const usersMap        = {};
    for (const conv of conversations) {
      const memberIds = await db.participants.list(conv.id);
      const members   = await Promise.all(memberIds.map(u => db.users.findById(u)));
      participantsMap[conv.id] = members.filter(Boolean);
      members.forEach(u => { if (u) usersMap[u.id] = u; });
    }

    if (sessionCount > 0) {
      // Já existe outra sessão ativa — notifica esta aba que há duplicata
      ws.send(JSON.stringify({
        event:        'duplicate_session',
        user,
        conversations,
        contacts,
        participantsMap,
        usersMap,
        sessionId:    ws._sessionId,
      }));

      // Notifica as outras abas que uma nova sessão tentou conectar
      const sockets = socketMap.get(userId) ?? new Set();
      for (const other of sockets) {
        if (other !== ws && other?.readyState === WebSocket.OPEN) {
          other.send(JSON.stringify({
            event:     'new_session_detected',
            sessionId: ws._sessionId,
          }));
        }
      }

      console.log(`[AUTH] ${name} (${userId}) abriu nova sessão (total: ${sessionCount + 1})`);
    } else {
      // Primeira sessão — fluxo normal
      ws.send(JSON.stringify({
        event: 'authenticated',
        user, conversations, contacts,
        participantsMap, usersMap,
      }));

      const pending = await db.offlineQueue.flush(userId);
      if (pending.length > 0)
        ws.send(JSON.stringify({ event: 'offline_queue', count: pending.length, messages: pending }));

      for (const contact of contacts)
        deliver(contact.id, 'presence', { userId, name, status: 'online' });

      console.log(`[AUTH] ${name} (${userId}) online`);
    }
  },

  // Aba A autoriza sincronização — gera código de 6 dígitos
  async sync_authorize({ ws, userId, payload }) {
    const { targetSessionId } = payload;
    if (!targetSessionId) return e(ws, 'targetSessionId obrigatório');

    const code      = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos

    syncCodes.set(code, { fromWs: ws, userId, targetSessionId, code, expiresAt });

    // Limpa código expirado automaticamente
    setTimeout(() => syncCodes.delete(code), 5 * 60 * 1000);

    // Envia código para a aba A mostrar ao usuário
    ws.send(JSON.stringify({ event: 'sync_code_generated', code, expiresIn: 300 }));
    console.log(`[SYNC] código gerado para ${userId}: ${code}`);
  },

  // Aba B envia o código recebido do usuário
  async sync_confirm({ ws, userId, payload }) {
    const { code } = payload;
    if (!code) return e(ws, 'Código obrigatório');

    const entry = syncCodes.get(code);

    if (!entry) return ws.send(JSON.stringify({ event: 'sync_result', ok: false, error: 'Código inválido ou expirado' }));
    if (Date.now() > entry.expiresAt) {
      syncCodes.delete(code);
      return ws.send(JSON.stringify({ event: 'sync_result', ok: false, error: 'Código expirado' }));
    }
    if (entry.userId !== userId) return ws.send(JSON.stringify({ event: 'sync_result', ok: false, error: 'Código não pertence a este usuário' }));

    syncCodes.delete(code);

    // Pede para aba A enviar a chave privada e histórico
    if (entry.fromWs?.readyState === WebSocket.OPEN) {
      entry.fromWs.send(JSON.stringify({
        event:           'sync_send_keys',
        targetSessionId: entry.targetSessionId,
      }));
    }

    ws.send(JSON.stringify({ event: 'sync_result', ok: true }));
    console.log(`[SYNC] sincronização autorizada para ${userId}`);
  },

  // Aba A envia chave privada + histórico para aba B
  async sync_transfer({ ws, userId, payload }) {
    const { targetSessionId, privateKey, conversationHistory } = payload;

    // Encontra o socket da aba B pelo sessionId
    const sockets = socketMap.get(userId) ?? new Set();
    for (const targetWs of sockets) {
      if (targetWs._sessionId === targetSessionId && targetWs?.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({
          event:               'sync_data',
          privateKey,
          conversationHistory,
        }));

        // Marca a aba B como autenticada
        targetWs.send(JSON.stringify({ event: 'sync_complete' }));
        console.log(`[SYNC] dados transferidos para sessão ${targetSessionId}`);
        break;
      }
    }
  },

  async add_contact({ ws, userId, payload }) {
    const { contactId, nickname = null } = payload;
    if (!contactId?.trim())                          return e(ws, 'contactId é obrigatório');
    if (contactId === userId)                        return e(ws, 'Você não pode se adicionar');
    if (!await db.users.exists(contactId))           return e(ws, 'Usuário não encontrado');
    if (await db.contacts.exists(userId, contactId)) return e(ws, 'Contato já adicionado');

    await db.contacts.add(userId, contactId, nickname);
    const contacts = await db.contacts.list(userId);
    const contact  = contacts.find(c => c.id === contactId);

    ws.send(JSON.stringify({ event: 'contact_added', contact }));
    console.log(`[CONTACT] ${userId} adicionou ${contactId}`);
  },

  async add_contact_by_name({ ws, userId, payload }) {
    const { name, nickname = null } = payload;
    if (!name?.trim()) return e(ws, 'Nome é obrigatório');

    const found = await db.users.findByName(name.trim());
    if (!found)                                     return e(ws, `Usuário "${name}" não encontrado`);
    if (found.id === userId)                        return e(ws, 'Você não pode se adicionar');
    if (await db.contacts.exists(userId, found.id)) return e(ws, 'Contato já adicionado');

    await db.contacts.add(userId, found.id, nickname);
    const contacts = await db.contacts.list(userId);
    const contact  = contacts.find(c => c.id === found.id);

    ws.send(JSON.stringify({ event: 'contact_added', contact }));
    console.log(`[CONTACT] ${userId} adicionou ${found.id} pelo nome`);
  },

  async remove_contact({ ws, userId, payload }) {
    const { contactId } = payload;
    if (!contactId) return e(ws, 'contactId é obrigatório');
    await db.contacts.remove(userId, contactId);
    ws.send(JSON.stringify({ event: 'contact_removed', contactId }));
  },

  async get_contacts({ ws, userId }) {
    const contacts = await db.contacts.list(userId);
    ws.send(JSON.stringify({ event: 'contacts', contacts }));
  },

  async open_direct({ ws, userId, payload }) {
    const { targetUserId } = payload;
    if (!await db.users.exists(targetUserId)) return e(ws, 'Usuário não encontrado');
    if (targetUserId === userId)               return e(ws, 'Não pode abrir conversa consigo mesmo');

    let conv = await db.conversations.findDirect(userId, targetUserId);
    if (!conv) {
      conv = await db.conversations.create('direct');
      await db.participants.add(conv.id, userId);
      await db.participants.add(conv.id, targetUserId);
    }

    const [history, memberIds] = await Promise.all([
      db.messages.history(conv.id, 50, userId),
      db.participants.list(conv.id),
    ]);

    const participants = await Promise.all(memberIds.map(u => db.users.findById(u)));
    ws.send(JSON.stringify({ event: 'conversation_ready', conversation: conv, history, participants }));
  },

  async send_message({ ws, userId, payload }) {
    const { conversationId, content, type = 'text' } = payload;
    if (!content?.trim())                                        return e(ws, 'Mensagem vazia');
    if (!await db.conversations.exists(conversationId))          return e(ws, 'Conversa não encontrada');
    if (!await db.participants.isMember(conversationId, userId)) return e(ws, 'Você não está nesta conversa');

    const msg = await db.messages.save(conversationId, userId, content.trim(), type);

    const memberIds = await db.participants.list(conversationId);
    const others    = memberIds.filter(u => u !== userId);
    const anyOnline = others.some(u => (socketMap.get(u)?.size ?? 0) > 0);

    if (anyOnline) {
      await db.messages.updateStatus(msg.id, 'delivered');
      msg.status = 'delivered';
    }

    for (const otherId of others) {
      const hasContact = await db.contacts.exists(otherId, userId);
      const sender     = await db.users.findById(userId);
      deliver(otherId, 'new_message', { message: msg });
      if (!hasContact && sender) {
        deliver(otherId, 'contact_suggestion', {
          user: sender, conversationId,
          message: `${sender.name} te mandou uma mensagem. Deseja adicionar aos contatos?`,
        });
      }
    }

    // Entrega para outras sessões do próprio remetente
    const myOtherSockets = socketMap.get(userId) ?? new Set();
    for (const other of myOtherSockets) {
      if (other !== ws && other?.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({ event: 'message_sent', message: msg }));
      }
    }

    ws.send(JSON.stringify({ event: 'message_sent', message: msg }));
  },

  async delete_message({ ws, userId, payload }) {
    const { messageId, forEveryone = false } = payload;
    if (!messageId) return e(ws, 'messageId é obrigatório');
    const msg = await db.messages.findById(messageId);
    if (!msg) return e(ws, 'Mensagem não encontrada');

    if (forEveryone) {
      if (msg.sender_id !== userId) return e(ws, 'Só pode apagar suas próprias mensagens para todos');
      await db.messages.deleteForAll(messageId);
      await deliverToConversation(msg.conversation_id, 'message_deleted', {
        messageId, conversationId: msg.conversation_id, forEveryone: true,
      }, null);
    } else {
      await db.messages.deleteForUser(messageId, userId);
      ws.send(JSON.stringify({ event: 'message_deleted', messageId, conversationId: msg.conversation_id, forEveryone: false }));
    }
  },

  async delete_conversation({ ws, userId, payload }) {
    const { conversationId, forEveryone = false } = payload;
    if (!conversationId) return e(ws, 'conversationId é obrigatório');
    if (!await db.participants.isMember(conversationId, userId)) return e(ws, 'Acesso negado');

    if (forEveryone) {
      const memberIds = await db.participants.list(conversationId);
      await db.conversations.deleteForAll(conversationId);
      for (const uid of memberIds)
        deliver(uid, 'conversation_deleted', { conversationId, forEveryone: true });
    } else {
      await db.conversations.hideForUser(conversationId, userId);
      ws.send(JSON.stringify({ event: 'conversation_deleted', conversationId, forEveryone: false }));
    }
  },

  async create_group({ ws, userId, payload }) {
    const { name, memberIds = [] } = payload;
    if (!name?.trim()) return e(ws, 'Nome do grupo obrigatório');

    const conv    = await db.conversations.create('group', name.trim());
    const allIds  = [...new Set([userId, ...memberIds])];
    const members = (await Promise.all(
      allIds.map(u => db.users.exists(u).then(ok => ok ? u : null))
    )).filter(Boolean);

    await Promise.all(members.map(u => db.participants.add(conv.id, u)));
    const participants = await Promise.all(members.map(u => db.users.findById(u)));

    for (const u of members)
      deliver(u, 'group_created', { conversation: conv, participants, createdBy: userId });
  },

  async message_read({ ws, userId, payload }) {
    const { conversationId } = payload;
    if (!await db.participants.isMember(conversationId, userId)) return;
    await db.messages.markConversationRead(conversationId, userId);
    await deliverToConversation(conversationId, 'messages_read', { conversationId, byUserId: userId }, userId);
  },

  async typing({ ws, userId, payload }) {
    const { conversationId, isTyping } = payload;
    if (!await db.participants.isMember(conversationId, userId)) return;
    await deliverToConversation(conversationId, 'typing', { conversationId, userId, isTyping: !!isTyping }, userId);
  },

  async get_history({ ws, userId, payload }) {
    const { conversationId, limit = 50 } = payload;
    if (!await db.participants.isMember(conversationId, userId)) return e(ws, 'Acesso negado');
    const messages = await db.messages.history(conversationId, Math.min(limit, 200), userId);
    ws.send(JSON.stringify({ event: 'history', conversationId, messages }));
  },

  ping({ ws }) { ws.send(JSON.stringify({ event: 'pong', ts: Date.now() })); },
};
