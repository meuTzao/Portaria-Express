
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db } from '../services/db';
import { Meter, MeterReading, MeterType, MeterUnit } from '../types';
import { optimizeImage, generateMetersPDF } from '../services/utils';
import { Icons } from '../constants';
import { useInternalAuth } from '../context/InternalAuthContext';

interface MeterManagerProps {
  onBack: () => void;
  operatorName: string;
}

type SubView = 'LIST' | 'ADD_METER' | 'NEW_READING' | 'HISTORY' | 'VIEW_PHOTO' | 'REPORT_OPTIONS';

const MeterManager: React.FC<MeterManagerProps> = ({ onBack, operatorName }) => {
  const { internalUser } = useInternalAuth(); // Access user role
  const [subView, setSubView] = useState<SubView>('LIST');
  const [meters, setMeters] = useState<Meter[]>(db.getMeters());
  const [selectedMeter, setSelectedMeter] = useState<Meter | null>(null);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [selectedReading, setSelectedReading] = useState<MeterReading | null>(null);
  
  // States para Formulários
  const [newMeterForm, setNewMeterForm] = useState<Partial<Meter>>({
    name: '', type: 'Água', unit: 'm³', active: true
  });
  
  const [readingForm, setReadingForm] = useState({
    value: '', photo: '', observation: ''
  });

  // States para Relatório PDF
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMeterIds, setSelectedMeterIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega histórico quando seleciona medidor
  const openHistory = (meter: Meter) => {
    setSelectedMeter(meter);
    setReadings(db.getReadingsByMeter(meter.id));
    setSubView('HISTORY');
  };

  const openNewReading = (meter: Meter) => {
    setSelectedMeter(meter);
    setReadingForm({ value: '', photo: '', observation: '' });
    setSubView('NEW_READING');
  };

  const handleAddMeter = () => {
    if (!newMeterForm.name) {
      setErrorMessage("Nome do medidor é obrigatório.");
      return;
    }
    try {
      const meter: Meter = {
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        name: newMeterForm.name,
        type: (newMeterForm.type as MeterType) || 'Outro',
        unit: (newMeterForm.unit as MeterUnit) || 'Personalizado',
        customUnit: newMeterForm.customUnit,
        active: true,
        createdAt: new Date().toISOString()
      };
      db.addMeter(meter);
      setMeters(db.getMeters());
      setSubView('LIST');
      setNewMeterForm({ name: '', type: 'Água', unit: 'm³', active: true });
      setErrorMessage('');
    } catch (e: any) {
      setErrorMessage(e.message);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const optimized = await optimizeImage(file);
      setReadingForm(prev => ({ ...prev, photo: optimized }));
    } catch (err) {
      setErrorMessage("Erro ao processar foto.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveReading = () => {
    if (!readingForm.value || !readingForm.photo) {
      alert("Valor da leitura e foto são obrigatórios.");
      return;
    }

    const val = parseFloat(readingForm.value);
    const lastReadings = db.getReadingsByMeter(selectedMeter!.id);
    const lastValue = lastReadings.length > 0 ? lastReadings[0].value : 0;

    if (val < lastValue) {
      if (!confirm(`⚠️ Leitura (${val}) menor que a anterior (${lastValue}). Confirmar mesmo assim?`)) return;
    }

    const consumption = lastReadings.length > 0 ? val - lastValue : 0;

    const reading: MeterReading = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      meterId: selectedMeter!.id,
      value: val,
      consumption: consumption,
      photo: readingForm.photo,
      observation: readingForm.observation,
      operator: operatorName,
      timestamp: new Date().toISOString()
    };

    db.addReading(reading);
    setSubView('LIST');
    alert("Leitura salva com sucesso!");
  };

  const handleToggleMeterSelection = (id: string) => {
    setSelectedMeterIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const handleGeneratePDF = async () => {
    if (selectedMeterIds.length === 0) {
      alert("Selecione ao menos um medidor para o relatório.");
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const selectedMeters = meters.filter(m => selectedMeterIds.includes(m.id));
      await generateMetersPDF(selectedMeters, reportStartDate, reportEndDate, operatorName);
      setSubView('LIST');
    } catch (err: any) {
      console.error("PDF Error:", err);
      setErrorMessage("Falha ao gerar o PDF. Verifique se as fotos são muito grandes ou se há erro nos dados.");
      alert(`Erro técnico: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMeter = (id: string) => {
    if (confirm("Apenas Supervisor: Deseja desativar/excluir este medidor? O histórico não será apagado.")) {
      db.deleteMeter(id);
      setMeters(db.getMeters());
    }
  };

  const meterSummaries = useMemo(() => {
    return meters.map(m => {
      const history = db.getReadingsByMeter(m.id);
      return {
        ...m,
        lastReading: history[0] || null
      };
    });
  }, [meters, subView]);

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-right duration-300 pb-20">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => subView === 'LIST' ? onBack() : setSubView('LIST')} 
            className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
          >
             ←
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
            {subView === 'LIST' && "Medidores"}
            {subView === 'ADD_METER' && "Novo Medidor"}
            {subView === 'NEW_READING' && "Nova Leitura"}
            {subView === 'HISTORY' && "Histórico"}
            {subView === 'VIEW_PHOTO' && "Foto"}
            {subView === 'REPORT_OPTIONS' && "Relatório PDF"}
          </h2>
        </div>
        {subView === 'LIST' && (
          <div className="flex gap-2">
            <button 
              onClick={() => setSubView('REPORT_OPTIONS')}
              className="text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 px-3 py-2 rounded-lg shadow-sm border dark:border-slate-700 flex items-center gap-1 uppercase"
            >
              📄 RELATÓRIO
            </button>
            <button 
              onClick={() => setSubView('ADD_METER')}
              className="text-[10px] font-bold bg-cyan-600 text-white px-3 py-2 rounded-lg shadow-md uppercase"
            >
              + ADICIONAR
            </button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold border border-red-100 animate-pulse">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* VIEW: LISTAGEM DE MEDIDORES */}
      {subView === 'LIST' && (
        <div className="grid grid-cols-1 gap-4">
          {meterSummaries.length === 0 ? (
            <div className="text-center py-20 text-slate-400 italic text-sm">Nenhum medidor cadastrado.</div>
          ) : (
            meterSummaries.map(m => (
              <div key={m.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                       <h3 className="font-bold text-slate-800 dark:text-white uppercase truncate">{m.name}</h3>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.type} • {m.unit}</span>
                  </div>
                  {/* BOTÃO EXCLUIR: Apenas Admin */}
                  {internalUser?.role === 'admin' && (
                    <button onClick={() => handleDeleteMeter(m.id)} className="text-slate-300 hover:text-red-500">🗑️</button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border dark:border-slate-700">
                  <div>
                    <span className="block text-[8px] font-black text-slate-400 uppercase">Última Leitura</span>
                    <span className="font-bold dark:text-white">{m.lastReading?.value || "N/A"}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-black text-slate-400 uppercase">Último Consumo</span>
                    <span className="font-bold text-cyan-600">{m.lastReading?.consumption || 0} {m.unit}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => openHistory(m)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[10px] uppercase active:scale-95 transition-all"
                  >
                    📊 Histórico
                  </button>
                  <button 
                    onClick={() => openNewReading(m)}
                    className="flex-1 py-3 bg-cyan-600 text-white rounded-xl font-bold text-[10px] uppercase shadow-lg shadow-cyan-200 dark:shadow-none active:scale-95 transition-all"
                  >
                    ➕ Nova Leitura
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ... [Restante do código igual] ... */}
      
      {/* VIEW: OPÇÕES DE RELATÓRIO */}
      {subView === 'REPORT_OPTIONS' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 space-y-6 animate-in zoom-in duration-300">
           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Data Inicial</label>
                 <input 
                   type="date"
                   className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border-none text-sm dark:text-white"
                   value={reportStartDate}
                   onChange={e => setReportStartDate(e.target.value)}
                 />
              </div>
              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Data Final</label>
                 <input 
                   type="date"
                   className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border-none text-sm dark:text-white"
                   value={reportEndDate}
                   onChange={e => setReportEndDate(e.target.value)}
                 />
              </div>
           </div>

           <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Selecione os Medidores</label>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                 {meters.map(m => (
                   <div 
                    key={m.id}
                    onClick={() => handleToggleMeterSelection(m.id)}
                    className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      selectedMeterIds.includes(m.id) 
                      ? 'bg-cyan-50 border-cyan-500 dark:bg-cyan-900/20' 
                      : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                    }`}
                   >
                      <div>
                        <span className="block font-bold dark:text-white uppercase text-sm">{m.name}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-black">{m.type}</span>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMeterIds.includes(m.id) ? 'bg-cyan-600 border-cyan-600' : 'border-slate-300 dark:border-slate-600'}`}>
                         {selectedMeterIds.includes(m.id) && <span className="text-white text-xs">✓</span>}
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <button 
             onClick={handleGeneratePDF}
             disabled={isLoading || selectedMeterIds.length === 0}
             className="w-full bg-cyan-600 disabled:bg-slate-300 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
           >
             {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : "📄 GERAR RELATÓRIO PDF"}
           </button>
        </div>
      )}

      {/* VIEW: ADICIONAR MEDIDOR */}
      {subView === 'ADD_METER' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 space-y-6 animate-in zoom-in duration-300">
           <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Nome do Medidor</label>
              <input 
                autoFocus
                className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-cyan-500 text-sm dark:text-white"
                placeholder="Ex: Registro Geral, Galpão A..."
                value={newMeterForm.name}
                onChange={e => setNewMeterForm({...newMeterForm, name: e.target.value})}
              />
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Tipo</label>
                <select 
                  className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border-none text-sm dark:text-white"
                  value={newMeterForm.type}
                  onChange={e => setNewMeterForm({...newMeterForm, type: e.target.value as MeterType})}
                >
                  <option value="Água">Água</option>
                  <option value="Energia">Energia</option>
                  <option value="Gás">Gás</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Unidade</label>
                <select 
                  className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border-none text-sm dark:text-white"
                  value={newMeterForm.unit}
                  onChange={e => setNewMeterForm({...newMeterForm, unit: e.target.value as MeterUnit})}
                >
                  <option value="m³">m³ (Água/Gás)</option>
                  <option value="kWh">kWh (Energia)</option>
                  <option value="Litros">Litros</option>
                  <option value="Personalizado">Outro</option>
                </select>
              </div>
           </div>

           {newMeterForm.unit === 'Personalizado' && (
             <div className="animate-in slide-in-from-top">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Qual Unidade?</label>
                <input 
                  className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-cyan-500 text-sm dark:text-white"
                  placeholder="Ex: Bar, PSI, Kg..."
                  value={newMeterForm.customUnit}
                  onChange={e => setNewMeterForm({...newMeterForm, customUnit: e.target.value})}
                />
             </div>
           )}

           <button 
             onClick={handleAddMeter}
             className="w-full bg-cyan-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
           >
             CADASTRAR MEDIDOR
           </button>
        </div>
      )}

      {/* VIEW: NOVA LEITURA */}
      {subView === 'NEW_READING' && selectedMeter && (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
           <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <h3 className="font-black text-cyan-600 uppercase tracking-widest">{selectedMeter.name}</h3>
                <span className="text-[10px] text-slate-400 font-bold uppercase">{selectedMeter.unit}</span>
              </div>
              <div className="text-right">
                <span className="block text-[8px] font-black text-slate-400 uppercase">Anterior</span>
                <span className="font-bold dark:text-slate-200">
                  {db.getReadingsByMeter(selectedMeter.id)[0]?.value || 0}
                </span>
              </div>
           </div>

           <div className="space-y-4">
              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Valor da Leitura Atual</label>
                 <input 
                   type="number"
                   autoFocus
                   inputMode="decimal"
                   className="w-full p-6 bg-slate-100 dark:bg-slate-800 rounded-3xl border-none focus:ring-4 focus:ring-cyan-500/20 text-3xl font-black dark:text-white text-center"
                   placeholder="0.00"
                   value={readingForm.value}
                   onChange={e => setReadingForm({...readingForm, value: e.target.value})}
                 />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Foto do Medidor (Obrigatório)</label>
                {!readingForm.photo ? (
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-40 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-400 active:bg-slate-50 transition-colors"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                    ) : (
                      <>
                        <div className="text-4xl">📷</div>
                        <span className="text-[10px] font-black uppercase">Toque para Tirar Foto</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="relative group rounded-3xl overflow-hidden border-2 border-cyan-500">
                     <img src={readingForm.photo} className="w-full h-48 object-cover" alt="Preview" />
                     <button 
                        onClick={() => setReadingForm({...readingForm, photo: ''})}
                        className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg"
                     >
                       ✕
                     </button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Observação</label>
                <textarea 
                  className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none text-sm dark:text-white"
                  placeholder="Opcional..."
                  rows={2}
                  value={readingForm.observation}
                  onChange={e => setReadingForm({...readingForm, observation: e.target.value})}
                />
              </div>
           </div>

           <button 
             onClick={handleSaveReading}
             disabled={!readingForm.value || !readingForm.photo || isLoading}
             className="w-full bg-cyan-600 disabled:bg-slate-300 text-white p-6 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all mt-4"
           >
             ✅ SALVAR LEITURA
           </button>
        </div>
      )}

      {/* VIEW: HISTÓRICO */}
      {subView === 'HISTORY' && selectedMeter && (
        <div className="space-y-4 animate-in slide-in-from-bottom duration-300">
           <div className="bg-cyan-50 dark:bg-cyan-900/10 p-4 rounded-2xl border border-cyan-100 dark:border-cyan-800">
              <h3 className="font-black text-cyan-600 text-lg uppercase">{selectedMeter.name}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Relatório Geral de Consumo</p>
           </div>

           <div className="space-y-2">
              {readings.length === 0 ? (
                <div className="text-center py-20 text-slate-400 italic text-sm">Nenhuma leitura registrada.</div>
              ) : (
                readings.map(r => (
                  <div key={r.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div className="flex-1">
                       <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-slate-400">{new Date(r.timestamp).toLocaleString([], {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <span className="block text-[8px] font-black text-slate-400 uppercase">Leitura</span>
                             <span className="font-bold dark:text-white">{r.value}</span>
                          </div>
                          <div>
                             <span className="block text-[8px] font-black text-slate-400 uppercase">Consumo</span>
                             <span className="font-bold text-cyan-600">+{r.consumption} {selectedMeter.unit}</span>
                          </div>
                       </div>
                       <p className="text-[9px] text-slate-400 mt-2 italic">Por: {r.operator}</p>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setSelectedReading(r);
                        setSubView('VIEW_PHOTO');
                      }}
                      className="ml-4 w-12 h-12 rounded-xl overflow-hidden border dark:border-slate-600 active:scale-90 transition-all"
                    >
                      <img src={r.photo} className="w-full h-full object-cover" alt="Meter" />
                    </button>
                  </div>
                ))
              )}
           </div>
        </div>
      )}

      {/* VIEW: FOTO AMPLIADA */}
      {subView === 'VIEW_PHOTO' && selectedReading && (
        <div className="animate-in fade-in zoom-in duration-300 space-y-4">
           <div className="bg-white dark:bg-slate-800 p-2 rounded-3xl shadow-2xl">
              <img src={selectedReading.photo} className="w-full rounded-2xl" alt="Leitura" />
           </div>
           <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-700">
              <span className="block text-[10px] font-black text-slate-400 uppercase mb-1">Observações da Leitura</span>
              <p className="text-sm dark:text-slate-200 italic">{selectedReading.observation || "Sem observações registradas."}</p>
           </div>
           <button 
             onClick={() => setSubView('HISTORY')}
             className="w-full p-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-bold uppercase text-xs"
           >
             FECHAR FOTO
           </button>
        </div>
      )}
    </div>
  );
};

export default MeterManager;
