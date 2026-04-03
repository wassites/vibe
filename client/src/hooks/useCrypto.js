// client/src/hooks/useCrypto.js

const API = `http://${window.location.hostname}:3001`;

// ── Helpers Web Crypto API ────────────────────────────────────────────────────

async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt']
  );
}

async function exportPublicKey(key) {
  const exported = await window.crypto.subtle.exportKey('spki', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

async function exportPrivateKey(key) {
  const exported = await window.crypto.subtle.exportKey('pkcs8', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

async function importPublicKey(pem) {
  const binary = atob(pem);
  const bytes  = new Uint8Array(binary.length).map((_, i) => binary.charCodeAt(i));
  return await window.crypto.subtle.importKey(
    'spki', bytes.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false, ['encrypt']
  );
}

async function importPrivateKey(pem) {
  const binary = atob(pem);
  const bytes  = new Uint8Array(binary.length).map((_, i) => binary.charCodeAt(i));
  return await window.crypto.subtle.importKey(
    'pkcs8', bytes.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false, ['decrypt']
  );
}

// Cifra texto com chave pública RSA
// RSA-OAEP tem limite de tamanho — para textos longos usa AES híbrido
async function encryptMessage(plaintext, publicKeyPem) {
  const publicKey  = await importPublicKey(publicKeyPem);
  const encoder    = new TextEncoder();

  // Gera chave AES temporária para o conteúdo
  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
  const iv         = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted  = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, aesKey, encoder.encode(plaintext)
  );

  // Cifra a chave AES com RSA
  const rawAes     = await window.crypto.subtle.exportKey('raw', aesKey);
  const encAesKey  = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAes);

  // Empacota tudo em base64
  return JSON.stringify({
    v:   1,
    key: btoa(String.fromCharCode(...new Uint8Array(encAesKey))),
    iv:  btoa(String.fromCharCode(...iv)),
    msg: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  });
}

// Decifra com chave privada RSA
async function decryptMessage(ciphertext, privateKeyPem) {
  try {
    const { key, iv, msg } = JSON.parse(ciphertext);
    const privateKey = await importPrivateKey(privateKeyPem);

    const encAesKey = new Uint8Array(atob(key).split('').map(c => c.charCodeAt(0)));
    const rawAes    = await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encAesKey);

    const aesKey    = await window.crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);
    const ivBytes   = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0)));
    const msgBytes  = new Uint8Array(atob(msg).split('').map(c => c.charCodeAt(0)));

    const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, msgBytes);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null; // Retorna null se não conseguir decifrar
  }
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useCrypto() {

  function getPrivateKeyPem(userId) {
    return localStorage.getItem(`vibe_privkey_${userId}`);
  }

  async function initKeys(userId) {
    const existing = getPrivateKeyPem(userId);
    if (existing) return; // Já tem chaves

    // Gera novo par de chaves
    const keyPair      = await generateKeyPair();
    const publicKeyPem  = await exportPublicKey(keyPair.publicKey);
    const privateKeyPem = await exportPrivateKey(keyPair.privateKey);

    // Salva chave privada localmente
    localStorage.setItem(`vibe_privkey_${userId}`, privateKeyPem);

    // Envia chave pública + escrow para o servidor
    const token = localStorage.getItem('vibe_token');
    await fetch(`${API}/api/keys/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({
        userId,
        publicKey:        publicKeyPem,
        privateKeyEscrow: privateKeyPem, // Servidor cifra com chave mestra
      }),
    });

    console.log('[CRYPTO] chaves geradas e registradas');
  }

  async function recoverKeys(userId) {
    // Busca chave privada do servidor (escrow) para dispositivo novo
    const token = localStorage.getItem('vibe_token');
    const res   = await fetch(`${API}/api/keys/escrow/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data  = await res.json();
    if (!data.ok) return false;

    localStorage.setItem(`vibe_privkey_${userId}`, data.privateKeyEscrow);
    console.log('[CRYPTO] chaves recuperadas do servidor');
    return true;
  }

  async function getPublicKeyOf(userId) {
    // Tenta cache local primeiro
    const cached = localStorage.getItem(`vibe_pubkey_${userId}`);
    if (cached) return cached;

    const res  = await fetch(`${API}/api/keys/${userId}`);
    const data = await res.json();
    if (!data.ok) return null;

    // Cache por 24h
    localStorage.setItem(`vibe_pubkey_${userId}`, data.publicKey);
    return data.publicKey;
  }

  async function encrypt(plaintext, recipientUserId) {
    if (!plaintext || typeof plaintext !== 'string') return plaintext;
    try {
      const publicKey = await getPublicKeyOf(recipientUserId);
      if (!publicKey) return plaintext; // Sem chave — envia sem cifrar
      return await encryptMessage(plaintext, publicKey);
    } catch {
      return plaintext;
    }
  }

  async function decrypt(ciphertext, myUserId) {
    if (!ciphertext) return ciphertext;
    // Verifica se é uma mensagem cifrada (começa com JSON com campo v:1)
    if (!ciphertext.startsWith('{"v":1')) return ciphertext;
    try {
      const privateKey = getPrivateKeyPem(myUserId);
      if (!privateKey) return '🔒 Mensagem cifrada (chave não encontrada)';
      const result = await decryptMessage(ciphertext, privateKey);
      return result ?? '🔒 Não foi possível decifrar';
    } catch {
      return '🔒 Erro ao decifrar';
    }
  }

  function hasPrivateKey(userId) {
    return !!localStorage.getItem(`vibe_privkey_${userId}`);
  }

  return { initKeys, recoverKeys, encrypt, decrypt, hasPrivateKey, getPublicKeyOf };
}
