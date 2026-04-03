// client/src/components/IncomingCall.jsx
//
// Banner flutuante que aparece quando chega uma chamada.
// Renderizado no topo da árvore (App.jsx) para aparecer em qualquer tela.
// Usa state.call do ChatContext — não precisa de props.

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { useWebRTC } from '../hooks/useWebRTC';

// ── Ícones inline (sem dependência extra) ─────────────────────────────────────

function IconPhone({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
    </svg>
  );
}

function IconVideo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
    </svg>
  );
}

function IconPhoneOff({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M1.414 1.386L0 2.8l3.34 3.34C2.408 7.21 1.65 8.27 1.21 9.5c-.17.48-.03 1.02.36 1.37l2.55 2.27c.39.35.96.43 1.43.2.37-.18.76-.33 1.16-.44L9.5 16.1c-.4.36-.47.97-.16 1.4l2.27 2.55c.35.39.89.53 1.37.36 1.23-.44 2.28-1.2 3.35-2.13l3.28 3.28 1.414-1.414L1.414 1.386zM20 5.91l-4 4V7c0-.55-.45-1-1-1H8.09L20 17.91V5.91z"/>
    </svg>
  );
}

// ── Avatar com inicial como fallback ─────────────────────────────────────────

function Avatar({ name, avatarUrl, size = 56 }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name ?? '?')[0].toUpperCase();
  const colors  = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8'];
  const color   = colors[initial.charCodeAt(0) % colors.length];

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: size * 0.4,
      fontWeight: 700, color: '#fff', fontFamily: 'inherit',
    }}>
      {initial}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function IncomingCall() {
  const { state }          = useChat();
  const { answerCall, rejectCall } = useWebRTC();
  const { call }           = state;
  const audioRef           = useRef(null);
  const [visible, setVisible] = useState(false);
  const [shake, setShake]     = useState(false);

  const isRinging = call.status === 'ringing';

  // Animação de entrada + toque
  useEffect(() => {
    if (isRinging) {
      setVisible(true);
      // Pequeno delay para a animação CSS pegar
      setTimeout(() => setShake(true), 600);
    } else {
      setShake(false);
      // Aguarda animação de saída antes de desmontar
      setTimeout(() => setVisible(false), 300);
    }
  }, [isRinging]);

  // Toca som de ringtone usando AudioContext (sem arquivo externo)
  useEffect(() => {
    if (!isRinging) {
      audioRef.current?.pause();
      return;
    }

    let ctx, interval;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();

      function ring() {
        if (!ctx || ctx.state === 'closed') return;
        // Dois beeps curtos (padrão de toque)
        [0, 0.3].forEach(offset => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 480;
          osc.type            = 'sine';
          gain.gain.setValueAtTime(0.3, ctx.currentTime + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
          osc.start(ctx.currentTime + offset);
          osc.stop(ctx.currentTime  + offset + 0.25);
        });
      }

      ring();
      interval = setInterval(ring, 3000);
    } catch (e) {
      // AudioContext pode falhar em alguns contextos — silencioso
    }

    return () => {
      clearInterval(interval);
      ctx?.close().catch(() => {});
    };
  }, [isRinging]);

  if (!visible) return null;

  const isVideo = call.type === 'video';

  return (
    <>
      {/* Overlay escurecido */}
      <div
        style={{
          position:        'fixed',
          inset:           0,
          background:      'rgba(0,0,0,0.45)',
          zIndex:          9998,
          opacity:         isRinging ? 1 : 0,
          transition:      'opacity 0.3s ease',
          backdropFilter:  'blur(3px)',
        }}
        onClick={rejectCall}
      />

      {/* Card da chamada */}
      <div
        style={{
          position:     'fixed',
          top:          '50%',
          left:         '50%',
          transform:    'translate(-50%, -50%)',
          zIndex:       9999,
          width:        'min(340px, 90vw)',
          borderRadius: '28px',
          overflow:     'hidden',
          boxShadow:    '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
          animation:    isRinging
            ? 'incomingSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards'
            : 'incomingSlideOut 0.3s ease forwards',
        }}
      >
        {/* Fundo gradiente animado */}
        <div style={{
          position:   'absolute',
          inset:      0,
          background: isVideo
            ? 'linear-gradient(145deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)'
            : 'linear-gradient(145deg, #0d1f0d 0%, #1a3a1a 40%, #0a2a0a 100%)',
          zIndex:     0,
        }} />

        {/* Círculos pulsantes de fundo */}
        <div style={{
          position:     'absolute',
          top:          '10%',
          left:         '50%',
          transform:    'translateX(-50%)',
          width:        200,
          height:       200,
          borderRadius: '50%',
          background:   isVideo
            ? 'radial-gradient(circle, rgba(66,153,225,0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(72,187,120,0.15) 0%, transparent 70%)',
          animation:    'pulse 2s ease-in-out infinite',
          zIndex:       0,
        }} />

        {/* Conteúdo */}
        <div style={{
          position:   'relative',
          zIndex:     1,
          padding:    '36px 28px 28px',
          display:    'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap:        12,
        }}>

          {/* Indicador de tipo */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          6,
            background:   'rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding:      '5px 14px',
            marginBottom: 4,
          }}>
            {isVideo
              ? <IconVideo className="" style={{ width: 14, height: 14, color: '#63b3ed' }} />
              : <IconPhone className="" style={{ width: 14, height: 14, color: '#68d391' }} />
            }
            <span style={{
              fontSize:    12,
              fontWeight:  600,
              letterSpacing: '0.08em',
              color:       isVideo ? '#63b3ed' : '#68d391',
              textTransform: 'uppercase',
            }}>
              {isVideo ? 'Chamada de vídeo' : 'Chamada de áudio'}
            </span>
          </div>

          {/* Avatar com anel pulsante */}
          <div style={{ position: 'relative', marginBottom: 4 }}>
            {/* Anéis pulsantes */}
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                position:     'absolute',
                inset:        -(i * 10),
                borderRadius: '50%',
                border:       `1.5px solid ${isVideo ? 'rgba(66,153,225,' : 'rgba(72,187,120,'}${0.4 - i * 0.1})`,
                animation:    `ringPulse 2s ease-out ${i * 0.3}s infinite`,
              }} />
            ))}
            <Avatar name={call.peerName} avatarUrl={call.peerAvatar} size={80} />
          </div>

          {/* Nome */}
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <p style={{
              margin:     0,
              fontSize:   22,
              fontWeight: 700,
              color:      '#fff',
              letterSpacing: '-0.02em',
            }}>
              {call.peerName ?? 'Desconhecido'}
            </p>
            <p style={{
              margin:     '4px 0 0',
              fontSize:   13,
              color:      'rgba(255,255,255,0.5)',
              animation:  'dotsBlink 1.4s steps(4, end) infinite',
            }}>
              Chamando
            </p>
          </div>

          {/* Botões */}
          <div style={{
            display:       'flex',
            gap:           40,
            marginTop:     20,
            alignItems:    'center',
            justifyContent: 'center',
          }}>

            {/* Recusar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <button
                onClick={rejectCall}
                style={{
                  width:        64,
                  height:       64,
                  borderRadius: '50%',
                  border:       'none',
                  background:   'linear-gradient(135deg, #ff4444, #cc0000)',
                  cursor:       'pointer',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  boxShadow:    '0 8px 24px rgba(255,68,68,0.45)',
                  transition:   'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseDown={e  => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                onMouseUp={e    => { e.currentTarget.style.transform = 'scale(1.08)'; }}
              >
                <IconPhoneOff style={{ width: 26, height: 26, color: '#fff' }} />
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                Recusar
              </span>
            </div>

            {/* Atender */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <button
                onClick={answerCall}
                style={{
                  width:        64,
                  height:       64,
                  borderRadius: '50%',
                  border:       'none',
                  background:   isVideo
                    ? 'linear-gradient(135deg, #3182ce, #2b6cb0)'
                    : 'linear-gradient(135deg, #38a169, #276749)',
                  cursor:       'pointer',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  boxShadow:    isVideo
                    ? '0 8px 24px rgba(49,130,206,0.45)'
                    : '0 8px 24px rgba(56,161,105,0.45)',
                  transition:   'transform 0.15s, box-shadow 0.15s',
                  animation:    shake ? 'buttonShake 0.6s ease' : undefined,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseDown={e  => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                onMouseUp={e    => { e.currentTarget.style.transform = 'scale(1.08)'; }}
              >
                {isVideo
                  ? <IconVideo  style={{ width: 26, height: 26, color: '#fff' }} />
                  : <IconPhone  style={{ width: 26, height: 26, color: '#fff' }} />
                }
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                Atender
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* Keyframes globais */}
      <style>{`
        @keyframes incomingSlideIn {
          from { opacity: 0; transform: translate(-50%, -40%) scale(0.85); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1);    }
        }
        @keyframes incomingSlideOut {
          from { opacity: 1; transform: translate(-50%, -50%) scale(1);    }
          to   { opacity: 0; transform: translate(-50%, -55%) scale(0.9);  }
        }
        @keyframes ringPulse {
          0%   { transform: scale(1);    opacity: 0.8; }
          100% { transform: scale(1.8);  opacity: 0;   }
        }
        @keyframes pulse {
          0%, 100% { transform: translateX(-50%) scale(1);    opacity: 0.6; }
          50%       { transform: translateX(-50%) scale(1.15); opacity: 1;   }
        }
        @keyframes dotsBlink {
          0%  { opacity: 1;   }
          50% { opacity: 0.4; }
          100%{ opacity: 1;   }
        }
        @keyframes buttonShake {
          0%, 100% { transform: rotate(0deg);   }
          20%      { transform: rotate(-12deg);  }
          40%      { transform: rotate(12deg);   }
          60%      { transform: rotate(-8deg);   }
          80%      { transform: rotate(8deg);    }
        }
      `}</style>
    </>
  );
}
