
import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { AppLog } from '../types';

interface SystemLogsProps {
  onBack: () => void;
}

const SystemLogs: React.FC<SystemLogsProps> = ({ onBack }) => {
  const [logs] = useState<AppLog[]>(db.getLogs());
  const [filterText, setFilterText] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('Todos');

  const filteredLogs = useMemo(() => {
    return logs
      .filter(log => {
        const matchesModule = selectedModule === 'Todos' || log.module === selectedModule;
        const matchesText = 
          log.user.toLowerCase().includes(filterText.toLowerCase()) ||
          log.action.toLowerCase().includes(filterText.toLowerCase()) ||
          (log.details || '').toLowerCase().includes(filterText.toLowerCase());
        return matchesModule && matchesText;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, filterText, selectedModule]);

  const modules = ['Todos', 'Café', 'Encomendas', 'Portaria', 'Medidores', 'Sistema', 'Ponto'];

  const getModuleColor = (mod: string) => {
    switch (mod) {
      case 'Café': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Encomendas': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Portaria': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Medidores': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'Sistema': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-right duration-300 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg">
           ←
        </button>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Histórico do Sistema</h2>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
           {modules.map(m => (
             <button
              key={m}
              onClick={() => setSelectedModule(m)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap border-2 ${
                selectedModule === m 
                ? 'bg-slate-900 border-slate-900 text-white' 
                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
              }`}
             >
               {m}
             </button>
           ))}
        </div>

        <input
          className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none text-sm dark:text-white"
          placeholder="Filtrar por usuário ou ação..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-20 text-slate-400 italic text-sm">Nenhum registro de log encontrado.</div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start">
                 <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${getModuleColor(log.module)}`}>
                      {log.module}
                    </span>
                    <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase truncate">{log.action}</span>
                 </div>
                 <span className="text-[9px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</span>
              </div>
              
              <div className="flex justify-between items-end border-t dark:border-slate-700 pt-2 mt-1">
                 <div className="flex-1">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
                      {log.details || "Ação padrão registrada."}
                    </p>
                 </div>
                 <div className="text-right ml-4">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase">Usuário</span>
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">{log.user}</span>
                 </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700 text-center">
         <p className="text-[10px] font-bold text-slate-400 uppercase">Os logs são imutáveis e salvos em cada backup de turno.</p>
      </div>
    </div>
  );
};

export default SystemLogs;
