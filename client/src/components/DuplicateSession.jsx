import React, { useState, useEffect } from 'react';

export default function DuplicateSession({ sessionId, onSync, onContinueAlone }) {
  const [step, setStep]     = useState('waiting'); // waiting | code | success | timeout
  const [code, setCode]     = useState('');
  const [error, setError]   = useState(null);
  const [countdown, setCountdown] = useState(300);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); setStep('timeout'); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = String(Math.floor(countdown / 60)).padStart(2, '0');
  const seconds = String(countdown % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-80 space-y-4">

        {/* Ícone */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-green-500">
              <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
            </svg>
          </div>
        </div>

        {step === 'waiting' && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-base font-semibold text-gray-800">
                Sessão ativa em outro dispositivo
              </h2>
              <p className="text-sm text-gray-500">
                Você já está conectado em outra aba ou dispositivo. Uma notificação foi enviada para autorizar a sincronização.
              </p>
              <p className="text-xs text-gray-400">
                Aguardando autorização... {minutes}:{seconds}
              </p>
            </div>

            <button
              onClick={() => setStep('code')}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                         bg-green-500 hover:bg-green-600 transition-colors"
            >
              Tenho o código
            </button>

            <button
              onClick={onContinueAlone}
              className="w-full py-2 rounded-xl text-sm text-gray-500
                         hover:bg-gray-50 transition-colors"
            >
              Continuar sem sincronizar
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <div className="text-center space-y-1">
              <h2 className="text-base font-semibold text-gray-800">
                Digite o código
              </h2>
              <p className="text-sm text-gray-500">
                Veja o código de 6 dígitos que apareceu no outro dispositivo.
              </p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(null); }}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3
                         text-center text-2xl font-mono tracking-widest text-gray-900
                         focus:outline-none focus:border-green-500"
            />

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}

            <button
              onClick={() => {
                if (code.length !== 6) return setError('Digite os 6 dígitos');
                onSync(code);
              }}
              disabled={code.length !== 6}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                         bg-green-500 hover:bg-green-600
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Confirmar
            </button>

            <button
              onClick={() => setStep('waiting')}
              className="w-full py-2 rounded-xl text-sm text-gray-500
                         hover:bg-gray-50 transition-colors"
            >
              Voltar
            </button>
          </>
        )}

        {step === 'timeout' && (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-base font-semibold text-gray-800">Tempo esgotado</h2>
              <p className="text-sm text-gray-500">
                A solicitação de sincronização expirou.
              </p>
            </div>
            <button
              onClick={onContinueAlone}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                         bg-green-500 hover:bg-green-600 transition-colors"
            >
              Continuar sem sincronizar
            </button>
          </>
        )}

      </div>
    </div>
  );
}
