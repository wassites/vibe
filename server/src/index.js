'use strict';

require('dotenv').config();

const http      = require('http');
const path      = require('path');
const WebSocket = require('ws');
const express   = require('express');
const cors      = require('cors');
const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const db        = require('./db/db_index');
const handlers  = require('./handlers/handlers_index');
const { upload, UPLOAD_DIR } = require('./upload');
const { socketMap } = require('./middleware/socketMap');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const JWT_SECRET  = process.env.JWT_SECRET ?? 'vibe_dev_secret';
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// ── Auth email/senha ──────────────────────────────────────────────────────────

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim())       return res.status(400).json({ ok: false, error: 'Nome obrigatório' });
    if (!email?.trim())      return res.status(400).json({ ok: false, error: 'Email obrigatório' });
    if (!password?.trim())   return res.status(400).json({ ok: false, error: 'Senha obrigatória' });
    if (password.length < 6) return res.status(400).json({ ok: false, error: 'Senha mínima: 6 caracteres' });

    const existing = await db.users.findByEmail(email.trim().toLowerCase());
    if (existing) return res.status(409).json({ ok: false, error: 'Email já cadastrado' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId       = db.generateId();
    const user         = await db.users.create(userId, name.trim(), {
      email: email.trim().toLowerCase(), passwordHash, provider: 'local',
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`[AUTH] cadastro: ${user.name} (${user.email})`);
    res.json({ ok: true, token, user });
  } catch (err) {
    console.error('[AUTH register]', err.message);
    res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim())    return res.status(400).json({ ok: false, error: 'Email obrigatório' });
    if (!password?.trim()) return res.status(400).json({ ok: false, error: 'Senha obrigatória' });

    const user = await db.users.findByEmail(email.trim().toLowerCase());
    if (!user) return res.status(401).json({ ok: false, error: 'Email ou senha inválidos' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ ok: false, error: 'Email ou senha inválidos' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`[AUTH] login: ${user.name} (${user.email})`);
    res.json({ ok: true, token, user });
  } catch (err) {
    console.error('[AUTH login]', err.message);
    res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

// ── Upload de arquivos ────────────────────────────────────────────────────────

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Nenhum arquivo enviado' });

  const url  = `http://${req.hostname}:${process.env.PORT || 3001}/uploads/${req.file.filename}`;
  const type = req.file.mimetype.startsWith('image/') ? 'image'
             : req.file.mimetype.startsWith('audio/') ? 'audio'
             : 'video';

  console.log(`[UPLOAD] ${type} → ${req.file.filename} (${(req.file.size / 1024).toFixed(1)} KB)`);
  res.json({ ok: true, url, type, filename: req.file.filename, size: req.file.size });
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ ok: false, error: 'Arquivo muito grande (máx. 100 MB)' });
  if (err.message?.startsWith('Tipo não permitido'))
    return res.status(400).json({ ok: false, error: err.message });
  next(err);
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  console.log(`[WS] nova conexão de ${req.socket.remoteAddress ?? 'local'}`);

  ws.on('message', async raw => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    const { event, ...payload } = data;

    if (event !== 'auth' && !ws._userId)
      return ws.send(JSON.stringify({ event: 'error', message: 'Autentique-se primeiro' }));

    const h = handlers[event];
    if (!h)
      return ws.send(JSON.stringify({ event: 'error', message: `Evento desconhecido: ${event}` }));

    try {
      await h({ ws, userId: ws._userId, payload });
    } catch (err) {
      console.error(`[ERR] ${event}:`, err.message);
      ws.send(JSON.stringify({ event: 'error', message: 'Erro interno' }));
    }
  });

  ws.on('close', async () => {
    const userId = ws._userId;
    if (!userId) return;
    if (socketMap.get(userId) === ws) socketMap.delete(userId);
    await db.users.setStatus(userId, 'offline');
    for (const [, other] of socketMap) {
      if (other?.readyState === WebSocket.OPEN)
        other.send(JSON.stringify({ event: 'presence', userId, status: 'offline' }));
    }
    console.log(`[WS] ${userId} desconectou`);
  });

  ws.on('error', err => console.error('[WS ERROR]', err.message));
});

setInterval(async () => {
  for (const [uid, ws] of socketMap) {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
    else { socketMap.delete(uid); await db.users.setStatus(uid, 'offline'); }
  }
}, 30_000);

setInterval(async () => {
  const n = await db.offlineQueue.evictExpired();
  if (n > 0) console.log(`[QUEUE] ${n} msgs expiradas removidas`);
}, 3_600_000);

