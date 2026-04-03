// client/src/hooks/useWebRTC.js
//
// Hook que expõe a API de chamadas para a UI.
// Toda a lógica WebRTC já vive no ChatContext (pcRef, streams, handlers).
// Este hook só adiciona:
//   • refs dos elementos <video>/<audio> da UI
//   • switchCamera (única função que precisa dos refs de vídeo)
//   • aliases convenientes do state.call para a UI não acessar state diretamente

import { useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';

export function useWebRTC() {
  const { state, actions } = useChat();
  const { call } = state;

  // Refs para os elementos <video> / <audio> na UI
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);

  // Conecta streams nos elementos de vídeo sempre que mudarem
  useEffect(() => {
    if (localVideoRef.current && call.localStream) {
      localVideoRef.current.srcObject = call.localStream;
    }
  }, [call.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && call.remoteStream) {
      remoteVideoRef.current.srcObject = call.remoteStream;
    }
  }, [call.remoteStream]);

  // ── switchCamera — única lógica que fica aqui pois precisa do ref de vídeo ──

  async function switchCamera() {
    await actions.switchCamera(localVideoRef);
  }

  // ── Retorno ───────────────────────────────────────────────────────────────

  return {
    // Refs para os elementos <video> / <audio>
    localVideoRef,
    remoteVideoRef,

    // Ações — todas vivem no ChatContext
    startCall:    actions.startCall,
    answerCall:   actions.answerCall,
    rejectCall:   actions.rejectCall,
    hangup:       actions.endCall,
    toggleMute:   actions.toggleMute,
    toggleCamera: actions.toggleCamera,
    switchCamera,

    // Estado conveniente (espelho do ChatContext)
    callStatus:  call.status,
    callType:    call.type,
    isMuted:     call.isMuted,
    isCameraOff: call.isCameraOff,
    peerName:    call.peerName,
    peerAvatar:  call.peerAvatar,
    startedAt:   call.startedAt,
  };
}
