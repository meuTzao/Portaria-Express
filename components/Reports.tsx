
import React, { useState } from 'react';
import { VehicleEntry, EntryStatus, AccessType, DestinationSector, ImportOrigin, OperationType } from '../types';
import { formatDateTime, exportToCSV } from '../services/utils';
import { Icons, SECTORS, OPERATIONS } from '../constants';
import { db } from '../services/db';

interface ReportsProps {
  entries: VehicleEntry[];
  onBack: () => void;
  onUpdate: () => void;
}

const Reports: React.FC<ReportsProps> = ({ entries, onBack, onUpdate }) => {
  const today = new Date().toISOString().split('T')[0];
  const [filter, setFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedEntry, setSelectedEntry] = useState<VehicleEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<VehicleEntry | null>(null);

  // Estados para exportação por período
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [showExport, setShowExport] = useState(false);

  const filtered = entries
    .filter(e => {
      const entryDate = new Date(e.createdAt).toISOString().split('T')[0];
      const matchesDate = entryDate === selectedDate;
      const matchesText = 
        e.driverName.toLowerCase().includes(filter.toLowerCase()) || 
        e.company.toLowerCase().includes(filter.toLowerCase()) ||
        (e.vehiclePlate && e.vehiclePlate.toLowerCase().includes(filter.toLowerCase()));

      return matchesDate && matchesText;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getStatusColor = (status: EntryStatus) => {
    switch(status) {
      case EntryStatus.FINALIZADO: return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case EntryStatus.AUTORIZADO: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case EntryStatus.RECUSADO: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  const handleOpenDetail = (e: VehicleEntry) => {
    setSelectedEntry(e);
    setEditForm({ ...e });
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (editForm) {
      db.updateEntry(editForm);
      onUpdate();
      setSelectedEntry(editForm);
      setIsEditing(false);
    }
  };

  const handleExportPeriod = () => {
    const toExport = entries.filter(e => {
      const date = e.createdAt.split('T')[0];
      return date >= startDate && date <= endDate;
    });
    exportToCSV(toExport, startDate, endDate);
  };

  return (
    <div className="p-4 space-y-4 relative min-h-full pb-20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg">
             ←
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Histórico</h2>
        </div>
        <button 
          onClick={() => setShowExport(!showExport)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all ${
            showExport ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'bg-green-600 text-white'
          }`}
        >
          <Icons.File /> {showExport ? 'FECHAR' : 'RELATÓRIO'}
        </button>
      </div>

      {showExport && (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in slide-in-from-top duration-300">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest text-center">Exportar Atendimentos</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Data Início</label>
              <input type="date" className="w-full p-2 bg-white dark:bg-slate-900 rounded-lg text-xs dark:text-white" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Data Fim</label>
              <input type="date" className="w-full p-2 bg-white dark:bg-slate-900 rounded-lg text-xs dark:text-white" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <button 
            onClick={handleExportPeriod}
            className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
          >
            GERAR ARQUIVO CSV DO PERÍODO
          </button>
        </div>
      )}

      <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur pb-2 z-10 space-y-2">
        <div className="grid grid-cols-2 gap-2">
           <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Visualizar Data</label>
              <input 
                type="date"
                className="w-full p-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-none text-sm dark:text-white"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
           </div>
           <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Buscar Nome/Placa</label>
              <input
                className="w-full p-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-none text-sm dark:text-white"
                placeholder="Ex: ABC1234"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
           </div>
        </div>
      </div>

      <div className="space-y-3 pb-10">
        {filtered.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-slate-400 text-sm italic">Nenhum registro para esta data.</p>
          </div>
        ) : (
          filtered.map(e => (
            <div 
              key={e.id} 
              onClick={() => handleOpenDetail(e)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs shadow-sm cursor-pointer active:scale-[0.98] transition-all hover:border-blue-300 dark:hover:border-blue-900"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{e.driverName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${getStatusColor(e.status)}`}>
                      {e.status}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-medium">{e.company}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-900 dark:text-slate-100 block font-bold">{new Date(e.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                  <span className="text-blue-500 font-bold uppercase tracking-tighter text-[9px]">{e.origin}</span>
                </div>
              </div>
              
              <div className="mt-3 flex justify-between items-center text-[9px] border-t dark:border-slate-700 pt-2 text-slate-400">
                 <span className="uppercase">Liberação: <strong>{e.authorizedBy || 'N/A'}</strong></span>
                 <span className="uppercase">Porteiro: <strong>{e.operatorName}</strong></span>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm" onClick={() => setSelectedEntry(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
             <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <h3 className="text-lg font-bold dark:text-white">{isEditing ? 'Editar Atendimento' : 'Detalhes do Atendimento'}</h3>
                <div className="flex gap-2">
                  {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="text-blue-600 font-bold text-sm px-3 py-1 bg-blue-50 rounded-lg">EDITAR</button>
                  )}
                  <button onClick={() => setSelectedEntry(null)} className="text-slate-400 text-xl">✕</button>
                </div>
             </div>

             <div className="p-6 overflow-y-auto space-y-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <EditField label="Nome Completo" value={editForm?.driverName} onChange={v => setEditForm(prev => prev ? {...prev, driverName: v} : null)} />
                    <EditField label="Empresa/Transportadora" value={editForm?.company} onChange={v => setEditForm(prev => prev ? {...prev, company: v} : null)} />
                    <EditField label="Placa" value={editForm?.vehiclePlate} onChange={v => setEditForm(prev => prev ? {...prev, vehiclePlate: v.toUpperCase()} : null)} />
                    <EditField label="Documento (RG/CPF)" value={editForm?.documentNumber} onChange={v => setEditForm(prev => prev ? {...prev, documentNumber: v} : null)} />
                    <EditField label="Nota Fiscal / Pedido" value={editForm?.orderNumber} onChange={v => setEditForm(prev => prev ? {...prev, orderNumber: v} : null)} />
                    
                    <div>
                       <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Setor Destino</label>
                       <select className="w-full p-3 bg-slate-100 dark:bg-slate-700 rounded-xl border-none text-sm dark:text-white" value={editForm?.sector} onChange={e => setEditForm(prev => prev ? {...prev, sector: e.target.value as any} : null)}>
                          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                    </div>

                    <EditField label="Observações Entrada" value={editForm?.observations} onChange={v => setEditForm(prev => prev ? {...prev, observations: v} : null)} isTextArea />
                    <EditField label="Observações Saída" value={editForm?.exitObservations} onChange={v => setEditForm(prev => prev ? {...prev, exitObservations: v} : null)} isTextArea />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="ID Atendimento" value={selectedEntry.id} span={2} />
                    <DetailItem label="Status" value={selectedEntry.status} badge color={getStatusColor(selectedEntry.status)} />
                    <DetailItem label="Origem" value={selectedEntry.origin} />
                    <DetailItem label="Visitante" value={selectedEntry.driverName} span={2} />
                    <DetailItem label="Empresa" value={selectedEntry.company} />
                    <DetailItem label="Placa" value={selectedEntry.vehiclePlate || 'N/A'} />
                    <DetailItem label="Documento" value={selectedEntry.documentNumber || 'N/A'} />
                    <DetailItem label="NF/Pedido" value={selectedEntry.orderNumber || 'N/A'} />
                    <DetailItem label="Setor Destino" value={selectedEntry.sector || 'N/A'} />
                    <DetailItem label="Autorizado Por" value={selectedEntry.authorizedBy || 'N/A'} />
                    <DetailItem label="Porteiro" value={selectedEntry.operatorName} />
                    <DetailItem label="Dispositivo" value={selectedEntry.deviceName} />
                    <DetailItem label="Entrada" value={selectedEntry.entryTime ? formatDateTime(selectedEntry.entryTime) : '--'} />
                    <DetailItem label="Saída" value={selectedEntry.exitTime ? formatDateTime(selectedEntry.exitTime) : '--'} />
                    <DetailItem label="Observações" value={selectedEntry.observations || 'Nenhuma'} span={2} />
                    {selectedEntry.exitObservations && <DetailItem label="Obs Saída" value={selectedEntry.exitObservations} span={2} />}
                  </div>
                )}
             </div>

             {isEditing && (
               <div className="p-6 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
                  <button onClick={() => setIsEditing(false)} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 p-4 rounded-2xl font-bold">CANCELAR</button>
                  <button onClick={handleSaveEdit} className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-bold">SALVAR</button>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

const EditField = ({ label, value, onChange, isTextArea }: any) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">{label}</label>
    {isTextArea ? (
      <textarea className="w-full p-3 bg-slate-100 dark:bg-slate-700 rounded-xl border-none text-sm dark:text-white" value={value || ''} onChange={e => onChange(e.target.value)} rows={2} />
    ) : (
      <input className="w-full p-3 bg-slate-100 dark:bg-slate-700 rounded-xl border-none text-sm dark:text-white" value={value || ''} onChange={e => onChange(e.target.value)} />
    )}
  </div>
);

const DetailItem = ({ label, value, span, badge, color }: any) => (
  <div className={span === 2 ? "col-span-2" : "col-span-1"}>
    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</span>
    <span className={`block text-xs font-bold dark:text-slate-200 ${badge ? `inline-block px-2 py-0.5 rounded ${color}` : ''}`}>
      {value}
    </span>
  </div>
);

export default Reports;
