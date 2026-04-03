'use strict';
const WebSocket = require('ws');
const db = require('../db/db_index');
const { socketMap, deliver, deliverToConversation } = require('../middleware/socketMap');

const e = (ws, msg) => ws.send(JSON.stringify({ event: 'error', message: msg }));

module.exports = {

  async auth({ ws, payload }) {
    const { userId, name, avatarUrl } = payload;
    if (!userId?.trim() || !name?.trim()) return e(ws, 'userId e name são obrigatórios');

    const exists = await db.users.exists(userId.trim());
    if (!exists) {
      await db.users.create(userId.trim(), name.trim(), { avatarUrl });
    }

    socketMap.set(userId, ws);
    ws._userId = userId;
    await db.users.setStatus(userId, 'online');

    const [user, conversations, contacts] = await Promise.all([
      db.users.findById(userId),
      db.conversations.listForUser(userId),
      db.contacts.list(userId),
    ]);

    // Carrega participantes e usuários de todas as conversas de uma vez
    const participantsMap = {};
    const usersMap        = {};
    for (const conv of conversations) {
      const memberIds = await db.participants.list(conv.id);
      const members   = await Promise.all(memberIds.map(u => db.users.findById(u)));
      participantsMap[conv.id] = members.filter(Boolean);
      members.forEach(u => { if (u) usersMap[u.id] = u; });
    }

    ws.send(JSON.stringify({
      event: 'authenticated',
      user, conversations, contacts,
      participantsMap,
      usersMap,
    }));

    const pending = await db.offlineQueue.flush(userId);
    if (pending.length > 0)
      ws.send(JSON.stringify({ event: 'offline_queue', count: pending.length, messages: pending }));

    for (const contact of contacts)
      deliver(contact.id, 'presence', { userId, name, status: 'online' });

    console.log(`[AUTH] ${name} (${userId}) online`);
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
    console.log(`[CONTACT] ${userId} removeu ${contactId}`);
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
      console.log(`[CONV] nova conversa direta: ${userId} ↔ ${targetUserId}`);
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
    const anyOnline = others.some(u => socketMap.get(u)?.readyState === WebSocket.OPEN);

    if (anyOnline) {
      await db.messages.updateStatus(msg.id, 'delivered');
      msg.status = 'delivered';
    }

    // Entrega a mensagem e junto verifica se o destinatário tem o remetente nos contatos
    // Se não tiver, sugere adicionar
    for (const otherId of others) {
      const hasContact = await db.contacts.exists(otherId, userId);
      const sender     = await db.users.findById(userId);

      deliver(otherId, 'new_message', { message: msg });

      if (!hasContact && sender) {
        deliver(otherId, 'contact_suggestion', {
          user: sender,
          conversationId,
          message: `${sender.name} te mandou uma mensagem. Deseja adicionar aos contatos?`,
        });
      }
    }

    ws.send(JSON.stringify({ event: 'message_sent', message: msg }));
    console.log(`[MSG] ${conversationId} ← ${userId}: "${content.slice(0, 40)}"`);
  },

  async delete_message({ ws, userId, payload }) {
    const { messageId, forEveryone = false } = payload;
    if (!messageId) return e(ws, 'messageId é obrigatório');

    const msg = await db.messages.findById(messageId);
    if (!msg) return e(ws, 'Mensagem não encontrada');

    if (forEveryone) {
      if (msg.sender_id !== userId) return e(ws, 'Você só pode apagar suas próprias mensagens para todos');
      await db.messages.deleteForAll(messageId);
      await deliverToConversation(msg.conversation_id, 'message_deleted', {
        messageId, conversationId: msg.conversation_id, forEveryone: true,
      }, null);
      console.log(`[DELETE] msg ${messageId} apagada para todos por ${userId}`);
    } else {
      await db.messages.deleteForUser(messageId, userId);
      ws.send(JSON.stringify({
        event: 'message_deleted', messageId,
        conversationId: msg.conversation_id, forEveryone: false,
      }));
      console.log(`[DELETE] msg ${messageId} apagada para ${userId}`);
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
      console.log(`[DELETE] conversa ${conversationId} apagada para todos por ${userId}`);
    } else {
      await db.conversations.hideForUser(conversationId, userId);
      ws.send(JSON.stringify({ event: 'conversation_deleted', conversationId, forEveryone: false }));
      console.log(`[DELETE] conversa ${conversationId} escondida para ${userId}`);
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

    console.log(`[GROUP] "${name}" criado por ${userId}`);
  },

  async message_read({ ws, userId, payload }) {
    const { conversationId } = payload;
    if (!await db.participants.isMember(conversationId, userId)) return;
    await db.messages.markConversationRead(conversationId, userId);
    await deliverToConversation(conversationId, 'messages_read',
      { conversationId, byUserId: userId }, userId);
  },

  async typing({ ws, userId, payload }) {
    const { conversationId, isTyping } = payload;
    if (!await db.participants.isMember(conversationId, userId)) return;
    await deliverToConversation(conversationId, 'typing',
      { conversationId, userId, isTyping: !!isTyping }, userId);
  },

  async get_history({ ws, userId, payload }) {
    const { conversationId, limit = 50 } = payload;
    if (!await db.participants.isMember(conversationId, userId)) return e(ws, 'Acesso negado');
    const messages = await db.messages.history(conversationId, Math.min(limit, 200), userId);
    ws.send(JSON.stringify({ event: 'history', conversationId, messages }));
  },

  ping({ ws }) { ws.send(JSON.stringify({ event: 'pong', ts: Date.now() })); },
};
