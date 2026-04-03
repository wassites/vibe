// Endereço do servidor — use o IP local para o celular conseguir conectar
export const BASE_URL = 'http://10.220.0.5:3001';
export const WS_URL   = 'ws://10.220.0.5:3001';

// Requisição REST genérica
export async function post(path, body, token = null) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function get(path, token = null) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}
