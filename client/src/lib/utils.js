// Formata timestamp para exibição
export function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now  = new Date();

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'ontem';

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Gera uma cor de avatar baseada no nome
export function avatarColor(name = '') {
  const colors = [
    'from-purple-500 to-pink-500',
    'from-amber-400 to-orange-500',
    'from-teal-400 to-cyan-500',
    'from-blue-500 to-indigo-500',
    'from-green-400 to-emerald-500',
  ];
  let n = 0;
  for (const c of name) n += c.charCodeAt(0);
  return colors[n % colors.length];
}

// Gera um userId único para o cliente
export function generateUserId() {
  return 'user_' + Math.random().toString(36).slice(2, 10);
}
