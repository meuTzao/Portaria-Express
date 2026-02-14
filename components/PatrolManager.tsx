
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db } from '../services/db';
import { PatrolRecord, PatrolPhoto, PatrolStatus } from '../types';
import { optimizeImage, generatePatrolsPDF } from '../services/utils';
import { Icons } from '../constants';

interface PatrolManagerProps {
  onBack: () => void;
  operatorName: string;
}

type PatrolView = 'LIST' | 'ACTIVE' | 'REPORT' | 'HISTORY_DETAIL';

const PatrolManager: React.FC<PatrolManagerProps> = ({ onBack, operatorName }) => {
  const [view, setView] = useState<PatrolView>('LIST');
  const [patrols, setPatrols] = useState<PatrolRecord[]>(db.getPatrols());
  const [activePatrol, setActivePatrol] = useState<PatrolRecord | null>(null);
  const [selectedPatrol, setSelectedPatrol] = useState<PatrolRecord | null>(null);
  
  // States para Relatório
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // States para Long Press (Exclusão)
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Verifica se há ronda em andamento deste porteiro
    const ongoing = patrols.find(p => p.status === 'EM_ANDAMENTO' && p.porteiro === operatorName);
    if (ongoing) {
      setActivePatrol(ongoing);
      setView('ACTIVE');
    }
  }, [patrols, operatorName]);

  const handleStartPatrol = () => {
    const newPatrol: PatrolRecord = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      data: new Date().toISOString().split('T')[0],
      horaInicio: new Date().toISOString(),
      horaFim: null,
      duracaoMinutos: null,
      porteiro: operatorName,
      status: 'EM_ANDAMENTO',
      observacoes: '',
      fotos: [],
      criadoEm: new Date().toISOString()
    };
    db.addPatrol(newPatrol);
    setPatrols(db.getPatrols());
    setActivePatrol(newPatrol);
    setView('ACTIVE');
  };

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePatrol) return;
    
    setIsLoading(true);
    try {
      const b64 = await optimizeImage(file);
      const newPhoto: PatrolPhoto = {
        id: Math.random().toString(36).substr(2, 6).toUpperCase(),
        imagemBase64: b64
      };
      const updated = { ...activePatrol, fotos: [...activePatrol.fotos, newPhoto] };
      setActivePatrol(updated);
      db.updatePatrol(updated);
    } catch (err) {
      alert("Erro ao processar imagem.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishPatrol = () => {
    if (!activePatrol) return;
    const now = new Date();
    const start = new Date(activePatrol.horaInicio);
    const duration = Math.round((now.getTime() - start.getTime()) / 60000);

    const finished: PatrolRecord = {
      ...activePatrol,
      status: 'CONCLUIDA',
      horaFim: now.toISOString(),
      duracaoMinutos: duration
    };
    db.updatePatrol(finished);
    setPatrols(db.getPatrols());
    setActivePatrol(null);
    setView('LIST');
    alert("Ronda concluída com sucesso!");
  };

  const startHold = (id: string) => {
    setHoldId(id);
    setHoldProgress(0);
    const startTime = Date.now();
    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / 2000) * 100, 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdIntervalRef.current!);
        holdIntervalRef.current = null;
        if (confirm("Deseja realmente excluir esta ronda?")) {
           db.deletePatrol(id);
           setPatrols(db.getPatrols());
        }
        setHoldId(null);
        setHoldProgress(0);
      }
    }, 50);
  };

  const stopHold = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldId(null);
    setHoldProgress(0);
  };

  const handleGenerateReport = async () => {
    const filtered = patrols.filter(p => p.data >= startDate && p.data <= endDate && p.status === 'CONCLUIDA');
    if (filtered.length === 0) {
      alert("Nenhuma ronda concluída neste período.");
      return;
    }
    setIsLoading(true);
    await generatePatrolsPDF(filtered, startDate, endDate, operatorName);
    setIsLoading(false);
    setView('LIST');
  };

  const sortedHistory = useMemo(() => {
    return [...patrols]
      .filter(p => p.status === 'CONCLUIDA')
      .sort((a, b) => new Date(b.horaInicio).getTime() - new Date(a.horaInicio).getTime());
  }, [patrols]);

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-right duration-300 pb-20">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => view === 'LIST' ? onBack() : setView('LIST')} 
            className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg"
          >
             ←
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Rondas</h2>
        </div>
        {view === 'LIST' && (
          <button 
            onClick={() => setView('REPORT')}
            className="text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 px-3 py-2 rounded-lg border dark:border-slate-700 uppercase"
          >
            📄 Relatório PDF
          </button>
        )}
      </div>

      {/* VIEW: LISTAGEM */}
      {view === 'LIST' && (
        <div className="space-y-6">
          <button
            onClick={handleStartPatrol}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-8 rounded-3xl flex flex-col items-center gap-3 shadow-xl shadow-blue-200 dark:shadow-none active:scale-95 transition-all"
          >
            <div className="bg-white/20 p-4 rounded-full">
               <Icons.Patrol />
            </div>
            <span className="text-2xl font-black uppercase tracking-widest">Iniciar Ronda</span>
          </button>

          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Histórico Recente</h3>
            {sortedHistory.length === 0 ? (
              <div className="text-center py-10 text-slate-400 italic text-xs">Nenhuma ronda concluída ainda.</div>
            ) : (
              sortedHistory.map(p => (
                <div 
                  key={p.id}
                  onPointerDown={() => startHold(p.id)}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onClick={() => { setSelectedPatrol(p); setView('HISTORY_DETAIL'); }}
                  className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between relative overflow-hidden active:scale-[0.98] transition-all"
                >
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                         <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{p.data.split('-').reverse().slice(0,2).join('/')}</span>
                         <span className="text-[10px] text-slate-400 font-mono">{new Date(p.horaInicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      </div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase text-sm">Ronda Concluída</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Duração: {p.duracaoMinutos} min • {p.porteiro.split(' ')[0]}</p>
                   </div>
                   <div className="flex items-center gap-3">
                      {p.fotos.length > 0 && <span className="text-lg">📷</span>}
                      <span className="text-slate-300">›</span>
                   </div>
                   {holdId === p.id && (
                     <div className="absolute inset-x-0 bottom-0 h-1 bg-red-500 transition-all duration-75" style={{ width: `${holdProgress}%` }} />
                   )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW: RONDA ATIVA */}
      {view === 'ACTIVE' && activePatrol && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
           <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-3xl border border-amber-200 dark:border-amber-900/30 text-center space-y-2">
              <div className="animate-pulse w-3 h-3 bg-amber-500 rounded-full mx-auto"></div>
              <h3 className="text-amber-700 dark:text-amber-400 font-black uppercase tracking-widest text-lg">Ronda em Andamento</h3>
              <p className="text-[10px] font-bold text-amber-600/70 uppercase">Iniciada às {new Date(activePatrol.horaInicio).toLocaleTimeString()}</p>
           </div>

           <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Observações da Ronda</label>
                <textarea 
                  className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
                  placeholder="Relate anormalidades, lâmpadas queimadas, portas abertas..."
                  rows={4}
                  value={activePatrol.observacoes}
                  onChange={e => {
                    const updated = { ...activePatrol, observacoes: e.target.value };
                    setActivePatrol(updated);
                    db.updatePatrol(updated);
                  }}
                />
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Registros Fotográficos ({activePatrol.fotos.length})</label>
                <div className="grid grid-cols-3 gap-2">
                   {activePatrol.fotos.map(f => (
                     <div key={f.id} className="aspect-square bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden border dark:border-slate-700">
                        <img src={f.imagemBase64} className="w-full h-full object-cover" alt="Ronda" />
                     </div>
                   ))}
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="aspect-square bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 active:bg-slate-100 transition-colors"
                   >
                     {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div> : <span className="text-2xl">📷</span>}
                   </button>
                   <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleAddPhoto} />
                </div>
              </div>
           </div>

           <button 
             onClick={handleFinishPatrol}
             className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-6 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all mt-4"
           >
             ⏹ Finalizar Ronda
           </button>
        </div>
      )}

      {/* VIEW: RELATÓRIO PDF */}
      {view === 'REPORT' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 space-y-6 animate-in zoom-in duration-300">
           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Data Inicial</label>
                 <input 
                   type="date"
                   className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border-none text-sm dark:text-white"
                   value={startDate}
                   onChange={e => setStartDate(e.target.value)}
                 />
              </div>
              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Data Final</label>
                 <input 
                   type="date"
                   className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border-none text-sm dark:text-white"
                   value={endDate}
                   onChange={e => setEndDate(e.target.value)}
                 />
              </div>
           </div>

           <button 
             onClick={handleGenerateReport}
             disabled={isLoading}
             className="w-full bg-blue-600 disabled:bg-slate-300 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
           >
             {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : "📄 GERAR PDF DE RONDAS"}
           </button>
        </div>
      )}

      {/* VIEW: DETALHE DO HISTÓRICO */}
      {view === 'HISTORY_DETAIL' && selectedPatrol && (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
           <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border dark:border-slate-800">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <span className="block text-[10px] font-black text-slate-400 uppercase">Porteiro</span>
                   <span className="font-bold dark:text-white uppercase text-sm">{selectedPatrol.porteiro}</span>
                 </div>
                 <div className="text-right">
                   <span className="block text-[10px] font-black text-slate-400 uppercase">Duração</span>
                   <span className="font-bold text-blue-600 text-sm">{selectedPatrol.duracaoMinutos} min</span>
                 </div>
                 <div>
                   <span className="block text-[10px] font-black text-slate-400 uppercase">Início</span>
                   <span className="font-mono text-xs dark:text-slate-300">{new Date(selectedPatrol.horaInicio).toLocaleTimeString()}</span>
                 </div>
                 <div className="text-right">
                   <span className="block text-[10px] font-black text-slate-400 uppercase">Fim</span>
                   <span className="font-mono text-xs dark:text-slate-300">{selectedPatrol.horaFim ? new Date(selectedPatrol.horaFim).toLocaleTimeString() : '--:--'}</span>
                 </div>
              </div>
           </div>

           <div className="space-y-2">
              <span className="block text-[10px] font-black text-slate-400 uppercase ml-1">Relato</span>
              <p className="bg-white dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700 text-sm dark:text-slate-200 italic">
                {selectedPatrol.observacoes || "Nenhuma observação registrada nesta ronda."}
              </p>
           </div>

           {selectedPatrol.fotos.length > 0 && (
             <div className="space-y-2">
                <span className="block text-[10px] font-black text-slate-400 uppercase ml-1">Fotos do Percurso</span>
                <div className="grid grid-cols-2 gap-2">
                   {selectedPatrol.fotos.map(f => (
                     <div key={f.id} className="rounded-2xl overflow-hidden border dark:border-slate-700">
                        <img src={f.imagemBase64} className="w-full" alt="Ronda Detail" />
                     </div>
                   ))}
                </div>
             </div>
           )}

           <button 
             onClick={() => setView('LIST')}
             className="w-full p-5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-3xl font-black uppercase tracking-widest"
           >
             Voltar ao Histórico
           </button>
        </div>
      )}
    </div>
  );
};

export default PatrolManager;
