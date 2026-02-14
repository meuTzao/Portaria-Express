
import React, { useState } from 'react';
import { useInternalAuth } from '../context/InternalAuthContext';

const ChangePassword: React.FC = () => {
  const { changePassword, loading, error, internalUser } = useInternalAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (newPassword.length < 4) {
      setLocalError("A senha deve ter pelo menos 4 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError("As senhas não coincidem.");
      return;
    }

    await changePassword(newPassword);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-6 z-[100]">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-2xl animate-in zoom-in duration-300">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
             <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Troca de Senha Obrigatória</h2>
          <p className="text-slate-500 text-xs mt-2">Olá <strong>{internalUser?.username}</strong>, este é seu primeiro acesso ou sua senha expirou. Defina uma nova senha.</p>
        </div>

        {(error || localError) && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl text-center">
            {error || localError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Nova Senha</label>
            <input
              type="password"
              required
              autoFocus
              className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border-none focus:ring-2 focus:ring-amber-500 text-sm dark:text-white"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Confirmar Nova Senha</label>
            <input
              type="password"
              required
              className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border-none focus:ring-2 focus:ring-amber-500 text-sm dark:text-white"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 text-white p-4 rounded-2xl font-bold text-sm shadow-lg shadow-amber-200 dark:shadow-none transition-all active:scale-95 flex justify-center items-center uppercase tracking-wide"
          >
            {loading ? 'Atualizando...' : 'Definir Nova Senha'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
