
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { WorkShift } from '../types';
import { Icons } from '../constants';
import { exportShiftsToCSV } from '../services/utils';

interface WorkShiftManagerProps {
  onBack: () => void;
  operatorName: string;
}

const WorkShiftManager: React.FC<WorkShiftManagerProps> = ({ onBack, operatorName }) => {
  const [shifts, setShifts] = useState<WorkShift[]>(db.getShifts());
  const [currentDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentShift, setCurrentShift] = useState<WorkShift | null>(null);
  
  // Estados para exportação
  const [startDate, setStartDate] = useState(currentDate);
  const [endDate, setEndDate] = useState(currentDate);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    const todayShift = shifts.find(s => s.date === currentDate && s.operatorName === operatorName);
    if (todayShift) {
      setCurrentShift(todayShift);
    }
  }, [shifts, currentDate, operatorName]);

  const handleClockAction = (type: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut') => {
    const now = new Date().toISOString();
    let updatedShift: WorkShift;

    if (!currentShift) {
      updatedShift = {
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        operatorName,
        date: currentDate,
        clockIn: now
      };
    } else {
      updatedShift = { ...currentShift, [type]: now };
    }

    db.updateShift(updatedShift);
    setShifts(db.getShifts());
    setCurrentShift(updatedShift);
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg">
             ←
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Controle de Expediente</h2>
        </div>
        <button 
          onClick={() => setShowExport(!showExport)}
          className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
        >
          {showExport ? 'FECHAR' : 'RELATÓRIO'}
        </button>
      </div>

      {showExport && (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in slide-in-from-top duration-300">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest text-center">Exportar Período</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">DATA INÍCIO</label>
              <input type="date" className="w-full p-2 bg-white dark:bg-slate-900 rounded-lg text-xs" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">DATA FIM</label>
              <input type="date" className="w-full p-2 bg-white dark:bg-slate-900 rounded-lg text-xs" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <button 
            onClick={() => exportShiftsToCSV(shifts, startDate, endDate)}
            className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-3 rounded-xl font-bold text-sm"
          >
            GERAR ARQUIVO CSV
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
         <div className="mb-6">
            <span className="text-4xl font-black text-slate-900 dark:text-slate-100">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mt-1">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
         </div>

         <div className="grid grid-cols-2 gap-4">
            <ShiftCard label="Entrada" time={formatTime(currentShift?.clockIn)} active={!!currentShift?.clockIn} />
            <ShiftCard label="Saída" time={formatTime(currentShift?.clockOut)} active={!!currentShift?.clockOut} />
            <ShiftCard label="Início Almoço" time={formatTime(currentShift?.lunchStart)} active={!!currentShift?.lunchStart} />
            <ShiftCard label="Retorno Almoço" time={formatTime(currentShift?.lunchEnd)} active={!!currentShift?.lunchEnd} />
         </div>

         <div className="mt-8 space-y-3">
            {!currentShift?.clockIn && (
              <ActionButton label="BATER ENTRADA" onClick={() => handleClockAction('clockIn')} color="bg-blue-600" />
            )}
            
            {currentShift?.clockIn && !currentShift?.lunchStart && !currentShift?.clockOut && (
              <ActionButton label="INICIAR ALMOÇO" onClick={() => handleClockAction('lunchStart')} color="bg-yellow-500" />
            )}

            {currentShift?.lunchStart && !currentShift?.lunchEnd && !currentShift?.clockOut && (
              <ActionButton label="RETORNO ALMOÇO" onClick={() => handleClockAction('lunchEnd')} color="bg-green-600" />
            )}

            {currentShift?.clockIn && !currentShift?.clockOut && (
              <ActionButton label="FINALIZAR EXPEDIENTE" onClick={() => handleClockAction('clockOut')} color="bg-red-600" />
            )}
            
            {currentShift?.clockOut && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-500 font-bold text-sm">
                EXPEDIENTE ENCERRADO HOJE
              </div>
            )}
         </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700">
         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Últimos Registros</h3>
         <div className="space-y-3">
            {shifts.slice(-5).reverse().map(s => (
              <div key={s.id} className="flex items-center justify-between text-xs p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div>
                   <span className="font-bold dark:text-slate-200">{s.date}</span>
                   <p className="text-[9px] text-slate-400">{s.operatorName}</p>
                </div>
                <div className="text-right">
                   <span className="font-mono text-blue-500 font-bold">{formatTime(s.clockIn)} → {formatTime(s.clockOut)}</span>
                </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

const ShiftCard = ({ label, time, active }: any) => (
  <div className={`p-4 rounded-2xl border ${active ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
    <span className="block text-[9px] font-black text-slate-400 uppercase mb-1">{label}</span>
    <span className={`text-xl font-black ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-700'}`}>{time}</span>
  </div>
);

const ActionButton = ({ label, onClick, color }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full ${color} text-white p-5 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all uppercase tracking-wide`}
  >
    {label}
  </button>
);

export default WorkShiftManager;
