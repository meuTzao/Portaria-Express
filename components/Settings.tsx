
import React, { useState, useRef } from 'react';
import { AppSettings, SyncStatus } from '../types';
import { db } from '../services/db';
import { syncService } from '../services/sync';
import { useInternalAuth } from '../context/InternalAuthContext';
import { useAuth } from '../context/AuthContext';
import { Icons } from '../constants';

interface SettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onBack: () => void;
  installPrompt?: any;
  onInstall?: () => void;
  onManageUsers: () => void;
  onSwitchUserRequest: () => void;
  onLogoutRequest: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  settings, 
  onSave, 
  onBack, 
  installPrompt, 
  onInstall, 
  onManageUsers,
  onSwitchUserRequest,
  onLogoutRequest
}) => {
  const { internalUser } = useInternalAuth();
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualSyncStatus, setManualSyncStatus] = useState<SyncStatus>('idle');
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const fontSizes: { id: AppSettings['fontSize'], label: string, icon: string }[] = [
    { id: 'small', label: 'Pequeno', icon: 'A-' },
    { id: 'medium', label: 'Padrão', icon: 'A' },
    { id: 'large', label: 'Grande', icon: 'A+' },
    { id: 'xlarge', label: 'Extra', icon: 'A++' },
  ];

  const handleManualSync = async () => {
    const result = await syncService.syncAllModules(setManualSyncStatus);
    if (!result.success) alert(result.message);
    setTimeout(() => setManualSyncStatus('idle'), 3000);
  };

  const handleExportBackup = () => {
    setIsProcessing(true);
    try {
      const backupStr = db.exportCompleteBackup();
      const date = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
      const filename = `portaria_backup_${date}.json`;
      const blob = new Blob([backupStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      alert("📦 Backup gerado com sucesso! Salve o arquivo para transferir os dados ao próximo colega.");
    } catch (err) {
      alert("Erro ao gerar backup. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("⚠️ ATENÇÃO: Esta ação substituirá TODOS os dados atuais. Deseja continuar?")) {
      e.target.value = '';
      return;
    }
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonStr = event.target?.result as string;
        db.importCompleteBackup(jsonStr);
        alert("✅ Dados restaurados com sucesso!");
        onSave(db.getSettings());
        onBack();
      } catch (err: any) {
        alert(`❌ Erro ao restaurar: ${err.message}`);
      } finally {
        setIsProcessing(false);
        if (restoreInputRef.current) restoreInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 space-y-8 animate-in slide-in-from-right duration-300 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors">
             ←
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Ajustes</h2>
        </div>
        
        <div className="flex gap-2">
          <button onClick={onSwitchUserRequest} className="text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
            Trocar Usuário
          </button>
          {internalUser?.role === 'admin' && (
            <button onClick={onLogoutRequest} className="text-red-500 font-bold text-[10px] uppercase bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/30">
              Sair da Conta
            </button>
          )}
        </div>
      </div>

      {/* SESSÃO DE SINCRONIZAÇÃO - AGORA PARA TODOS */}
      <div className="grid grid-cols-1 gap-4">
         <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-lg flex items-center justify-between animate-in zoom-in">
             <div className="flex-1">
                <h3 className="font-bold text-lg">Sincronizar Nuvem</h3>
                <p className="text-xs opacity-80">
                  {manualSyncStatus === 'syncing' ? 'Enviando e recebendo dados...' : 'Atualize os contatos e registros com o servidor.'}
                </p>
             </div>
             <button 
               onClick={handleManualSync} 
               disabled={manualSyncStatus === 'syncing'}
               className="bg-white text-emerald-600 h-16 w-16 rounded-2xl font-black shadow-md active:scale-95 transition-transform flex items-center justify-center shrink-0 ml-4"
             >
               {manualSyncStatus === 'syncing' ? <div className="animate-spin w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full"/> : <Icons.Sync />}
             </button>
         </div>
      </div>

      {internalUser?.role === 'admin' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
             <div className="bg-blue-600 text-white p-6 rounded-3xl shadow-lg flex items-center justify-between animate-in zoom-in">
                 <div>
                    <h3 className="font-bold text-lg">Gerenciar Usuários</h3>
                    <p className="text-xs opacity-80">Criar contas para novos porteiros.</p>
                 </div>
                 <button onClick={onManageUsers} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-black text-xs uppercase shadow-md active:scale-95 transition-transform">
                   Gerenciar
                 </button>
             </div>
          </div>
          
          <div className="space-y-4 bg-amber-50 dark:bg-amber-900/10 p-6 rounded-3xl border border-amber-200 dark:border-amber-900/30">
            <div className="flex items-center gap-3 mb-2">
               <span className="text-xl">📦</span>
               <h3 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Backup por Arquivo</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
               <button onClick={handleExportBackup} disabled={isProcessing} className="bg-amber-600 disabled:opacity-50 text-white p-4 rounded-2xl font-bold text-[10px] uppercase shadow-lg active:scale-95 transition-all">
                 {isProcessing ? "Gerando..." : "Exportar JSON"}
               </button>
               <button onClick={() => restoreInputRef.current?.click()} disabled={isProcessing} className="bg-white dark:bg-slate-800 border-2 border-amber-600 disabled:opacity-50 text-amber-700 dark:text-amber-400 p-4 rounded-2xl font-bold text-[10px] uppercase active:scale-95 transition-all">
                 {isProcessing ? "Importar JSON" : "Importar JSON"}
               </button>
               <input type="file" ref={restoreInputRef} className="hidden" accept=".json" onChange={handleRestoreBackup} />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {installPrompt && (
          <div className="bg-slate-800 p-6 rounded-3xl text-white shadow-lg flex items-center justify-between">
            <div>
              <h3 className="font-bold">Instalar PWA</h3>
              <p className="text-xs opacity-80">Usar como aplicativo nativo.</p>
            </div>
            <button onClick={onInstall} className="bg-white text-slate-800 px-4 py-2 rounded-xl font-bold text-xs">INSTALAR</button>
          </div>
        )}

        {internalUser?.role === 'admin' && (
          <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border dark:border-slate-700">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Identificação da Unidade</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Nome do Dispositivo</label>
                <input
                  className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border-none text-sm dark:text-white"
                  value={formData.deviceName}
                  onChange={e => setFormData({ ...formData, deviceName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Nome da Empresa/Condomínio</label>
                <input
                  className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border-none text-sm dark:text-white"
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border dark:border-slate-700">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Aparência</h3>
          <div>
             <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Tamanho do Texto</label>
             <div className="grid grid-cols-4 gap-2">
               {fontSizes.map((size) => (
                 <button
                   key={size.id}
                   onClick={() => setFormData({ ...formData, fontSize: size.id })}
                   className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                     formData.fontSize === size.id ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                   }`}
                 >
                   <span className="text-lg font-black">{size.icon}</span>
                   <span className="text-[9px] uppercase font-bold mt-1">{size.label}</span>
                 </button>
               ))}
             </div>
          </div>

          <div className="pt-2">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Modo Noturno</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormData({ ...formData, theme: 'light' })}
                className={`p-4 rounded-xl border-2 font-bold transition-all ${
                  formData.theme === 'light' ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                }`}
              >
                ☀️ Claro
              </button>
              <button
                onClick={() => setFormData({ ...formData, theme: 'dark' })}
                className={`p-4 rounded-xl border-2 font-bold transition-all ${
                  formData.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                }`}
              >
                🌙 Escuro
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => onSave(formData)}
          className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-6 rounded-2xl text-xl font-bold shadow-lg transition-all active:scale-[0.98]"
        >
          SALVAR TUDO
        </button>
      </div>
    </div>
  );
};

export default Settings;
