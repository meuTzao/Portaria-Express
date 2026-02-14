
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, VehicleEntry, AppSettings, UserSession, SyncStatus } from './types';
import { db } from './services/db';
import { syncService } from './services/sync';
import { useAuth } from './context/AuthContext';
import { useInternalAuth } from './context/InternalAuthContext';
import { Icons } from './constants';
import Dashboard from './components/Dashboard';
import NewEntryFlow from './components/NewEntryFlow';
import ActiveVehicles from './components/ActiveVehicles';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Navbar from './components/Navbar';
import Login from './components/Login';
import InternalLogin from './components/InternalLogin';
import ChangePassword from './components/ChangePassword';
import UserManagement from './components/UserManagement';
import WorkShiftManager from './components/WorkShiftManager';
import DataManagement from './components/DataManagement';
import ContactManagement from './components/ContactManagement';
import BreakfastManager from './components/BreakfastManager';
import PackageManager from './components/PackageManager';
import MeterManager from './components/MeterManager';
import SystemLogs from './components/SystemLogs';
import PatrolManager from './components/PatrolManager';

const App: React.FC = () => {
  const { session: supabaseSession, loading: authLoading, signOut } = useAuth();
  const { internalUser, isAuthenticated, loading: internalLoading, logoutInternal } = useInternalAuth();
  
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [entries, setEntries] = useState<VehicleEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(db.getSettings());
  const [session, setSession] = useState<UserSession | null>(db.getSession());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  
  // Ref para evitar múltiplas execuções simultâneas do sync
  const isSyncingRef = useRef(false);

  // --- SYNC AUTOMÁTICO (30 MIN) ---
  useEffect(() => {
    const runAutoSync = async () => {
      // 1. Trava de segurança para evitar concorrência
      if (isSyncingRef.current) return;
      if (!isAuthenticated || !navigator.onLine) return;

      isSyncingRef.current = true;

      try {
        await syncService.syncAllModules(setSyncStatus);
        
        // Atualiza o estado local das configurações caso o sync tenha trazido novos dados
        setSettings(db.getSettings());
        
        setTimeout(() => setSyncStatus('idle'), 5000);
      } catch (error) {
        console.error("Erro no auto sync:", error);
      } finally {
        // Libera a trava sempre
        isSyncingRef.current = false;
      }
    };
    
    // Executa imediatamente ao autenticar
    if (isAuthenticated) {
      runAutoSync();
    }
    
    // Configura intervalo de 30 minutos
    const interval = setInterval(runAutoSync, 30 * 60 * 1000); 
    
    return () => clearInterval(interval);
  }, [isAuthenticated]); // Dependência única para evitar loops

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setEntries(db.getEntries());
    
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [settings.theme]);

  const getSyncStatusIcon = () => {
    if (!isOnline) return <span className="text-red-500 font-bold">📵 SEM REDE</span>;
    switch(syncStatus) {
      case 'syncing': return <span className="text-blue-400 animate-pulse font-bold">🔄 SINCRONIZANDO...</span>;
      case 'success': return <span className="text-emerald-400 font-bold">✅ NUVEM OK</span>;
      case 'error': return <span className="text-red-500 font-bold">⚠️ ERRO SYNC</span>;
      default: return <span className="text-slate-500 font-bold italic">☁️ CONECTADO</span>;
    }
  };

  const refreshEntries = () => setEntries(db.getEntries());

  if (authLoading) return <div className="fixed inset-0 bg-slate-900 flex items-center justify-center text-white">Carregando...</div>;
  if (!supabaseSession) return <Login />;
  if (!isAuthenticated) return <InternalLogin />;
  if (internalUser?.must_change_password) return <ChangePassword />;

  return (
    <div className={`flex flex-col h-full max-w-4xl mx-auto bg-white dark:bg-slate-900 shadow-xl border-x dark:border-slate-800 transition-all duration-200`}>
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-30 shadow-md">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Portaria Express</h1>
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest">
               <span className="text-slate-400">{settings.companyName}</span>
               <span className="text-slate-600">|</span>
               {getSyncStatusIcon()}
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-right">
                <span className="text-[10px] text-blue-400 uppercase font-black block leading-none mb-1">
                  {internalUser?.role === 'admin' ? '⭐ ADMIN' : '👤 PORTEIRO'}
                </span>
                <span className="text-xs font-bold block max-w-[120px] truncate">{internalUser?.username}</span>
             </div>
             <button onClick={logoutInternal} className="bg-red-600/20 text-red-400 p-2.5 rounded-xl border border-red-900/50 active:scale-90 transition-all">
               <Icons.Logout />
             </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto pb-24">
        {(() => {
          const isAdmin = internalUser?.role === 'admin';
          const currentSettings = db.getSettings(); // Garante que as views recebam a versão mais atual do DB
          switch (currentView) {
            case 'DASHBOARD': return <Dashboard onNewArrival={() => setCurrentView('NEW_ENTRY')} activeCount={entries.filter(e => e.entryTime && !e.exitTime).length} onViewActive={() => setCurrentView('ACTIVE_LIST')} onViewShift={() => setCurrentView('SHIFT_MANAGER')} onViewMasterData={() => isAdmin ? setCurrentView('MASTER_DATA') : undefined} onViewContacts={() => setCurrentView('CONTACTS')} onViewBreakfast={() => setCurrentView('BREAKFAST')} onViewPackages={() => setCurrentView('PACKAGES')} onViewMeters={() => setCurrentView('METERS')} onViewLogs={() => isAdmin ? setCurrentView('SYSTEM_LOGS') : undefined} onViewPatrols={() => setCurrentView('PATROLS')} userRole={internalUser?.role} />;
            case 'PATROLS': return <PatrolManager onBack={() => setCurrentView('DASHBOARD')} operatorName={internalUser?.username || ''} />;
            case 'METERS': return <MeterManager onBack={() => setCurrentView('DASHBOARD')} operatorName={internalUser?.username || ''} />;
            case 'PACKAGES': return <PackageManager onBack={() => setCurrentView('DASHBOARD')} operatorName={internalUser?.username || ''} />;
            case 'BREAKFAST': return <BreakfastManager onBack={() => setCurrentView('DASHBOARD')} operatorName={internalUser?.username || ''} />;
            case 'CONTACTS': return <ContactManagement settings={currentSettings} onSave={(s) => { db.saveSettings(s); setSettings(s); setCurrentView('DASHBOARD'); }} onBack={() => setCurrentView('DASHBOARD')} userRole={internalUser?.role} />;
            case 'MASTER_DATA': return <DataManagement onBack={() => setCurrentView('DASHBOARD')} />;
            case 'SHIFT_MANAGER': return <WorkShiftManager onBack={() => setCurrentView('DASHBOARD')} operatorName={internalUser?.username || ''} />;
            case 'NEW_ENTRY': return <NewEntryFlow settings={currentSettings} operatorName={internalUser?.username || ''} onComplete={() => { refreshEntries(); setCurrentView('DASHBOARD'); }} onCancel={() => setCurrentView('DASHBOARD')} />;
            case 'ACTIVE_LIST': return <ActiveVehicles entries={entries.filter(e => e.entryTime && !e.exitTime)} onUpdate={refreshEntries} onBack={() => setCurrentView('DASHBOARD')} />;
            case 'REPORTS': return <Reports entries={entries} onBack={() => setCurrentView('DASHBOARD')} onUpdate={refreshEntries} />;
            case 'SETTINGS': return <Settings settings={currentSettings} onSave={(s) => { db.saveSettings(s); setSettings(s); setCurrentView('DASHBOARD'); }} onBack={() => setCurrentView('DASHBOARD')} onManageUsers={() => setCurrentView('USER_MANAGEMENT')} onSwitchUserRequest={logoutInternal} onLogoutRequest={signOut} />;
            case 'USER_MANAGEMENT': return <UserManagement onBack={() => setCurrentView('DASHBOARD')} />;
            default: return null;
          }
        })()}
      </main>

      <Navbar currentView={currentView} setView={setCurrentView} />
    </div>
  );
};

export default App;
