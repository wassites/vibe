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

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

module.exports = {

  async auth({ ws, payload }) {
    const { userId, name, avatarUrl } = payload;
    if (!userId?.trim() || !name?.trim()) return e(ws, 'userId e name são obrigatórios');

    const exists = await db.users.exists(userId.trim());
    if (!exists) await db.users.create(userId.trim(), name.trim(), { avatarUrl });

    const sessionCount = countSockets(userId);

    addSocket(userId, ws);
    ws._userId    = userId;
    ws._sessionId = `${userId}_${Date.now()}`;
    await db.users.setStatus(userId, 'online');

    const [user, conversations, contacts] = await Promise.all([
      db.users.findById(userId),
      db.conversations.listForUser(userId),
      db.contacts.list(userId),
    ]);

    const participantsMap = {};
    const usersMap        = {};
    for (const conv of conversations) {
      const memberIds = await db.participants.list(conv.id);
      const members   = await Promise.all(memberIds.map(u => db.users.findById(u)));
      participantsMap[conv.id] = members.filter(Boolean);
      members.forEach(u => { if (u) usersMap[u.id] = u; });
    }

    if (sessionCount > 0) {
      ws.send(JSON.stringify({
        event: 'duplicate_session',
        user, conversations, contacts,
        participantsMap, usersMap,
        sessionId: ws._sessionId,
      }));

      const sockets = socketMap.get(userId) ?? new Set();
      for (const other of sockets) {
        if (other !== ws && other?.readyState === WebSocket.OPEN) {
          other.send(JSON.stringify({ event: 'new_session_detected', sessionId: ws._sessionId }));
        }
      }

      console.log(`[AUTH] ${name} (${userId}) abriu nova sessão (total: ${sessionCount + 1})`);
    } else {
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

  async sync_authorize({ ws, userId, payload }) {
    const { targetSessionId } = payload;
    if (!targetSessionId) return e(ws, 'targetSessionId obrigatório');

    const code      = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    syncCodes.set(code, { fromWs: ws, userId, targetSessionId, code, expiresAt });
    setTimeout(() => syncCodes.delete(code), 5 * 60 * 1000);

    ws.send(JSON.stringify({ event: 'sync_code_generated', code, expiresIn: 300 }));
    console.log(`[SYNC] código gerado para ${userId}: ${code}`);
  },

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

    if (entry.fromWs?.readyState === WebSocket.OPEN) {
      entry.fromWs.send(JSON.stringify({ event: 'sync_send_keys', targetSessionId: entry.targetSessionId }));
    }

    ws.send(JSON.stringify({ event: 'sync_result', ok: true }));
    console.log(`[SYNC] sincronização autorizada para ${userId}`);
  },

  async sync_transfer({ ws, userId, payload }) {
    const { targetSessionId, privateKey, conversationHistory } = payload;

    const sockets = socketMap.get(userId) ?? new Set();
    for (const targetWs of sockets) {
      if (targetWs._sessionId === targetSessionId && targetWs?.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({ event: 'sync_data', privateKey, conversationHistory }));
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

    const myOtherSockets = socketMap.get(userId) ?? new Set();
    for (const other of myOtherSockets) {
      if (other !== ws && other?.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({ event: 'message_sent', message: msg }));
      }
    }

    ws.send(JSON.stringify({ event: 'message_sent', message: msg }));
  },

  // ── NOVO: editar mensagem ─────────────────────────────────────────────────

  async edit_message({ ws, userId, payload }) {
    const { messageId, newContent } = payload;

    // Validações básicas
    if (!messageId)          return e(ws, 'messageId é obrigatório');
    if (!newContent?.trim()) return e(ws, 'Conteúdo não pode ser vazio');

    // Busca mensagem e valida ownership
    const msg = await db.messages.findById(messageId);
    if (!msg)                     return e(ws, 'Mensagem não encontrada');
    if (msg.sender_id !== userId) return e(ws, 'Só pode editar suas próprias mensagens');
    if (msg.type !== 'text')      return e(ws, 'Só é possível editar mensagens de texto');

    // Verifica janela de 15 minutos no servidor (segunda verificação — cliente já checou)
    const elapsed = Date.now() - new Date(msg.created_at).getTime();
    if (elapsed > EDIT_WINDOW_MS) return e(ws, 'Tempo de edição expirou (máx. 15 minutos)');

    // Salva no banco — edit() guarda conteúdo anterior no edit_history
    const updated = await db.messages.edit(messageId, newContent.trim());

    // Notifica todos os participantes da conversa em tempo real
    const memberIds = await db.participants.list(msg.conversation_id);
    for (const uid of memberIds) {
      deliver(uid, 'message_edited', {
        messageId,
        conversationId: msg.conversation_id,
        newContent:     updated.content,
        editHistory:    updated.edit_history ?? [],
        editedAt:       updated.edited_at,
      });
    }

    console.log(`[EDIT] ${userId} editou mensagem ${messageId}`);
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

  // ── Chamadas de áudio e vídeo (WebRTC Signaling) ──────────────────────────

  async call_offer({ ws, userId, payload }) {
    const { to, conversationId, callType, sdp } = payload;
    if (!to)  return e(ws, 'call_offer: campo "to" obrigatório');
    if (!sdp) return e(ws, 'call_offer: campo "sdp" obrigatório');

    const peerOnline = (socketMap.get(to)?.size ?? 0) > 0;

    if (!peerOnline) {
      ws.send(JSON.stringify({ event: 'call_unavailable', message: 'Usuário indisponível no momento' }));
      console.log(`[CALL] call_offer de ${userId} → ${to} (offline)`);
      return;
    }

    const caller = await db.users.findById(userId);

    deliver(to, 'call_offer', {
      from:           userId,
      fromUser:       caller ? { name: caller.name, avatar_url: caller.avatar_url } : null,
      conversationId,
      callType,
      sdp,
    });

    console.log(`[CALL] call_offer: ${userId} → ${to} (${callType})`);
  },

  async call_answer({ ws, userId, payload }) {
    const { to, sdp } = payload;
    if (!to)  return e(ws, 'call_answer: campo "to" obrigatório');
    if (!sdp) return e(ws, 'call_answer: campo "sdp" obrigatório');

    deliver(to, 'call_answer', { from: userId, sdp });
    console.log(`[CALL] call_answer: ${userId} → ${to}`);
  },

  async call_ice({ ws, userId, payload }) {
    const { to, candidate } = payload;
    if (!to)        return e(ws, 'call_ice: campo "to" obrigatório');
    if (!candidate) return e(ws, 'call_ice: campo "candidate" obrigatório');
    deliver(to, 'call_ice', { from: userId, candidate });
  },

  async call_reject({ ws, userId, payload }) {
    const { to } = payload;
    if (!to) return e(ws, 'call_reject: campo "to" obrigatório');
    deliver(to, 'call_reject', { from: userId });
    console.log(`[CALL] call_reject: ${userId} → ${to}`);
  },

  async call_end({ ws, userId, payload }) {
    const { to } = payload;
    if (!to) return e(ws, 'call_end: campo "to" obrigatório');
    deliver(to, 'call_end', { from: userId });
    console.log(`[CALL] call_end: ${userId} → ${to}`);
  },

  async call_busy({ ws, userId, payload }) {
    const { to } = payload;
    if (!to) return e(ws, 'call_busy: campo "to" obrigatório');
    deliver(to, 'call_busy', { from: userId });
    console.log(`[CALL] call_busy: ${userId} → ${to}`);
  },

};
