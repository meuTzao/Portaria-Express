
import React, { useState, useEffect } from 'react';
import { Icons, STORAGE_KEYS } from '../constants';
import { db } from '../services/db';

interface DashboardProps {
  onNewArrival: () => void;
  onViewActive: () => void;
  onViewShift: () => void;
  onViewMasterData: () => void;
  onViewContacts: () => void;
  onViewBreakfast: () => void;
  onViewPackages: () => void;
  onViewMeters: () => void;
  onViewLogs: () => void;
  onViewPatrols: () => void;
  activeCount: number;
  userRole?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onNewArrival, 
  onViewActive, 
  onViewShift, 
  onViewMasterData,
  onViewContacts,
  onViewBreakfast,
  onViewPackages,
  onViewMeters,
  onViewLogs,
  onViewPatrols,
  activeCount,
  userRole
}) => {
  const [pendingCount, setPendingCount] = useState(0);

  // Calcula itens pendentes de sincronização
  useEffect(() => {
    const calculatePending = () => {
      const keys = [
        STORAGE_KEYS.ENTRIES, 
        STORAGE_KEYS.BREAKFAST, 
        STORAGE_KEYS.PACKAGES, 
        STORAGE_KEYS.METERS, 
        STORAGE_KEYS.METER_READINGS, 
        STORAGE_KEYS.PATROLS, 
        STORAGE_KEYS.SHIFTS,
        STORAGE_KEYS.LOGS
      ];
      let total = 0;
      keys.forEach(k => {
        total += db.getUnsyncedItems(k).length;
      });
      setPendingCount(total);
    };

    calculatePending();
    const interval = setInterval(calculatePending, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 flex flex-col gap-6 animate-fade-in">
      {pendingCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 rounded-2xl flex items-center justify-between animate-in slide-in-from-top">
           <div className="flex items-center gap-2">
              <span className="animate-bounce">☁️</span>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                {pendingCount} registros aguardando nuvem
              </span>
           </div>
           <p className="text-[8px] text-slate-400 font-bold uppercase">Sincronização Automática Ativa</p>
        </div>
      )}

      <div className="text-center mt-2">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Menu Principal</h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs">Gestão Operacional de Portaria</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={onNewArrival}
          className="bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white rounded-[32px] p-10 flex flex-col items-center justify-center gap-4 shadow-2xl shadow-blue-200 dark:shadow-none border-b-8 border-blue-800"
        >
          <div className="bg-white/20 p-5 rounded-full scale-125">
            <Icons.Plus />
          </div>
          <span className="text-2xl font-black uppercase tracking-tighter">Nova Chegada</span>
        </button>

        <div className="grid grid-cols-4 gap-2">
           <OperationBtn onClick={onViewBreakfast} color="bg-amber-600" label="Café" icon={<Icons.Coffee />} />
           <OperationBtn onClick={onViewPackages} color="bg-indigo-600" label="Pacotes" icon={<Icons.Package />} />
           <OperationBtn onClick={onViewMeters} color="bg-cyan-600" label="Medidores" icon={<Icons.Chart />} />
           <OperationBtn onClick={onViewPatrols} color="bg-blue-500" label="Rondas" icon={<Icons.Patrol />} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onViewContacts}
            className="bg-green-600 hover:bg-green-700 text-white rounded-2xl p-5 flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <div className="scale-110">
              <Icons.Whatsapp />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-center">Contatos WhatsApp</span>
          </button>
          
          <button
            onClick={onViewShift}
            className="bg-slate-900 dark:bg-slate-700 text-white rounded-2xl p-5 flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <Icons.Clock />
            <span className="text-xs font-bold uppercase tracking-widest text-center">Ponto</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={onViewActive}
          className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-700 p-6 rounded-2xl flex flex-col items-center gap-2 shadow-sm relative transition-colors"
        >
          <div className="text-slate-700 dark:text-slate-200"><Icons.Truck /></div>
          <span className="font-semibold text-slate-700 dark:text-slate-200">No Pátio</span>
          {activeCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-8 h-8 flex items-center justify-center rounded-full border-4 border-white dark:border-slate-900 shadow-md">
              {activeCount}
            </span>
          )}
        </button>
        
        {userRole === 'admin' && (
          <button
            onClick={onViewMasterData}
            className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-6 rounded-2xl flex flex-col items-center gap-2 text-slate-700 dark:text-slate-200 active:scale-95 transition-all shadow-sm"
          >
            <div className="text-blue-500"><Icons.History /></div>
            <span className="font-semibold text-sm">Base de Dados</span>
          </button>
        )}
      </div>

      {userRole === 'admin' && (
        <button
          onClick={onViewLogs}
          className="bg-slate-100 dark:bg-slate-800 p-5 rounded-2xl flex items-center justify-center gap-3 border dark:border-slate-700 active:scale-95 transition-all group"
        >
          <div className="text-slate-400 group-hover:text-cyan-500 transition-colors">
            <Icons.Shield />
          </div>
          <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Auditoria e Logs do Sistema</span>
        </button>
      )}
    </div>
  );
};

const OperationBtn = ({ onClick, color, label, icon }: any) => (
  <button
    onClick={onClick}
    className={`${color} hover:opacity-90 text-white rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all h-20`}
  >
    <div className="scale-90">
      {icon}
    </div>
    <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">{label}</span>
  </button>
);

export default Dashboard;
