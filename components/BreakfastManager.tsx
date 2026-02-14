
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db } from '../services/db';
import { BreakfastRecord } from '../types';
import { Icons } from '../constants';
import { exportBreakfastToCSV } from '../services/utils';
import { useInternalAuth } from '../context/InternalAuthContext';

interface BreakfastManagerProps {
  onBack: () => void;
  operatorName: string;
}

const BreakfastManager: React.FC<BreakfastManagerProps> = ({ onBack, operatorName }) => {
  const { internalUser } = useInternalAuth(); // Access user role
  const [list, setList] = useState<BreakfastRecord[]>(db.getBreakfastList());
  const [searchInput, setSearchInput] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showImport, setShowImport] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [isSearchGridOpen, setIsSearchGridOpen] = useState(false);
  const [hideDelivered, setHideDelivered] = useState(false);
  const [manualPerson, setManualPerson] = useState<{ name: string; type: 'Fruta' | 'Outro' }>({ name: '', type: 'Outro' });
  
  // Estados para Modais de Confirmação
  const [personToConfirm, setPersonToConfirm] = useState<BreakfastRecord | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Estado para o Long Press do botão Limpar
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<number | null>(null);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const currentList = useMemo(() => {
    return list.filter(item => item.date === selectedDate);
  }, [list, selectedDate]);

  const filteredList = useMemo(() => {
    return currentList
      .filter(item => {
        const matchesText = item.personName.toLowerCase().includes(appliedFilter.toLowerCase());
        const matchesLetter = selectedLetter ? item.personName.toUpperCase().startsWith(selectedLetter) : true;
        const matchesVisibility = hideDelivered ? item.status === 'Pendente' : true;
        return matchesText && matchesLetter && matchesVisibility;
      })
      .sort((a, b) => a.personName.localeCompare(b.personName));
  }, [currentList, appliedFilter, selectedLetter, hideDelivered]);

  const stats = useMemo(() => {
    const total = currentList.length;
    const delivered = currentList.filter(i => i.status === 'Entregue').length;
    const fruta = currentList.filter(i => i.breakfastType === 'Fruta').length;
    return { total, delivered, fruta };
  }, [currentList]);

  const handleSearchTrigger = () => {
    if (searchInput.trim() === '') {
      setIsSearchGridOpen(true);
    } else {
      setAppliedFilter(searchInput);
      setSelectedLetter(null);
      setIsSearchGridOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchTrigger();
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setAppliedFilter('');
    setSelectedLetter(null);
    setIsSearchGridOpen(false);
  };

  const handleImport = () => {
    if (!inputText.trim()) return;
    const lines = inputText.split('\n').filter(line => line.trim().length > 0);
    const newRecords: BreakfastRecord[] = lines.map(line => {
      const isFruta = /\bFRUTA\b/i.test(line);
      const personName = line.replace(/\bFRUTA\b/gi, '').replace(/\s+/g, ' ').trim();
      return {
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        personName,
        breakfastType: isFruta ? 'Fruta' : 'Outro',
        status: 'Pendente',
        date: selectedDate,
        origin: 'Importado'
      };
    });
    const updatedList = [...list, ...newRecords];
    db.saveBreakfastList(updatedList);
    setList(updatedList);
    setInputText('');
    setShowImport(false);
  };

  const [inputText, setInputText] = useState(''); // Textarea import helper

  const confirmDelivery = () => {
    if (personToConfirm) {
      db.markBreakfastDelivered(personToConfirm.id, operatorName);
      setList(db.getBreakfastList());
      setPersonToConfirm(null);
    }
  };

  const handleAddManual = () => {
    if (!manualPerson.name.trim()) return;
    const newPerson: BreakfastRecord = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      personName: manualPerson.name.trim(),
      breakfastType: manualPerson.type,
      status: 'Pendente',
      date: selectedDate,
      origin: 'Manual'
    };
    db.addBreakfastPerson(newPerson);
    setList(db.getBreakfastList());
    setManualPerson({ name: '', type: 'Outro' });
    setShowAddManual(false);
  };

  const startHold = () => {
    setHoldProgress(0);
    const startTime = Date.now();
    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / 2000) * 100, 100);
      setHoldProgress(progress);
      
      if (progress >= 100) {
        clearInterval(holdIntervalRef.current!);
        holdIntervalRef.current = null;
        setHoldProgress(0);
        setShowClearConfirm(true);
      }
    }, 50);
  };

  const stopHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
  };

  const handleClearList = () => {
    db.clearBreakfastByDate(selectedDate);
    setList(db.getBreakfastList());
    setShowClearConfirm(false);
  };

  const handleExport = () => {
    exportBreakfastToCSV(currentList, selectedDate);
  };

  const selectLetterFromGrid = (letter: string | null) => {
    setSelectedLetter(letter);
    setAppliedFilter('');
    setSearchInput(letter || '');
    setIsSearchGridOpen(false);
  };

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-right duration-300 pb-20">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors">
             ←
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Desjejum</h2>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={handleExport}
            className="text-[10px] font-bold bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-1"
           >
            <Icons.File /> CSV
           </button>
           <button 
            onClick={() => setShowImport(!showImport)}
            className="text-[10px] font-bold bg-blue-600 text-white px-3 py-2 rounded-lg"
           >
            IMPORTAR
           </button>
           
           {/* BOTÃO LIMPAR - APENAS ADMIN */}
           {internalUser?.role === 'admin' && (
             <button 
              onPointerDown={startHold}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              className="relative overflow-hidden text-[10px] font-bold bg-red-100 text-red-600 px-3 py-2 rounded-lg select-none active:scale-95 transition-transform"
             >
              <span className="relative z-10">LIMPAR</span>
              <div 
                className="absolute bottom-0 left-0 h-1 bg-red-500 transition-all duration-75" 
                style={{ width: `${holdProgress}%` }}
              />
             </button>
           )}
        </div>
      </div>

      {/* SELETOR DE DATA E ESTATISTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Selecionar Data</label>
          <input 
            type="date" 
            className="w-full bg-transparent font-bold dark:text-white border-none focus:ring-0 p-0 text-lg"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
           <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-center border dark:border-slate-700">
              <span className="block text-[8px] font-bold text-slate-400 uppercase">Total</span>
              <span className="text-lg font-black dark:text-white">{stats.total}</span>
           </div>
           <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl text-center border border-green-100 dark:border-green-800">
              <span className="block text-[8px] font-bold text-green-600 uppercase">Entregues</span>
              <span className="text-lg font-black text-green-700 dark:text-green-400">{stats.delivered}</span>
           </div>
           <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl text-center border border-amber-100 dark:border-amber-800">
              <span className="block text-[8px] font-bold text-amber-600 uppercase">Frutas</span>
              <span className="text-lg font-black text-amber-700 dark:text-amber-400">{stats.fruta}</span>
           </div>
        </div>
      </div>

      {showImport && (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-blue-200 dark:border-blue-900/30 space-y-4 animate-in slide-in-from-top duration-300">
           <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Colar Lista Transcrita</h3>
           <textarea
             className="w-full p-4 bg-white dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
             rows={6}
             placeholder="Adriane Menezes FRUTA&#10;Alexandre de Jesus"
             value={inputText}
             onChange={e => setInputText(e.target.value)}
           />
           <button
             onClick={handleImport}
             className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold uppercase text-sm"
           >
             Gerar Lista para {selectedDate.split('-').reverse().slice(0,2).join('/')}
           </button>
        </div>
      )}

      {/* BARRA DE PESQUISA */}
      <div className="space-y-4">
        <div className="flex gap-2 items-center">
           <div className="relative flex-1">
             <input
               className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white pl-10"
               placeholder="Digitar nome e confirmar..."
               value={searchInput}
               onChange={e => setSearchInput(e.target.value)}
               onKeyDown={handleKeyDown}
             />
             <button 
               onClick={handleSearchTrigger}
               className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
             >
               🔍
             </button>
             {searchInput && (
               <button 
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold"
               >
                 ✕
               </button>
             )}
           </div>
           <button 
             onClick={() => setShowAddManual(true)}
             className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 h-14 w-14 rounded-2xl font-black text-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all"
           >
            +
           </button>
        </div>

        {/* FILTRO: OCULTAR ENTREGUES */}
        {!isSearchGridOpen && (
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/30 p-2 rounded-2xl px-4 border dark:border-slate-700">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visualização</span>
             </div>
             <button 
                onClick={() => setHideDelivered(!hideDelivered)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold transition-all ${
                  hideDelivered 
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-200 dark:shadow-none' 
                  : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border dark:border-slate-600'
                }`}
             >
               {hideDelivered ? '🙈 OCULTANDO ENTREGUES' : '👁️ EXIBINDO TUDO'}
             </button>
          </div>
        )}

        {/* VIEW PRINCIPAL: TECLADO GIGANTE OU LISTA */}
        {isSearchGridOpen ? (
          <div className="animate-in fade-in zoom-in duration-300 space-y-6 py-4">
            <div className="flex justify-between items-center px-1">
               <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Pesquisa por Inicial</h3>
               <button 
                onClick={() => setIsSearchGridOpen(false)}
                className="text-xs font-bold text-red-600 uppercase px-3 py-1 bg-red-50 dark:bg-red-900/20 rounded-lg"
               >
                 ❌ CANCELAR
               </button>
            </div>
            
            <div className="grid grid-cols-5 gap-4">
              <button
                onClick={() => selectLetterFromGrid(null)}
                className="col-span-5 bg-blue-600 text-white p-8 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center uppercase tracking-widest"
              >
                🔵 TODOS
              </button>
              {alphabet.map(letter => (
                <button
                  key={letter}
                  onClick={() => selectLetterFromGrid(letter)}
                  className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 aspect-square rounded-2xl font-black text-3xl text-slate-700 dark:text-slate-200 shadow-md active:bg-blue-50 active:border-blue-500 transition-all flex items-center justify-center active:scale-90"
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2 pb-10">
            {appliedFilter || selectedLetter ? (
              <div className="flex items-center justify-between mb-4 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl">
                 <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                   {selectedLetter ? `Inicial: ${selectedLetter}` : `Busca: ${appliedFilter}`}
                 </span>
                 <button onClick={clearSearch} className="text-[10px] font-bold text-slate-400 uppercase">Limpar</button>
              </div>
            ) : null}

            {filteredList.length === 0 ? (
              <div className="text-center py-20 text-slate-400 italic text-sm">
                {hideDelivered && currentList.some(i => i.status === 'Entregue') 
                  ? "Todos os registros filtrados já foram entregues." 
                  : "Nenhum registro encontrado."}
              </div>
            ) : (
              filteredList.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => item.status === 'Pendente' && setPersonToConfirm(item)}
                  className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer active:scale-[0.98] ${
                    item.status === 'Entregue' 
                    ? 'border-green-200 dark:border-green-900/40 bg-green-50/10' 
                    : 'border-slate-200 dark:border-slate-700 shadow-sm'
                  }`}
                >
                  <div className="flex-1">
                     <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.breakfastType === 'Fruta' ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                        <h4 className={`font-bold text-sm uppercase tracking-tight ${item.status === 'Entregue' ? 'text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                          {item.personName}
                        </h4>
                     </div>
                     <div className="flex gap-3 mt-1">
                        <span className={`text-[10px] font-bold uppercase ${item.breakfastType === 'Fruta' ? 'text-amber-600' : 'text-slate-400'}`}>{item.breakfastType}</span>
                        {item.status === 'Entregue' && (
                          <span className="text-[9px] text-green-600 font-mono">Entregue às {new Date(item.deliveredAt!).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        )}
                     </div>
                  </div>
                  
                  {item.status === 'Pendente' ? (
                    <div className="bg-green-600 text-white px-4 py-3 rounded-xl text-[10px] font-bold uppercase shadow-sm">
                      Entregar
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-green-500 scale-125 pr-2">✓</div>
                      <span className="text-[8px] text-slate-400 uppercase font-bold">{item.operatorName?.split(' ')[0]}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE ENTREGA */}
      {personToConfirm && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-8 shadow-2xl space-y-6 text-center animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto">
                 <Icons.Coffee />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Confirmar entrega</h3>
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-700 text-left">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Nome da Pessoa</p>
                   <p className="text-sm font-black dark:text-white mb-3 uppercase">{personToConfirm.personName}</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Desjejum</p>
                   <p className={`text-sm font-black ${personToConfirm.breakfastType === 'Fruta' ? 'text-amber-600' : 'text-blue-600'} uppercase`}>
                      {personToConfirm.breakfastType === 'Fruta' ? '🍍 FRUTA' : '☕ OUTRO'}
                   </p>
                </div>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setPersonToConfirm(null)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-xs uppercase">⛔ Cancelar</button>
                 <button onClick={confirmDelivery} className="flex-1 p-4 bg-green-600 text-white rounded-2xl font-bold text-xs uppercase shadow-lg shadow-green-200 dark:shadow-none">✅ Confirmar</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL DE LIMPEZA CRÍTICA */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-red-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-8 shadow-2xl text-center space-y-6 animate-in zoom-in duration-300">
              <div className="text-5xl">⚠️</div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase">Confirmar exclusão</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Isso irá apagar toda a lista de <strong>{selectedDate.split('-').reverse().join('/')}</strong>.</p>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setShowClearConfirm(false)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-xs uppercase">⛔ Cancelar</button>
                 <button onClick={handleClearList} className="flex-1 p-4 bg-red-600 text-white rounded-2xl font-bold text-xs uppercase shadow-lg shadow-red-200 dark:shadow-none">🗑️ Confirmar exclusão</button>
              </div>
           </div>
        </div>
      )}

      {/* ADIÇÃO MANUAL */}
      {showAddManual && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in zoom-in duration-200">
             <h3 className="text-lg font-bold dark:text-white">Adicionar Pessoa</h3>
             <div className="space-y-3">
                <input 
                  className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border-none text-sm dark:text-white" 
                  placeholder="Nome Completo"
                  value={manualPerson.name}
                  onChange={e => setManualPerson({...manualPerson, name: e.target.value})}
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => setManualPerson({...manualPerson, type: 'Fruta'})} className={`p-3 rounded-xl border-2 font-bold text-xs ${manualPerson.type === 'Fruta' ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-slate-50 border-slate-200 dark:bg-slate-900'}`}>🍍 FRUTA</button>
                   <button onClick={() => setManualPerson({...manualPerson, type: 'Outro'})} className={`p-3 rounded-xl border-2 font-bold text-xs ${manualPerson.type === 'Outro' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-slate-50 border-slate-200 dark:bg-slate-900'}`}>☕ OUTRO</button>
                </div>
             </div>
             <div className="flex gap-2">
                <button onClick={() => setShowAddManual(false)} className="flex-1 p-3 bg-slate-100 rounded-xl font-bold text-xs uppercase">Cancelar</button>
                <button onClick={handleAddManual} className="flex-1 p-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase">Adicionar</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BreakfastManager;
