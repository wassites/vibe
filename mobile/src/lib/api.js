export const BASE_URL = "https://vibe-server-dy2z.onrender.com";
export const WS_URL = "wss://vibe-server-dy2z.onrender.com";

export async function post(path, body, token = null) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
