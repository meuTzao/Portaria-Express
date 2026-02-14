
import React, { useState, useEffect } from 'react';
import { useInternalAuth } from '../context/InternalAuthContext';

const InternalLogin: React.FC = () => {
  const { loginInternal, loading, error, resetContext } = useInternalAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setStatusMsg('Validando Identidade...');
    
    const loginResult = await loginInternal(username, password);
    
    if (loginResult.success && loginResult.message) {
      setStatusMsg(loginResult.message);
    } else if (!loginResult.success) {
      setStatusMsg('');
    }
  };

  useEffect(() => {
    let timer: number;
    if (loading) {
      timer = window.setTimeout(() => {
        setStatusMsg('Autenticação Segura Offline...');
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-6 z-[100]">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-[32px] p-8 shadow-2xl animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-700">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl rotate-3">
             <span className="text-white text-2xl">🔐</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Portaria Express</h2>
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-1">Acesso Operacional Protegido</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-black rounded-2xl text-center border border-red-100 dark:border-red-900/30 uppercase animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Usuário de Acesso</label>
            <input
              type="text"
              required
              autoFocus
              disabled={loading}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:ring-0 text-sm dark:text-white disabled:opacity-50 transition-all font-bold"
              placeholder="Ex: adm"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Senha Pessoal</label>
            <input
              type="password"
              required
              disabled={loading}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:ring-0 text-sm dark:text-white disabled:opacity-50 transition-all font-bold"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full ${loading ? 'bg-slate-400' : 'bg-slate-900 dark:bg-slate-100'} text-white dark:text-slate-900 p-5 rounded-[22px] font-black text-sm shadow-2xl transition-all active:scale-95 flex flex-col justify-center items-center uppercase tracking-widest h-20`}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-[8px] mt-1 normal-case font-bold">{statusMsg || 'Verificando...'}</span>
                </div>
              ) : 'Desbloquear Sistema'}
            </button>

            <div className="flex items-center justify-center gap-2 text-slate-300 dark:text-slate-600">
               <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
               <span className="text-[8px] font-black uppercase">Segurança Ponta a Ponta</span>
               <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
            </div>

            <button
              type="button"
              onClick={() => {
                resetContext();
                window.location.reload();
              }}
              className="w-full text-slate-400 dark:text-slate-500 text-[9px] font-bold uppercase hover:text-blue-500 transition-colors"
            >
              Recarregar licença do dispositivo
            </button>
          </div>
        </form>
      </div>
      
      <p className="fixed bottom-6 text-slate-500 text-[8px] font-black uppercase tracking-[0.2em]">Criptografia Bcrypt v3 Ativa</p>
    </div>
  );
};

export default InternalLogin;
