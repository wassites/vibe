import React, { useState, useRef, useCallback, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useChat } from '../context/ChatContext';
import { useCrypto } from '../hooks/useCrypto';
import StickerPicker from './StickerPicker';

import { API_URL } from '../lib/api';
const API = API_URL;

export default function InputBar({ conversationId }) {
  const { actions, state } = useChat();
  const { encrypt }        = useCrypto();

  const [text, setText]               = useState('');
  const [uploading, setUploading]     = useState(false);
  const [showEmoji, setShowEmoji]     = useState(false);
  const [showSticker, setShowSticker] = useState(false);
  const [recording, setRecording]     = useState(false);
  const [recordSecs, setRecordSecs]   = useState(0);

  const typingRef    = useRef(false);
  const timerRef     = useRef(null);
  const fileRef      = useRef(null);
  const emojiRef     = useRef(null);
  const stickerRef   = useRef(null);
  const mediaRef     = useRef(null); // MediaRecorder
  const chunksRef    = useRef([]);
  const recTimerRef  = useRef(null);

  const { participants, me } = state;
  const others = (participants[conversationId] ?? [])
    .map(u => typeof u === 'string' ? u : u?.id)
    .filter(uid => uid && uid !== me?.id);

  // Fecha pickers ao clicar fora
  useEffect(() => {
    function handle(e) {
      if (emojiRef.current   && !emojiRef.current.contains(e.target))   setShowEmoji(false);
      if (stickerRef.current && !stickerRef.current.contains(e.target)) setShowSticker(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function handleTyping() {
    if (!typingRef.current) {
      typingRef.current = true;
      actions.setTyping(conversationId, true);
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      typingRef.current = false;
      actions.setTyping(conversationId, false);
    }, 2000);
  }

  function handleChange(e) {
    setText(e.target.value);
    handleTyping();
  }

  function onEmojiSelect(emoji) {
    setText(prev => prev + emoji.native);
    setShowEmoji(false);
  }

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    clearTimeout(timerRef.current);
    typingRef.current = false;
    actions.setTyping(conversationId, false);
    try {
      if (others.length === 1) {
        const encrypted = await encrypt(content, others[0]);
        if (encrypted && encrypted !== content) {
          actions.sendMessage(conversationId, JSON.stringify({ v: 2, encrypted, plain: content }));
          return;
        }
      }
      actions.sendMessage(conversationId, content);
    } catch {
      actions.sendMessage(conversationId, content);
    }
  }, [text, conversationId, actions, others, encrypt]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`${API}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!data.ok) { alert(data.error ?? 'Erro ao enviar arquivo'); return; }
      actions.sendMessage(conversationId, data.url, data.type);
    } catch {
      alert('Erro de conexão ao enviar arquivo');
    } finally {
      setUploading(false);
    }
  }

  function handleStickerSend(url) {
    setShowSticker(false);
    actions.sendMessage(conversationId, url, 'image');
  }

  // ── Gravação de áudio ──────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime   = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const rec    = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];

      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        await uploadAudio(blob, mime);
      };

      rec.start();
      mediaRef.current = rec;
      setRecording(true);
      setRecordSecs(0);
      recTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch {
      alert('Permissão de microfone negada ou não disponível');
    }
  }

  function stopRecording() {
    clearInterval(recTimerRef.current);
    setRecording(false);
    setRecordSecs(0);
    if (mediaRef.current?.state !== 'inactive') mediaRef.current?.stop();
  }

  function cancelRecording() {
    clearInterval(recTimerRef.current);
    setRecording(false);
    setRecordSecs(0);
    if (mediaRef.current?.state !== 'inactive') {
      mediaRef.current.onstop = null; // não envia
      mediaRef.current.stop();
      mediaRef.current.stream?.getTracks().forEach(t => t.stop());
    }
  }

  async function uploadAudio(blob, mime) {
    setUploading(true);
    try {
      const ext  = mime.includes('webm') ? 'webm' : 'ogg';
      const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: mime });
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`${API}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!data.ok) { alert(data.error ?? 'Erro ao enviar áudio'); return; }
      actions.sendMessage(conversationId, data.url, 'audio');
    } catch {
      alert('Erro ao enviar áudio');
    } finally {
      setUploading(false);
    }
  }

  function formatSecs(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex items-end gap-2 px-4 py-3
                    bg-vibe-panel border-t border-vibe-border flex-shrink-0">

      {/* Emoji Picker */}
      {showEmoji && (
        <div ref={emojiRef}
             className="absolute bottom-16 left-4 z-50 shadow-xl rounded-2xl overflow-hidden">
          <Picker data={data} onEmojiSelect={onEmojiSelect}
                  theme="light" locale="pt" previewPosition="none" skinTonePosition="none" />
        </div>
      )}

      {/* Sticker Picker */}
      {showSticker && (
        <div ref={stickerRef} className="absolute bottom-16 left-16 z-50">
          <StickerPicker onSelect={handleStickerSend} onClose={() => setShowSticker(false)} />
        </div>
      )}

      {/* Modo gravação */}
      {recording ? (
        <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-red-50
                        border border-red-200 rounded-xl">
          {/* Cancelar */}
          <button onClick={cancelRecording}
            className="text-gray-400 hover:text-red-400 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/>
            </svg>
          </button>

          {/* Tempo + animação */}
          <div className="flex items-center gap-2 flex-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-mono text-red-600">{formatSecs(recordSecs)}</span>
            <span className="text-xs text-gray-400">Gravando...</span>
          </div>

          {/* Enviar */}
          <button onClick={stopRecording}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: 'var(--accent, #25d366)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      ) : (
        <>
          {/* Botão emoji */}
          <button onClick={() => { setShowEmoji(v => !v); setShowSticker(false); }}
            title="Emojis"
            className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center
                       text-vibe-muted hover:text-vibe-accent hover:bg-vibe-hover
                       transition-all duration-150 text-xl">
            😊
          </button>

          {/* Botão sticker */}
          <button onClick={() => { setShowSticker(v => !v); setShowEmoji(false); }}
            title="Stickers e GIFs"
            className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center
                       text-vibe-muted hover:text-vibe-accent hover:bg-vibe-hover
                       transition-all duration-150 text-xl">
            🎭
          </button>

          {/* Botão anexo */}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            title="Enviar arquivo"
            className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center
                       text-vibe-muted hover:text-vibe-accent hover:bg-vibe-hover
                       disabled:opacity-30 transition-all duration-150">
            {uploading
              ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                </svg>
              : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .83-.67 1.5-1.5
                           1.5s-1.5-.67-1.5-1.5V6H9v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S6 2.79 6 5v12.5c0
                           3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
                </svg>
            }
          </button>

          <input ref={fileRef} type="file" accept="image/*,audio/*,video/*"
                 className="hidden" onChange={handleFile} />

          {/* Campo de texto */}
          <textarea
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="flex-1 bg-white border border-gray-300 rounded-xl
                       px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:border-vibe-accent
                       resize-none transition-colors"
            style={{ maxHeight: '120px' }}
          />

          {/* Botão enviar ou microfone */}
          {text.trim()
            ? <button onClick={handleSend} disabled={uploading}
                className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center
                           disabled:opacity-30 hover:opacity-90 active:scale-95 transition-all duration-150"
                style={{ background: 'var(--accent, #25d366)' }}>
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            : <button onClick={startRecording} disabled={uploading}
                title="Gravar áudio"
                className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center
                           text-vibe-muted hover:text-white disabled:opacity-30
                           hover:opacity-90 active:scale-95 transition-all duration-150"
                style={{ background: uploading ? undefined : 'var(--accent, #25d366)' }}>
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93H2c0 4.97 3.53 9.08 8 9.85V21h2v-3.07c4.47-.77 8-4.88 8-9.86h-2c0 4.07-3.06 7.43-7 7.93z"/>
                </svg>
              </button>
          }
        </>
      )}
    </div>
  );
}
