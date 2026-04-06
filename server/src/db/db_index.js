'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host:     process.env.DB_HOST,
      port:     process.env.DB_PORT,
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASS,
    });

pool.on('error', (err) => {
  console.error('[DB] erro inesperado:', err.message);
});

const query = (sql, params) => pool.query(sql, params);

async function createSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      email               TEXT UNIQUE,
      password_hash       TEXT,
      avatar_url          TEXT,
      bio                 TEXT,
      phone               TEXT UNIQUE,
      provider            TEXT NOT NULL DEFAULT 'local',
      provider_id         TEXT,
      status              TEXT NOT NULL DEFAULT 'offline',
      last_seen           TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      public_key          TEXT,
      private_key_escrow  TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nickname   TEXT,
      added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (owner_id, contact_id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL CHECK(type IN ('direct','group')),
      name       TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS participants (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id         TEXT NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
      joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id       TEXT NOT NULL REFERENCES users(id),
      content         TEXT NOT NULL,
      type            TEXT NOT NULL DEFAULT 'text',
      status          TEXT NOT NULL DEFAULT 'sent'
                           CHECK(status IN ('sent','delivered','read')),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS offline_queue (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS message_deletes (
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (message_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS conversation_hides (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id         TEXT NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
      hidden_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (conversation_id, user_id)
    );

    -- Colunas de criptografia (safe em bancos antigos)
    ALTER TABLE users    ADD COLUMN IF NOT EXISTS public_key         TEXT;
    ALTER TABLE users    ADD COLUMN IF NOT EXISTS private_key_escrow TEXT;

    -- Colunas de edição de mensagens (safe em bancos antigos)
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at    TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]';

    CREATE INDEX IF NOT EXISTS idx_messages_conv     ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_queue_user        ON offline_queue(user_id);
    CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_owner    ON contacts(owner_id);
    CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_phone       ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_provider    ON users(provider, provider_id);
    CREATE INDEX IF NOT EXISTS idx_msg_deletes_user  ON message_deletes(user_id);
    CREATE INDEX IF NOT EXISTS idx_conv_hides_user   ON conversation_hides(user_id);
  `);
  console.log('[DB] schema ok');
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const db = {

  users: {
    async create(id, name, {
      email = null, passwordHash = null, avatarUrl = null,
      bio = null, phone = null, provider = 'local', providerId = null,
    } = {}) {
      const res = await query(`
        INSERT INTO users
          (id, name, email, password_hash, avatar_url, bio, phone, provider, provider_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
      `, [id, name, email, passwordHash, avatarUrl, bio, phone, provider, providerId]);
      return res.rows[0];
    },

    async findById(id) {
      const res = await query('SELECT * FROM users WHERE id = $1', [id]);
      return res.rows[0] ?? null;
    },

    async findByEmail(email) {
      const res = await query('SELECT * FROM users WHERE email = $1', [email]);
      return res.rows[0] ?? null;
    },

    async findByName(name) {
      const res = await query('SELECT * FROM users WHERE LOWER(name) = LOWER($1)', [name]);
      return res.rows[0] ?? null;
    },

    async findByPhone(phone) {
      const res = await query('SELECT * FROM users WHERE phone = $1', [phone]);
      return res.rows[0] ?? null;
    },

    async findByProvider(provider, providerId) {
      const res = await query(
        'SELECT * FROM users WHERE provider = $1 AND provider_id = $2',
        [provider, providerId]
      );
      return res.rows[0] ?? null;
    },

    async setStatus(id, status) {
      await query(
        'UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2',
        [status, id]
      );
    },

    async updateProfile(id, { name, avatarUrl, bio, phone }) {
      const res = await query(`
        UPDATE users SET
          name       = COALESCE($2, name),
          avatar_url = COALESCE($3, avatar_url),
          bio        = COALESCE($4, bio),
          phone      = COALESCE($5, phone)
        WHERE id = $1
        RETURNING *
      `, [id, name, avatarUrl, bio, phone]);
      return res.rows[0] ?? null;
    },

    async saveKeys(userId, publicKey, privateKeyEscrow) {
      await query(
        'UPDATE users SET public_key = $2, private_key_escrow = $3 WHERE id = $1',
        [userId, publicKey, privateKeyEscrow]
      );
    },

    async getPublicKey(userId) {
      const res = await query('SELECT public_key FROM users WHERE id = $1', [userId]);
      return res.rows[0]?.public_key ?? null;
    },

    async getEscrow(userId) {
      const res = await query('SELECT private_key_escrow FROM users WHERE id = $1', [userId]);
      return res.rows[0]?.private_key_escrow ?? null;
    },

    async list() {
      const res = await query('SELECT * FROM users ORDER BY name');
      return res.rows;
    },

    async exists(id) {
      const res = await query('SELECT 1 FROM users WHERE id = $1', [id]);
      return res.rowCount > 0;
    },
  },

  contacts: {
    async add(ownerId, contactId, nickname = null) {
      await query(`
        INSERT INTO contacts (owner_id, contact_id, nickname)
        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
      `, [ownerId, contactId, nickname]);
    },

    async remove(ownerId, contactId) {
      await query(
        'DELETE FROM contacts WHERE owner_id = $1 AND contact_id = $2',
        [ownerId, contactId]
      );
    },

    async list(ownerId) {
      const res = await query(`
        SELECT u.id, u.name, u.avatar_url, u.status, u.last_seen,
               u.public_key, c.nickname, c.added_at
        FROM contacts c
        JOIN users u ON u.id = c.contact_id
        WHERE c.owner_id = $1
        ORDER BY u.name
      `, [ownerId]);
      return res.rows;
    },

    async exists(ownerId, contactId) {
      const res = await query(
        'SELECT 1 FROM contacts WHERE owner_id = $1 AND contact_id = $2',
        [ownerId, contactId]
      );
      return res.rowCount > 0;
    },
  },

  conversations: {
    async create(type, name = null) {
      const id  = generateId();
      const res = await query(
        'INSERT INTO conversations (id, type, name) VALUES ($1,$2,$3) RETURNING *',
        [id, type, name]
      );
      return res.rows[0];
    },

    async findById(id) {
      const res = await query('SELECT * FROM conversations WHERE id = $1', [id]);
      return res.rows[0] ?? null;
    },

    async findDirect(userIdA, userIdB) {
      const res = await query(`
        SELECT c.* FROM conversations c
        JOIN participants pA ON pA.conversation_id = c.id AND pA.user_id = $1
        JOIN participants pB ON pB.conversation_id = c.id AND pB.user_id = $2
        WHERE c.type = 'direct'
        LIMIT 1
      `, [userIdA, userIdB]);
      return res.rows[0] ?? null;
    },

    async listForUser(userId) {
      const res = await query(`
        SELECT c.* FROM conversations c
        JOIN participants p ON p.conversation_id = c.id
        WHERE p.user_id = $1
          AND c.id NOT IN (
            SELECT conversation_id FROM conversation_hides WHERE user_id = $1
          )
        ORDER BY c.created_at DESC
      `, [userId]);
      return res.rows;
    },

    async exists(id) {
      const res = await query('SELECT 1 FROM conversations WHERE id = $1', [id]);
      return res.rowCount > 0;
    },

    async hideForUser(convId, userId) {
      await query(`
        INSERT INTO conversation_hides (conversation_id, user_id)
        VALUES ($1, $2) ON CONFLICT DO NOTHING
      `, [convId, userId]);
    },

    async deleteForAll(convId) {
      await query('DELETE FROM conversations WHERE id = $1', [convId]);
    },
  },

  participants: {
    async add(convId, userId) {
      await query(`
        INSERT INTO participants (conversation_id, user_id)
        VALUES ($1, $2) ON CONFLICT DO NOTHING
      `, [convId, userId]);
    },

    async remove(convId, userId) {
      await query(
        'DELETE FROM participants WHERE conversation_id = $1 AND user_id = $2',
        [convId, userId]
      );
    },

    async list(convId) {
      const res = await query(
        'SELECT user_id FROM participants WHERE conversation_id = $1',
        [convId]
      );
      return res.rows.map(r => r.user_id);
    },

    async isMember(convId, userId) {
      const res = await query(
        'SELECT 1 FROM participants WHERE conversation_id = $1 AND user_id = $2',
        [convId, userId]
      );
      return res.rowCount > 0;
    },
  },

  messages: {
    async save(convId, senderId, content, type = 'text') {
      const id  = generateId();
      const res = await query(`
        INSERT INTO messages (id, conversation_id, sender_id, content, type)
        VALUES ($1,$2,$3,$4,$5) RETURNING *
      `, [id, convId, senderId, content, type]);
      return res.rows[0];
    },

    async findById(id) {
      const res = await query('SELECT * FROM messages WHERE id = $1', [id]);
      return res.rows[0] ?? null;
    },

    async history(convId, limit = 50, userId = null) {
      const res = userId
        ? await query(`
            SELECT * FROM messages
            WHERE conversation_id = $1
              AND id NOT IN (
                SELECT message_id FROM message_deletes WHERE user_id = $2
              )
            ORDER BY created_at DESC
            LIMIT $3
          `, [convId, userId, limit])
        : await query(`
            SELECT * FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at DESC
            LIMIT $2
          `, [convId, limit]);
      return res.rows.reverse();
    },

    async updateStatus(messageId, status) {
      await query(
        'UPDATE messages SET status = $1 WHERE id = $2',
        [status, messageId]
      );
    },

    async markConversationRead(convId, byUserId) {
      await query(`
        UPDATE messages SET status = 'read'
        WHERE conversation_id = $1
          AND sender_id != $2
          AND status != 'read'
      `, [convId, byUserId]);
    },

    async deleteForUser(messageId, userId) {
      await query(`
        INSERT INTO message_deletes (message_id, user_id)
        VALUES ($1, $2) ON CONFLICT DO NOTHING
      `, [messageId, userId]);
    },

    async deleteForAll(messageId) {
      await query('DELETE FROM messages WHERE id = $1', [messageId]);
    },

    // ── NOVO: editar mensagem ───────────────────────────────────────────────
    // Guarda o conteúdo anterior no edit_history (array JSONB) antes de salvar
    // o novo conteúdo. Retorna a mensagem atualizada completa.
    async edit(messageId, newContent) {
      // Busca conteúdo atual para guardar no histórico
      const current = await query(
        'SELECT content, edit_history FROM messages WHERE id = $1',
        [messageId]
      );
      const row = current.rows[0];
      if (!row) return null;

      // Histórico atual (array) + versão que está sendo substituída agora
      const previousHistory = Array.isArray(row.edit_history) ? row.edit_history : [];
      const updatedHistory  = [
        ...previousHistory,
        { text: row.content, edited_at: new Date().toISOString() },
      ];

      const res = await query(`
        UPDATE messages
        SET content      = $1,
            edited_at    = NOW(),
            edit_history = $2::jsonb
        WHERE id = $3
        RETURNING *
      `, [newContent, JSON.stringify(updatedHistory), messageId]);

      return res.rows[0] ?? null;
    },
  },

  offlineQueue: {
    async enqueue(userId, eventType, payload) {
      const id      = generateId();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await query(`
        INSERT INTO offline_queue (id, user_id, event_type, payload, expires_at)
        VALUES ($1,$2,$3,$4,$5)
      `, [id, userId, eventType, JSON.stringify(payload), expires]);
      // Mantém máximo 100 mensagens por usuário na fila
      await query(`
        DELETE FROM offline_queue
        WHERE user_id = $1 AND id NOT IN (
          SELECT id FROM offline_queue
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 100
        )
      `, [userId]);
    },

    async flush(userId) {
      const res = await query(
        'SELECT * FROM offline_queue WHERE user_id = $1 ORDER BY created_at',
        [userId]
      );
      await query('DELETE FROM offline_queue WHERE user_id = $1', [userId]);
      return res.rows.map(r => ({ ...r, payload: JSON.parse(r.payload) }));
    },

    async evictExpired() {
      const res = await query('DELETE FROM offline_queue WHERE expires_at < NOW()');
      return res.rowCount;
    },

    async summary() {
      const res = await query(
        'SELECT user_id, COUNT(*) as pending FROM offline_queue GROUP BY user_id'
      );
      return res.rows;
    },
  },

  generateId,
  createSchema,
  close: () => pool.end(),
};

module.exports = db;
