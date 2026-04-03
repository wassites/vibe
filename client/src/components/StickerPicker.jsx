import React, { useState, useEffect } from 'react';

// Stickers locais — adicione URLs de imagens aqui ou faça upload para /uploads
const LOCAL_STICKERS = [
  { id: 'l1', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', label: '👋 Oi' },
  { id: 'l2', url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', label: '😂 Kkk' },
  { id: 'l3', url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', label: '❤️ Amor' },
  { id: 'l4', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', label: '🎉 Parabéns' },
  { id: 'l5', url: 'https://media.giphy.com/media/l46CyJmS9KUbokzsI/giphy.gif', label: '👍 Ok' },
  { id: 'l6', url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', label: '😴 Sono' },
  { id: 'l7', url: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif', label: '🤔 Hmm' },
  { id: 'l8', url: 'https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif', label: '😍 Uau' },
];

// Chave pública de demonstração do Giphy — troque pela sua em producao
// Obtenha em: https://developers.giphy.com
const GIPHY_KEY = 'dc6zaTOxFJmzC'; // chave demo pública

export default function StickerPicker({ onSelect, onClose }) {
  const [tab, setTab]         = useState('locais'); // 'locais' | 'giphy'
  const [query, setQuery]     = useState('');
  const [gifs, setGifs]       = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'giphy') fetchTrending();
  }, [tab]);

  async function fetchTrending() {
    setLoading(true);
    try {
      const res  = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=g`);
      const data = await res.json();
      setGifs(data.data ?? []);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }

  async function searchGiphy(q) {
    if (!q.trim()) return fetchTrending();
    setLoading(true);
    try {
      const res  = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=20&rating=g`);
      const data = await res.json();
      setGifs(data.data ?? []);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    setQuery(e.target.value);
    clearTimeout(handleSearch._t);
    handleSearch._t = setTimeout(() => searchGiphy(e.target.value), 500);
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
         style={{ width: '320px', maxHeight: '400px' }}>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex gap-1">
          {[['locais', '⭐ Stickers'], ['giphy', '🎬 GIFs']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: tab === t ? 'var(--accent, #25d366)' : 'transparent',
                color:      tab === t ? '#fff' : '#6b7280',
              }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400
                     hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/>
          </svg>
        </button>
      </div>

      {/* Busca (só no Giphy) */}
      {tab === 'giphy' && (
        <div className="px-3 py-2 border-b border-gray-100">
          <input
            type="text"
            placeholder="Buscar GIFs..."
            value={query}
            onChange={handleSearch}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5
                       text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:border-green-400"
          />
        </div>
      )}

      {/* Grade */}
      <div className="overflow-y-auto p-2" style={{ maxHeight: '300px' }}>
        {tab === 'locais' && (
          <div className="grid grid-cols-4 gap-1">
            {LOCAL_STICKERS.map(s => (
              <button key={s.id} onClick={() => onSelect(s.url)}
                className="aspect-square rounded-xl overflow-hidden hover:scale-105
                           transition-transform border border-transparent
                           hover:border-green-300"
                title={s.label}>
                <img src={s.url} alt={s.label}
                     className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {tab === 'giphy' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="w-6 h-6 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                </svg>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {gifs.map(gif => {
                  const url = gif.images?.fixed_height_small?.url ?? gif.images?.original?.url;
                  return (
                    <button key={gif.id} onClick={() => onSelect(url)}
                      className="aspect-square rounded-xl overflow-hidden hover:scale-105
                                 transition-transform border border-transparent
                                 hover:border-green-300">
                      <img src={url} alt={gif.title}
                           className="w-full h-full object-cover" />
                    </button>
                  );
                })}
                {gifs.length === 0 && (
                  <p className="col-span-3 text-center text-xs text-gray-400 py-8">
                    Nenhum GIF encontrado
                  </p>
                )}
              </div>
            )}
            <p className="text-center text-[10px] text-gray-300 mt-2">Powered by GIPHY</p>
          </>
        )}
      </div>
    </div>
  );
}
