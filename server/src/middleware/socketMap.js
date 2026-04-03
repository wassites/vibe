'use strict';
const WebSocket = require('ws');
const db        = require('../db/db_index');

// Mapa de userId → Set de WebSockets (múltiplas abas/dispositivos)
const socketMap = new Map(); // userId → Set<ws>

// Códigos de sincronização temporários: sessionCode → { fromWs, userId, code, expiresAt }
const syncCodes = new Map();

function getSockets(userId) {
  return socketMap.get(userId) ?? new Set();
}

function addSocket(userId, ws) {
  if (!socketMap.has(userId)) socketMap.set(userId, new Set());
  socketMap.get(userId).add(ws);
}

function removeSocket(userId, ws) {
  const sockets = socketMap.get(userId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) socketMap.delete(userId);
}

function countSockets(userId) {
  return socketMap.get(userId)?.size ?? 0;
}

// Entrega evento para TODAS as sessões de um usuário
function socketSend(userId, event, data) {
  const sockets = getSockets(userId);
  let sent = false;
  for (const ws of sockets) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, ...data }));
      sent = true;
    }
  }
  return sent;
}

// Entrega para uma sessão específica
function socketSendTo(ws, event, data) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, ...data }));
    return true;
  }
  return false;
}

async function deliver(userId, event, data) {
  if (!socketSend(userId, event, data)) {
    await db.offlineQueue.enqueue(userId, event, data);
  }
}

async function deliverToConversation(convId, event, data, exclude = null) {
  const members = await db.participants.list(convId);
  for (const uid of members) {
    if (uid !== exclude) await deliver(uid, event, data);
  }
}

function broadcast(event, data, exclude = null) {
  for (const [uid] of socketMap) {
    if (uid !== exclude) socketSend(uid, event, data);
  }
}

module.exports = {
  socketMap,
  syncCodes,
  getSockets,
  addSocket,
  removeSocket,
  countSockets,
  socketSend,
  socketSendTo,
  deliver,
  deliverToConversation,
  broadcast,
};
