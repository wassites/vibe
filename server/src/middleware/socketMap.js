'use strict';
const WebSocket = require('ws');
const db        = require('../db/db_index');

const socketMap = new Map();

function socketSend(userId, event, data) {
  const ws = socketMap.get(userId);
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

module.exports = { socketMap, socketSend, deliver, deliverToConversation, broadcast };
