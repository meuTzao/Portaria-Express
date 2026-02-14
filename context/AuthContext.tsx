
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  session: Session | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) return 'porteiro';
      return data?.role || 'porteiro';
    } catch (err) {
      return 'porteiro';
    }
  };

  useEffect(() => {
    let mounted = true;

    const forceExitLoading = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
      }
    }, 6000);

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            const userRole = await fetchUserRole(initialSession.user.id);
            setRole(userRole);
          } else {
            setSession(null);
            setRole(null);
          }
        }
      } catch (err) {
        console.error("Auth Init Error:", err);
      } finally {
        if (mounted) {
          setLoading(false);
          clearTimeout(forceExitLoading);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      if (newSession) {
        setSession(newSession);
        const userRole = await fetchUserRole(newSession.user.id);
        setRole(userRole);
      } else {
        setSession(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(forceExitLoading);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    
    // Limpeza agressiva de todos os storages conhecidos
    const keysToRemove = [
      'portaria_express_internal_user_v2',
      'portaria_express_internal_session',
      'supabase.auth.token'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();

    setSession(null);
    setRole(null);
    
    // Força o navegador a recarregar a URL limpa para garantir que o estado do app morra
    window.location.href = window.location.origin;
  };

  return (
    <AuthContext.Provider value={{ session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
