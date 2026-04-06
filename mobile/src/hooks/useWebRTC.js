// mobile/src/hooks/useWebRTC.js
//
// Hook de chamadas WebRTC para React Native
// Usa react-native-webrtc (requer build nativo — não funciona no Expo Go)
//
// Diferenças do web:
//   • RTCPeerConnection vem do react-native-webrtc
//   • getUserMedia vem do mediaDevices do react-native-webrtc
//   • refs de vídeo usam RTCView em vez de <video>
//   • Permissões pedidas via expo-camera e expo-av

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import { useChat } from '../context/ChatContext';

// ── Servidores STUN públicos ───────────────────────────────────────────────────

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302'  },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function useWebRTC() {
  const { state, actions } = useChat();
  const { call } = state;

  // ── Refs internos ────────────────────────────────────────────────────────────
  const pcRef           = useRef(null);   // RTCPeerConnection
  const localStreamRef  = useRef(null);   // stream local (mic + câmera)
  const remoteStreamRef = useRef(null);   // stream remoto
  const pendingIceRef   = useRef([]);     // ICE candidates aguardando remoteDescription

  // Streams para os RTCView na UI
  const [localStream,  setLocalStream]  = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // ── Limpeza ao desmontar ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      _stopLocalStream();
      _closePC();
    };
  }, []);

  // ── Helpers privados ──────────────────────────────────────────────────────────

  function _stopLocalStream() {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }

  function _closePC() {
    if (!pcRef.current) return;
    pcRef.current.onicecandidate          = null;
    pcRef.current.ontrack                 = null;
    pcRef.current.onconnectionstatechange = null;
    pcRef.current.close();
    pcRef.current     = null;
    pendingIceRef.current = [];
  }

  function _createPC(peerId) {
    _closePC();

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Envia ICE candidates para o peer via socket
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        actions.sendCallSignal?.('call_ice', peerId, { candidate })
          ?? actions.send?.('call_ice', { to: peerId, candidate });
      }
    };

    // Recebe stream remoto
    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (stream) {
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      }
    };

    // Monitora estado da conexão
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] connectionState:', pc.connectionState);
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        hangup();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] iceConnectionState:', pc.iceConnectionState);
    };

    pcRef.current = pc;
    return pc;
  }

  // Captura stream local — mic + câmera se vídeo
  async function _getLocalStream(callType) {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: callType === 'video'
        ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
    };

    const stream = await mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  // Aplica ICE candidates que chegaram antes do remoteDescription
  async function _flushPendingICE() {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    while (pendingIceRef.current.length > 0) {
      const candidate = pendingIceRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] addIceCandidate flush:', err);
      }
    }
  }

  // ── API pública ───────────────────────────────────────────────────────────────

  // Inicia chamada — chamado pelo botão 📞 ou 📹
  const startCall = useCallback(async (conversationId, peerId, callType = 'audio') => {
    try {
      const stream = await _getLocalStream(callType);
      const pc     = _createPC(peerId);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Notifica o ChatContext para atualizar o estado de chamada
      const peer = state.users[peerId] ?? {};
      actions.dispatch?.({ type: 'CALL_OUTGOING',
        callType, conversationId, peerId,
        peerName:   peer.name       ?? 'Desconhecido',
        peerAvatar: peer.avatar_url ?? null,
        localStream: stream,
      });

      // Envia offer pelo socket
      actions.sendCallIOS?.('call_offer', peerId, { conversationId, callType, sdp: offer.sdp })
        ?? actions.send?.('call_offer', { to: peerId, conversationId, callType, sdp: offer.sdp });

    } catch (err) {
      console.error('[WebRTC] startCall:', err);
      _stopLocalStream();
      _closePC();
      if (err.message?.includes('Permission')) {
        alert('Permissão de câmera/microfone negada.');
      } else {
        alert('Não foi possível iniciar a chamada.');
      }
    }
  }, [actions, state.users]);

  // Atende chamada recebida
  const answerCall = useCallback(async () => {
    const { peerId, type: callType } = call;
    const pendingSdp = pcRef._pendingOffer;
    if (!peerId || !pendingSdp) return;

    try {
      const stream = await _getLocalStream(callType);
      const pc     = _createPC(peerId);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: pendingSdp })
      );
      await _flushPendingICE();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      actions.send?.('call_answer', { to: peerId, sdp: answer.sdp });
      pcRef._pendingOffer = null;

    } catch (err) {
      console.error('[WebRTC] answerCall:', err);
      _stopLocalStream();
      _closePC();
      alert('Não foi possível atender a chamada.');
    }
  }, [call, actions]);

  // Processa SDP answer (lado do caller)
  const handleAnswer = useCallback(async (sdp) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp })
      );
      await _flushPendingICE();
    } catch (err) {
      console.error('[WebRTC] handleAnswer:', err);
    }
  }, []);

  // Processa ICE candidate recebido
  const handleIceCandidate = useCallback(async (candidate) => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) {
      pendingIceRef.current.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC] addIceCandidate:', err);
    }
  }, []);

  // Recusa chamada
  const rejectCall = useCallback(() => {
    const { peerId } = call;
    if (peerId) actions.send?.('call_reject', { to: peerId });
    _stopLocalStream();
    _closePC();
  }, [call, actions]);

  // Encerra chamada
  const hangup = useCallback(() => {
    const { peerId } = call;
    if (peerId) actions.send?.('call_end', { to: peerId });
    _stopLocalStream();
    _closePC();
  }, [call, actions]);

  // Mudo/desmudo microfone
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
  }, []);

  // Liga/desliga câmera
  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
  }, []);

  // Troca câmera frontal ↔ traseira
  const switchCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(track => {
      track._switchCamera(); // método nativo do react-native-webrtc
    });
  }, []);

  // ── Retorno ───────────────────────────────────────────────────────────────────

  return {
    // Streams para RTCView na UI
    localStream,
    remoteStream,

    // Ações
    startCall,
    answerCall,
    rejectCall,
    hangup,
    toggleMute,
    toggleCamera,
    switchCamera,

    // Handlers chamados pelo ChatContext ao receber eventos do socket
    handleAnswer,
    handleIceCandidate,

    // Estado
    callStatus:  call.status,
    callType:    call.type,
    isMuted:     call.isMuted,
    isCameraOff: call.isCameraOff,
    peerName:    call.peerName,
    peerAvatar:  call.peerAvatar,
    startedAt:   call.startedAt,
  };
}
