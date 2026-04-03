import React, { useState } from 'react';

export default function SyncRequest({ onAuthorize, onDeny }) {
  const [code, setCode]     = useState(null);
  const [loading, setLoading] = useState(false);

  function handleAuthorize() {
    setLoading(true);
    onAuthorize((generatedCode) => {
      setCode(generatedCode);
      setLoading(false);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-80 space-y-4">

        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-amber-500">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
          </div>
        </div>

        {!code ? (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-base font-semibold text-gray-800">
                Nova sessão detectada
              </h2>
              <p className="text-sm text-gray-500">
                Alguém fez login com sua conta em outro dispositivo ou aba. Deseja autorizar a sincronização?
              </p>
            </div>

            <button
              onClick={handleAuthorize}
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                         bg-green-500 hover:bg-green-600
                         disabled:opacity-40 transition-colors"
            >
              {loading ? 'Gerando código...' : 'Autorizar e gerar código'}
            </button>

            <button
              onClick={onDeny}
              className="w-full py-2 rounded-xl text-sm text-gray-500
                         hover:bg-gray-50 transition-colors"
            >
              Negar acesso
            </button>
          </>
        ) : (
          <>
            <div className="text-center space-y-2">
              <h2 className="text-base font-semibold text-gray-800">
                Código de sincronização
              </h2>
              <p className="text-sm text-gray-500">
                Digite este código no outro dispositivo. Expira em 5 minutos.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl py-4 text-center">
              <p className="text-3xl font-mono font-bold tracking-widest text-gray-800">
                {code}
              </p>
            </div>

            <button
              onClick={onDeny}
              className="w-full py-2 rounded-xl text-sm text-gray-500
                         hover:bg-gray-50 transition-colors"
            >
              Fechar
            </button>
          </>
        )}

      </div>
    </div>
  );
}
