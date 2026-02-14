
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { InternalUser } from '../types';
import { db } from '../services/db';
import bcrypt from 'bcryptjs';

interface InternalAuthContextType {
  internalUser: InternalUser | null;
  isAuthenticated: boolean;
  loginInternal: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logoutInternal: () => void;
  changePassword: (newPassword: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
  resetContext: () => void;
}

// Chave da sessão ativa (Volátil - morre ao fechar a aba)
const SESSION_KEY = 'portaria_express_active_session_v2';

const InternalAuthContext = createContext<InternalAuthContextType | undefined>(undefined);

const withTimeout = (promise: Promise<any>, timeoutMs: number = 5000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
    )
  ]);
};

export const InternalAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading: authLoading } = useAuth();
  
  const [internalUser, setInternalUser] = useState<InternalUser | null>(() => {
    try {
      // Tenta recuperar sessão ativa da sessionStorage (mais seguro)
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!sessionStorage.getItem(SESSION_KEY);
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetContext = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setInternalUser(null);
    setIsAuthenticated(false);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      resetContext();
      return;
    }

    const verifyUserInBackground = async () => {
      try {
        if (!navigator.onLine) return;

        const { data: users, error: fetchError } = await withTimeout(
          supabase
            .from('internal_users')
            .select('*')
            .eq('supabase_user_id', session.user.id),
          10000
        );

        if (!fetchError && users) {
          // Atualiza o cache offline local (Persistent)
          db.saveUsersCache(users);
          
          // Se o usuário atual logado não estiver mais na lista da nuvem, desloga por segurança
          if (internalUser) {
            const stillExists = users.find(u => u.id === internalUser.id);
            if (!stillExists) {
              console.warn("Usuário logado foi removido pelo administrador. Encerrando sessão.");
              logoutInternal();
            }
          }
        }
      } catch (err) {
        console.debug("InternalAuth: Sync de segurança em segundo plano ignorado.");
      }
    };

    verifyUserInBackground();
  }, [session, authLoading, internalUser]);

  const loginInternal = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    setLoading(true);
    setError(null);
    
    const cleanUsername = username.toLowerCase().trim();

    try {
      if (!session) throw new Error("Acesso negado: Dispositivo sem licença ativa.");

      let user: InternalUser | null = null;
      let usedCache = false;

      // 1. TENTATIVA NUVEM (Prioridade)
      try {
        if (navigator.onLine) {
          const { data, error: userError } = await withTimeout(
            supabase
              .from('internal_users')
              .select('*')
              .eq('supabase_user_id', session.user.id)
              .eq('username', cleanUsername)
              .maybeSingle(),
            5000
          );

          if (!userError && data) {
            user = data;
            db.updateUserInCache(data);
          }
        }
      } catch (e) {
        console.warn("Nuvem indisponível, tentando validação local segura...");
      }

      // 2. FALLBACK CACHE LOCAL (Segurança Offline)
      if (!user) {
        const cache = db.getUsersCache();
        user = cache.find(u => u.username === cleanUsername) || null;
        usedCache = !!user;
      }

      if (!user) {
        // Delay protetivo contra tentativas exaustivas
        await new Promise(r => setTimeout(r, 1000));
        setError("Usuário não autorizado neste dispositivo.");
        return { success: false };
      }

      // 3. VALIDAÇÃO CRIPTOGRÁFICA
      const isValid = await bcrypt.compare(password, user.password_hash);

      if (isValid) {
        setInternalUser(user);
        setIsAuthenticated(true);
        // Salva na SESSION (morre ao fechar aba)
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return { success: true, message: usedCache ? "Acesso Seguro (Modo Offline)" : "Acesso Validado na Nuvem" };
      } else {
        // Delay protetivo em caso de erro
        await new Promise(r => setTimeout(r, 1500));
        setError("Senha operacional incorreta.");
        return { success: false };
      }
    } catch (err: any) {
      console.error("Critical Login Failure:", err);
      setError("Falha na validação de segurança. Tente novamente.");
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const logoutInternal = () => {
    resetContext();
  };

  const changePassword = async (newPassword: string): Promise<boolean> => {
    if (!internalUser) return false;
    setLoading(true);
    try {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(newPassword, salt);
      const { error: updateError } = await supabase
        .from('internal_users')
        .update({ password_hash: hash, must_change_password: false })
        .eq('id', internalUser.id);
      
      if (updateError) throw updateError;
      
      const updatedUser = { ...internalUser, password_hash: hash, must_change_password: false };
      setInternalUser(updatedUser);
      db.updateUserInCache(updatedUser);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <InternalAuthContext.Provider value={{
      internalUser,
      isAuthenticated,
      loginInternal,
      logoutInternal,
      changePassword,
      loading,
      error,
      resetContext
    }}>
      {children}
    </InternalAuthContext.Provider>
  );
};

export const useInternalAuth = () => {
  const context = useContext(InternalAuthContext);
  if (context === undefined) {
    throw new Error('useInternalAuth must be used within an InternalAuthProvider');
  }
  return context;
};