// ── REST API ──────────────────────────────────────────────────────────────────

app.get('/api/status', async (_, res) => {
  const users = await db.users.list();
  res.json({ ok: true, online: socketMap.size, users: users.length, uptime: process.uptime(), ts: new Date().toISOString() });
});

app.get('/api/users', async (_, res) => {
  res.json(await db.users.list());
});

app.get('/api/users/:id', async (req, res) => {
  const u = await db.users.findById(req.params.id);
  return u ? res.json(u) : res.status(404).json({ error: 'Não encontrado' });
});

// Atualiza perfil e notifica contatos online com novo avatar/nome
app.patch('/api/users/:id', async (req, res) => {
  try {
    const { name, bio, avatarUrl } = req.body;
    const user = await db.users.updateProfile(req.params.id, { name, bio, avatarUrl });
    if (!user) return res.status(404).json({ ok: false, error: 'Usuário não encontrado' });

    // Notifica contatos online
    const contacts = await db.contacts.list(req.params.id);
    const payload  = JSON.stringify({
      event:     'presence',
      userId:    user.id,
      name:      user.name,
      avatarUrl: user.avatar_url,
      status:    user.status,
    });
    for (const contact of contacts) {
      const ws = socketMap.get(contact.id);
      if (ws?.readyState === WebSocket.OPEN) ws.send(payload);
    }

    console.log(`[PROFILE] ${user.name} atualizou perfil`);
    res.json({ ok: true, user });
  } catch (err) {
    console.error('[PATCH user]', err.message);
    res.status(500).json({ ok: false, error: 'Erro interno' });
  }
});

app.get('/api/conversations/:id/history', async (req, res) => {
  const exists = await db.conversations.exists(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Não encontrada' });
  const msgs = await db.messages.history(req.params.id, Math.min(+(req.query.limit) || 50, 200));
  res.json(msgs);
});

// ── Auth por telefone ─────────────────────────────────────────────────────────
const smsCodes = new Map();

app.post('/auth/phone/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ ok: false, error: 'Telefone obrigatório' });
  const code      = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  smsCodes.set(phone, { code, expiresAt });
  console.log(`\n📱 [SMS SIMULADO] Para: ${phone} Código: ${code}\n`);
  res.json({ ok: true });
});

app.post('/auth/phone/verify', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ ok: false, error: 'Dados incompletos' });

  const entry = smsCodes.get(phone);
  if (!entry)                       return res.json({ ok: false, error: 'Código não solicitado' });
  if (Date.now() > entry.expiresAt) return res.json({ ok: false, error: 'Código expirado' });
  if (entry.code !== code)          return res.json({ ok: false, error: 'Código inválido' });

  smsCodes.delete(phone);
  const existing = await db.users.findByPhone(phone);
  if (existing) {
    const token = jwt.sign({ userId: existing.id }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ ok: true, token, user: existing, isNewUser: false });
  }
  const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ ok: true, token, isNewUser: true });
});

app.post('/auth/profile', async (req, res) => {
  const { name, bio } = req.body;
  const authHeader    = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ ok: false, error: 'Token obrigatório' });
  try {
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    if (!decoded.phone) return res.status(401).json({ ok: false, error: 'Token inválido' });
    const userId   = db.generateId();
    const user     = await db.users.create(userId, name.trim(), { phone: decoded.phone, bio: bio ?? null });
    const newToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token: newToken, user });
  } catch {
    res.status(401).json({ ok: false, error: 'Token inválido ou expirado' });
  }
});

app.post('/api/contacts/sync', async (req, res) => {
  const { phones } = req.body;
  if (!Array.isArray(phones)) return res.status(400).json({ error: 'phones deve ser um array' });
  const found = [];
  for (const { phone, name } of phones) {
    const user = await db.users.findByPhone(phone);
    if (user) found.push({ ...user, contactName: name });
  }
  res.json({ found });
});

// ── Iniciar ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

db.createSchema().then(() => {
  server.listen(PORT, () => {
    console.log(`\n⚡ Vibe Server`);
    console.log(`   WS   → ws://localhost:${PORT}`);
    console.log(`   REST → http://localhost:${PORT}/api/status`);
    console.log(`   DB   → PostgreSQL ${process.env.DB_NAME}\n`);
  });
}).catch(err => {
  console.error('[DB] falha ao criar schema:', err.message);
  process.exit(1);
});
