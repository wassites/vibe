// client/src/components/CallModal.jsx
//
// Tela fullscreen da chamada ativa (áudio ou vídeo).
// Aparece quando state.call.status === 'calling' | 'connected'
// Usa useWebRTC para refs de vídeo e controles.

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { useWebRTC } from '../hooks/useWebRTC';

// ── Ícones inline ─────────────────────────────────────────────────────────────

const Icon = {
  PhoneOff: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path d="M1.414 1.386L0 2.8l3.34 3.34C2.408 7.21 1.65 8.27 1.21 9.5c-.17.48-.03 1.02.36 1.37l2.55 2.27c.39.35.96.43 1.43.2.37-.18.76-.33 1.16-.44L9.5 16.1c-.4.36-.47.97-.16 1.4l2.27 2.55c.35.39.89.53 1.37.36 1.23-.44 2.28-1.2 3.35-2.13l3.28 3.28 1.414-1.414L1.414 1.386zM20 5.91l-4 4V7c0-.55-.45-1-1-1H8.09L20 17.91V5.91z"/>
    </svg>
  ),
  MicOn: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93H2c0 4.97 3.53 9.08 8 9.85V21h2v-3.07c4.47-.77 8-4.88 8-9.86h-2c0 4.07-3.06 7.43-7 7.93z"/>
    </svg>
  ),
  MicOff: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
    </svg>
  ),
  VideoOn: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
    </svg>
  ),
  VideoOff: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
    </svg>
  ),
  FlipCamera: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-1l-3-3h2c0-1.65 1.35-3 3-3s3 1.35 3 3-1.35 3-3 3v-2l-3 3 3 3v-2c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4h2l-3 3z"/>
    </svg>
  ),
  Speaker: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
    </svg>
  ),
};

// ── Avatar fallback ───────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl, size = 80 }) {
  const [err, setErr] = useState(false);
  const initial = (name ?? '?')[0].toUpperCase();
  const colors  = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD'];
  const color   = colors[initial.charCodeAt(0) % colors.length];

  if (avatarUrl && !err) {
    return (
      <img src={avatarUrl} alt={name} onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff',
    }}>
      {initial}
    </div>
  );
}

// ── Timer da chamada ──────────────────────────────────────────────────────────

function CallTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = n => String(n).padStart(2, '0');

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {h > 0 ? `${pad(h)}:` : ''}{pad(m)}:{pad(s)}
    </span>
  );
}

// ── Botão de controle ─────────────────────────────────────────────────────────

