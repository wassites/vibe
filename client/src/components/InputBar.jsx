import React, { useState, useRef, useCallback } from 'react';
import { useChat } from '../context/ChatContext';

const API = `http://${window.location.hostname}:3001`;

export default function InputBar({ conversationId }) {
  const { actions } = useChat();
  const [text, setText]         = useState('');
  const [uploading, setUploading] = useState(false);
  const typingRef  = useRef(false);
  const timerRef   = useRef(null);
  const fileRef    = useRef(null);

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

  const handleSend = useCallback(() => {
    const content = text.trim();
    if (!content) return;
    actions.sendMessage(conversationId, content);
    setText('');
    clearTimeout(timerRef.current);
    typingRef.current = false;
    actions.setTyping(conversationId, false);
  }, [text, conversationId, actions]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);

      const res  = await fetch(`${API}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();

      if (!data.ok) {
        alert(data.error ?? 'Erro ao enviar arquivo');
        return;
      }

      // Envia a URL como mensagem com o tipo correto (image/audio/video)
      actions.sendMessage(conversationId, data.url, data.type);
    } catch {
      alert('Erro de conexão ao enviar arquivo');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-end gap-2 px-4 py-3
                    bg-vibe-panel border-t border-vibe-border flex-shrink-0">

      {/* Botão de anexo */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title="Enviar imagem, áudio ou vídeo"
        className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center
                   text-vibe-muted hover:text-vibe-purple hover:bg-vibe-hover
                   disabled:opacity-30 disabled:cursor-not-allowed
                   transition-all duration-150"
      >
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

      {/* Input de arquivo oculto — aceita imagem, áudio e vídeo */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,audio/*,video/*"
        className="hidden"
        onChange={handleFile}
      />

      {/* Campo de texto */}
      <textarea
        rows={1}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Digite uma mensagem..."
        className="flex-1 bg-white border border-vibe-border rounded-xl
                   px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400
                   focus:outline-none focus:border-vibe-purple
                   resize-none transition-colors"
        style={{ maxHeight: '120px' }}
      />

      {/* Botão enviar */}
      <button
        onClick={handleSend}
        disabled={!text.trim() || uploading}
        className="w-10 h-10 rounded-xl flex-shrink-0
                   bg-gradient-vibe flex items-center justify-center
                   disabled:opacity-30 disabled:cursor-not-allowed
                   hover:opacity-90 active:scale-95
                   transition-all duration-150"
      >
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>

    </div>
  );
}
