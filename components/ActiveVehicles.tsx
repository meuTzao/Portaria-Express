
import React, { useState } from 'react';
import { VehicleEntry, EntryStatus, AccessType } from '../types';
import { Icons } from '../constants';
import { db } from '../services/db';
import { formatDateTime } from '../services/utils';

interface ActiveVehiclesProps {
  entries: VehicleEntry[];
  onUpdate: () => void;
  onBack: () => void;
}

const ActiveVehicles: React.FC<ActiveVehiclesProps> = ({ entries, onUpdate, onBack }) => {
  const [selectedEntry, setSelectedEntry] = useState<VehicleEntry | null>(null);
  const [exitObs, setExitObs] = useState('');
  const [exitVolumes, setExitVolumes] = useState<string>('');

  const handleSelectEntry = (entry: VehicleEntry) => {
    setSelectedEntry(entry);
    setExitObs('');
    setExitVolumes(entry.volumes !== undefined && entry.volumes !== null ? String(entry.volumes) : '');
  };

  const handleRegisterExit = () => {
    if (!selectedEntry) return;

    const updated: VehicleEntry = {
      ...selectedEntry,
      exitTime: new Date().toISOString(),
      status: EntryStatus.FINALIZADO,
      exitObservations: exitObs,
      volumes: exitVolumes ? parseInt(exitVolumes, 10) : 0
    };

    db.updateEntry(updated);
    setSelectedEntry(null);
    setExitObs('');
    setExitVolumes('');
    onUpdate();
  };

  return (
    <div className="p-4 space-y-4 transition-colors">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={onBack} className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors">
           ←
        </button>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Veículos no Pátio</h2>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 transition-colors">
           <p className="text-slate-400 dark:text-slate-600">Nenhum veículo no pátio no momento.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {entries.map(entry => (
            <div key={entry.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex justify-between items-center group transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{entry.driverName}</span>
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded font-mono uppercase border border-blue-200 dark:border-blue-800">{entry.vehiclePlate}</span>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{entry.company}</div>
                
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded font-bold uppercase tracking-wider">
                    📍 {entry.sector || 'S/D'}
                  </span>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium">
                    <Icons.History /> E: {new Date(entry.entryTime!).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => handleSelectEntry(entry)}
                className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm ml-2 active:scale-95 transition-all"
              >
                🚪 SAÍDA
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Registrar Saída</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Confirmar saída de <strong>{selectedEntry.driverName}</strong>?
            </p>

            {/* Information Check Block */}
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl mb-4 border border-blue-100 dark:border-blue-800">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1">
                  <span className="block text-[10px] font-bold text-blue-400 dark:text-blue-300 uppercase mb-1">Transportadora</span>
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{selectedEntry.company}</span>
                </div>
                <div className="col-span-1">
                   <span className="block text-[10px] font-bold text-blue-400 dark:text-blue-300 uppercase mb-1">Destinatário</span>
                   <span className="block text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{selectedEntry.supplier || '-'}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[10px] font-bold text-blue-400 dark:text-blue-300 uppercase mb-1">Setor de Destino</span>
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{selectedEntry.sector || 'N/A'}</span>
                </div>
              </div>
            </div>
            
            <div className="mb-6 space-y-4">
              {/* Only show volumes for vehicles (exclude pedestrians) */}
              {selectedEntry.accessType !== AccessType.PEDESTRE && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Qtd Volumes (Conferência)</label>
                  <input
                    type="number"
                    className="w-full p-4 bg-slate-100 dark:bg-slate-900/50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-lg dark:text-slate-100 font-mono"
                    placeholder="0"
                    value={exitVolumes}
                    onChange={e => setExitVolumes(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Obs de Saída</label>
                <textarea
                  className="w-full p-4 bg-slate-100 dark:bg-slate-900/50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-slate-100 dark:placeholder-slate-700"
                  placeholder="Ex: Tudo OK, lacre verificado..."
                  rows={3}
                  value={exitObs}
                  onChange={e => setExitObs(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedEntry(null)}
                className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 p-4 rounded-xl font-bold transition-colors"
              >
                VOLTAR
              </button>
              <button
                onClick={handleRegisterExit}
                className="flex-2 bg-red-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-red-100 dark:shadow-red-900/10 active:scale-95 transition-all"
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveVehicles;