function ControlBtn({ onClick, active = true, label, danger = false, large = false, children }) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  const size = large ? 68 : 54;
  const bg   = danger
    ? (hover ? '#ff2222' : '#ff4444')
    : active
      ? (hover ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.14)')
      : (hover ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setHover(false); setPress(false); }}
        onMouseDown={() => setPress(true)}
        onMouseUp={() => setPress(false)}
        onTouchStart={() => setPress(true)}
        onTouchEnd={() => setPress(false)}
        style={{
          width:        size,
          height:       size,
          borderRadius: '50%',
          border:       active && !danger ? '1.5px solid rgba(255,255,255,0.18)' : 'none',
          background:   bg,
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          color:        active || danger ? '#fff' : 'rgba(255,255,255,0.4)',
          transform:    press ? 'scale(0.92)' : hover ? 'scale(1.05)' : 'scale(1)',
          transition:   'transform 0.12s, background 0.15s',
          boxShadow:    danger ? '0 6px 20px rgba(255,68,68,0.4)' : 'none',
        }}
      >
        {children}
      </button>
      {label && (
        <span style={{
          fontSize: 11, color: 'rgba(255,255,255,0.5)',
          fontWeight: 500, letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CallModal() {
  const { state }   = useChat();
  const {
    localVideoRef,
    remoteVideoRef,
    hangup,
    toggleMute,
    toggleCamera,
    switchCamera,
    callStatus,
    callType,
    isMuted,
    isCameraOff,
    peerName,
    peerAvatar,
    startedAt,
  } = useWebRTC();

  const { call } = state;
  const isActive  = ['calling', 'connected'].includes(call.status);
  const isVideo   = call.type === 'video';
  const isConnected = call.status === 'connected';

  // Controla visibilidade com animação de saída
  const [visible, setVisible]         = useState(false);
  const [animateOut, setAnimateOut]   = useState(false);
  // Mostra controles ao mover mouse/tocar
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef(null);

  useEffect(() => {
    if (isActive) {
      setVisible(true);
      setAnimateOut(false);
    } else if (visible) {
      setAnimateOut(true);
      setTimeout(() => setVisible(false), 350);
    }
  }, [isActive]);

  // Esconde controles após 4s de inatividade (só no modo vídeo conectado)
  useEffect(() => {
    if (!isVideo || !isConnected) { setShowControls(true); return; }
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
    return () => clearTimeout(hideTimer.current);
  }, [isVideo, isConnected]);

  function revealControls() {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (isVideo && isConnected) {
      hideTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
  }

  if (!visible) return null;

  // ── Layout vídeo ────────────────────────────────────────────────────────────
  if (isVideo) {
    return (
      <div
        onMouseMove={revealControls}
        onTouchStart={revealControls}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     9999,
          background: '#000',
          display:    'flex',
          flexDirection: 'column',
          animation:  animateOut
            ? 'modalFadeOut 0.35s ease forwards'
            : 'modalFadeIn 0.35s ease forwards',
        }}
      >
        {/* Vídeo remoto — fullscreen */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            position:   'absolute',
            inset:      0,
            width:      '100%',
            height:     '100%',
            objectFit:  'cover',
          }}
        />

        {/* Fallback quando não há stream remoto ainda */}
        {!call.remoteStream && (
          <div style={{
            position:   'absolute',
            inset:      0,
            display:    'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(145deg,#0d0d1a,#1a1a2e)',
            gap:        20,
          }}>
            <Avatar name={peerName} avatarUrl={peerAvatar} size={100} />
            <p style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>{peerName}</p>
            <p style={{
              color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0,
              animation: 'dotsBlink 1.4s ease infinite',
            }}>
              {isConnected ? 'Conectando vídeo...' : 'Chamando...'}
            </p>
          </div>
        )}

        {/* Vídeo local — pip no canto */}
        <div style={{
          position:     'absolute',
          top:          16,
          right:        16,
          width:        110,
          height:       156,
          borderRadius: 16,
          overflow:     'hidden',
          boxShadow:    '0 8px 24px rgba(0,0,0,0.6)',
          border:       '2px solid rgba(255,255,255,0.15)',
          background:   '#111',
          zIndex:       2,
          opacity:      showControls ? 1 : 0.6,
          transition:   'opacity 0.3s',
        }}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
          {isCameraOff && (
            <div style={{
              position: 'absolute', inset: 0, background: '#111',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon.VideoOff />
            </div>
          )}
        </div>

        {/* Header (nome + timer) */}
        <div style={{
          position:   'absolute',
          top:        0,
          left:       0,
          right:      0,
          padding:    '20px 20px 60px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
          zIndex:     2,
          opacity:    showControls ? 1 : 0,
          transition: 'opacity 0.4s',
        }}>
          <p style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700 }}>{peerName}</p>
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
            {isConnected ? <CallTimer startedAt={startedAt} /> : 'Chamando...'}
          </p>
        </div>

        {/* Controles */}
        <div style={{
          position:   'absolute',
          bottom:     0,
          left:       0,
          right:      0,
          padding:    '60px 24px 40px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
          zIndex:     2,
          opacity:    showControls ? 1 : 0,
          transition: 'opacity 0.4s',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 20 }}>
            <ControlBtn onClick={toggleMute}   active={!isMuted}    label={isMuted    ? 'Ativar mic' : 'Mudo'}>
              {isMuted ? <Icon.MicOff /> : <Icon.MicOn />}
            </ControlBtn>
            <ControlBtn onClick={toggleCamera} active={!isCameraOff} label={isCameraOff ? 'Ligar câm' : 'Câmera'}>
              {isCameraOff ? <Icon.VideoOff /> : <Icon.VideoOn />}
            </ControlBtn>
            <ControlBtn onClick={hangup} danger large label="Encerrar">
              <Icon.PhoneOff />
            </ControlBtn>
            <ControlBtn onClick={switchCamera} label="Virar câm">
              <Icon.FlipCamera />
            </ControlBtn>
            <ControlBtn label="Alto-fal">
              <Icon.Speaker />
            </ControlBtn>
          </div>
        </div>

      </div>
    );
  }

  // ── Layout áudio ────────────────────────────────────────────────────────────
  return (
    <div style={{
      position:   'fixed',
      inset:      0,
      zIndex:     9999,
      display:    'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding:    '64px 32px 52px',
      background: 'linear-gradient(160deg, #0d1f0d 0%, #1a3a1a 45%, #0a2a0a 100%)',
      animation:  animateOut
        ? 'modalFadeOut 0.35s ease forwards'
        : 'modalFadeIn 0.35s ease forwards',
    }}>

      {/* Fundo decorativo */}
      <div style={{
        position:   'absolute',
        inset:      0,
        overflow:   'hidden',
        pointerEvents: 'none',
      }}>
        {[180, 280, 380].map((size, i) => (
          <div key={i} style={{
            position:     'absolute',
            top:          '35%',
            left:         '50%',
            transform:    'translate(-50%, -50%)',
            width:        size,
            height:       size,
            borderRadius: '50%',
            border:       '1px solid rgba(72,187,120,0.12)',
            animation:    `audioRing 3s ease-out ${i * 0.8}s infinite`,
          }} />
        ))}
      </div>

      {/* Área superior — info */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{
          margin:        0,
          fontSize:      13,
          fontWeight:    600,
          letterSpacing: '0.1em',
          color:         '#68d391',
          textTransform: 'uppercase',
          marginBottom:  32,
        }}>
          {isConnected ? 'Em chamada' : 'Chamando...'}
        </p>

        {/* Avatar com pulso */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 24 }}>
          {isConnected && (
            <div style={{
              position:     'absolute',
              inset:        -8,
              borderRadius: '50%',
              background:   'rgba(72,187,120,0.2)',
              animation:    'connectedPulse 2s ease-in-out infinite',
            }} />
          )}
          <Avatar name={peerName} avatarUrl={peerAvatar} size={100} />
        </div>

        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
          {peerName}
        </p>

        <p style={{ margin: '8px 0 0', fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>
          {isConnected
            ? <CallTimer startedAt={startedAt} />
            : <span style={{ animation: 'dotsBlink 1.4s ease infinite' }}>Aguardando resposta</span>
          }
        </p>
      </div>

      {/* Área inferior — controles */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
        {/* Controles secundários */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 32 }}>
          <ControlBtn onClick={toggleMute} active={!isMuted} label={isMuted ? 'Ativar mic' : 'Mudo'}>
            {isMuted ? <Icon.MicOff /> : <Icon.MicOn />}
          </ControlBtn>
          <ControlBtn label="Alto-fal">
            <Icon.Speaker />
          </ControlBtn>
        </div>

        {/* Botão encerrar — destaque */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ControlBtn onClick={hangup} danger large label="Encerrar chamada">
            <Icon.PhoneOff />
          </ControlBtn>
        </div>
      </div>

      {/* Audio element para stream remoto (áudio) */}
      <audio ref={remoteVideoRef} autoPlay style={{ display: 'none' }} />

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(1.04); }
          to   { opacity: 1; transform: scale(1);    }
        }
        @keyframes modalFadeOut {
          from { opacity: 1; transform: scale(1);    }
          to   { opacity: 0; transform: scale(0.96); }
        }
        @keyframes audioRing {
          0%   { transform: translate(-50%,-50%) scale(0.8); opacity: 0.6; }
          100% { transform: translate(-50%,-50%) scale(1.6); opacity: 0;   }
        }
        @keyframes connectedPulse {
          0%, 100% { transform: scale(1);    opacity: 0.7; }
          50%       { transform: scale(1.12); opacity: 1;   }
        }
        @keyframes dotsBlink {
          0%, 100% { opacity: 1;   }
          50%      { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
