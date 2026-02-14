
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db } from '../services/db';
import { PackageRecord, PackageStatus, AppSettings, SectorContact } from '../types';
import { Icons } from '../constants';
import { exportPackagesToCSV, getUniqueProfiles } from '../services/utils';
import { useInternalAuth } from '../context/InternalAuthContext';

interface PackageManagerProps {
  onBack: () => void;
  operatorName: string;
}

const PackageManager: React.FC<PackageManagerProps> = ({ onBack, operatorName }) => {
  const { internalUser } = useInternalAuth();
  const settings: AppSettings = db.getSettings();
  const [list, setList] = useState<PackageRecord[]>(db.getPackages());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState<PackageRecord | null>(null);
  const [showNotifyModal, setShowNotifyModal] = useState<PackageRecord | null>(null);
  const [filterType, setFilterType] = useState<'Aguardando' | 'Hoje' | 'Todos'>('Aguardando');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [newPackage, setNewPackage] = useState<Partial<PackageRecord>>({
    deliveryCompany: '',
    recipientName: '',
    description: ''
  });

  const [deliveryData, setDeliveryData] = useState({
    pickupType: 'Próprio' as 'Próprio' | 'Terceiro',
    deliveredTo: ''
  });

  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<number | null>(null);

  const profiles = useMemo(() => getUniqueProfiles(db.getEntries()), []);
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState(false);

  const recipientSuggestions = useMemo(() => {
    if (!newPackage.recipientName || newPackage.recipientName.length < 2) return [];
    return profiles.filter(p => 
      p.driverName.toLowerCase().includes(newPackage.recipientName!.toLowerCase())
    ).slice(0, 5);
  }, [newPackage.recipientName, profiles]);

  const filteredList = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return list.filter(p => {
      const matchesSearch = 
        p.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.deliveryCompany.toLowerCase().includes(searchTerm.toLowerCase());

      const receivedDate = p.receivedAt.split('T')[0];
      const deliveredDate = p.deliveredAt?.split('T')[0];

      if (filterType === 'Aguardando') {
        return matchesSearch && p.status === PackageStatus.AGUARDANDO;
      }
      if (filterType === 'Hoje') {
        return matchesSearch && deliveredDate === today && p.status === PackageStatus.ENTREGUE;
      }
      return matchesSearch && receivedDate === selectedDate;
    }).sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }, [list, filterType, searchTerm, selectedDate]);

  const handleAddPackage = () => {
    if (!newPackage.deliveryCompany || !newPackage.recipientName) return;

    const record: PackageRecord = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      deliveryCompany: newPackage.deliveryCompany,
      recipientName: newPackage.recipientName,
      description: newPackage.description,
      operatorName,
      receivedAt: new Date().toISOString(),
      status: PackageStatus.AGUARDANDO
    };

    db.addPackage(record);
    setList(db.getPackages());
    setNewPackage({ deliveryCompany: '', recipientName: '', description: '' });
    setShowAddModal(false);
    // Sugere notificar logo após criar
    setShowNotifyModal(record);
  };

  const handleDeliverPackage = () => {
    if (!showDeliverModal || !deliveryData.deliveredTo) return;
    const updated: PackageRecord = {
      ...showDeliverModal,
      status: PackageStatus.ENTREGUE,
      deliveredAt: new Date().toISOString(),
      deliveredTo: deliveryData.deliveredTo,
      pickupType: deliveryData.pickupType
    };
    db.updatePackage(updated);
    setList(db.getPackages());
    setShowDeliverModal(null);
    setDeliveryData({ pickupType: 'Próprio', deliveredTo: '' });
  };

  const handleNotifyWhatsApp = (contact: SectorContact) => {
    if (!showNotifyModal) return;
    const msg = `📦 *AVISO DE ENCOMENDA - PORTARIA*\n\nOlá! Uma encomenda vinda de *${showNotifyModal.deliveryCompany}* acaba de ser recebida para: *${showNotifyModal.recipientName}*.\n\nFavor retirar na portaria quando possível.`;
    const url = `https://wa.me/${contact.number.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    setShowNotifyModal(null);
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
        db.deletePackage(id);
        setList(db.getPackages());
        setHoldId(null);
        setHoldProgress(0);
      }
    }, 50);
  };

  const stopHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldId(null);
    setHoldProgress(0);
  };

  useEffect(() => {
    return () => { if (holdIntervalRef.current) clearInterval(holdIntervalRef.current); };
  }, []);

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-right duration-300 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors">
             ←
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Encomendas</h2>
        </div>
        <div className="flex gap-2">
           <button onClick={() => exportPackagesToCSV(filteredList, selectedDate)} className="text-[10px] font-bold bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-1 shadow-md">
            <Icons.File /> CSV
           </button>
           <button onClick={() => setShowAddModal(true)} className="text-[10px] font-bold bg-indigo-600 text-white px-3 py-2 rounded-lg shadow-md">
            + NOVO PACOTE
           </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
           <FilterBtn active={filterType === 'Aguardando'} label="AGUARDANDO" onClick={() => setFilterType('Aguardando')} />
           <FilterBtn active={filterType === 'Hoje'} label="ENTREGUES HOJE" onClick={() => setFilterType('Hoje')} />
           <FilterBtn active={filterType === 'Todos'} label="POR DATA" onClick={() => setFilterType('Todos')} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
           <div className="relative">
              <input className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white pl-10" placeholder="Buscar destinatário..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</div>
           </div>
           {filterType === 'Todos' && (
             <input type="date" className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none text-sm dark:text-white" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
           )}
        </div>
      </div>

      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="text-center py-20 text-slate-400 italic text-sm">Nenhuma encomenda nesta lista.</div>
        ) : (
          filteredList.map(item => (
            <div key={item.id} className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border transition-all relative overflow-hidden ${item.status === PackageStatus.ENTREGUE ? 'border-green-200 dark:border-green-900/40 bg-green-50/10' : 'border-slate-200 dark:border-slate-700 shadow-sm'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded uppercase tracking-widest">{item.deliveryCompany}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(item.receivedAt).toLocaleDateString()}</span>
                   </div>
                   <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase truncate">{item.recipientName}</h4>
                   {item.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">{item.description}</p>}
                   
                   {item.status === PackageStatus.ENTREGUE && (
                     <div className="mt-3 p-2 bg-green-100/50 dark:bg-green-900/20 rounded-xl">
                        <p className="text-[10px] font-black text-green-700 dark:text-green-400 uppercase">Retirado Por:</p>
                        <p className="text-xs font-bold dark:text-white">{item.deliveredTo} ({item.pickupType})</p>
                     </div>
                   )}
                </div>

                <div className="flex flex-col items-end gap-2 ml-4">
                  {item.status === PackageStatus.AGUARDANDO ? (
                    <div className="flex gap-1">
                      <button onClick={() => setShowNotifyModal(item)} className="bg-green-50 text-green-600 p-3 rounded-xl border border-green-200 shadow-sm active:scale-95 transition-all">
                        <Icons.Whatsapp />
                      </button>
                      <button onClick={() => { setShowDeliverModal(item); setDeliveryData({ pickupType: 'Próprio', deliveredTo: item.recipientName }); }} className="bg-slate-900 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all">
                        ENTREGAR
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end">
                       <div className="text-green-500 font-black text-xl">✓</div>
                       <span className="text-[8px] text-slate-400 uppercase font-bold">Por: {item.operatorName}</span>
                    </div>
                  )}
                  {internalUser?.role === 'admin' && (
                    <button onPointerDown={() => startHold(item.id)} onPointerUp={stopHold} onPointerLeave={stopHold} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors">🗑️</button>
                  )}
                </div>
              </div>
              {holdId === item.id && (
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-red-100 dark:bg-red-900/20">
                  <div className="h-full bg-red-600 transition-all duration-75" style={{ width: `${holdProgress}%` }} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* MODAL: NOTIFICAR WHATSAPP */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in zoom-in duration-300">
              <div className="text-center">
                 <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2"><Icons.Whatsapp /></div>
                 <h3 className="text-lg font-black dark:text-white uppercase">Avisar Destinatário</h3>
                 <p className="text-xs text-slate-500 mt-1">Selecione para quem enviar o aviso de chegada:</p>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                 {settings.sectorContacts.length === 0 ? (
                   <p className="text-center py-4 text-slate-400 text-xs italic">Nenhum contato WhatsApp cadastrado.</p>
                 ) : (
                   settings.sectorContacts.map(c => (
                     <button key={c.id} onClick={() => handleNotifyWhatsApp(c)} className="w-full p-4 bg-slate-50 dark:bg-slate-900 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-2xl flex items-center justify-between border dark:border-slate-700 transition-colors">
                        <span className="font-bold text-sm dark:text-white uppercase">{c.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{c.number}</span>
                     </button>
                   ))
                 )}
              </div>
              <button onClick={() => setShowNotifyModal(null)} className="w-full p-4 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl font-bold text-xs uppercase mt-2">Fechar</button>
           </div>
        </div>
      )}

      {/* MODAL: NOVA ENCOMENDA */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-6 animate-in zoom-in duration-300">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest text-center">Registrar Recebimento</h3>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Empresa Transportadora</label>
                    <input autoFocus className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none text-sm dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Mercado Livre, Correios..." value={newPackage.deliveryCompany} onChange={e => setNewPackage({...newPackage, deliveryCompany: e.target.value})} />
                 </div>
                 <div className="relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Destinatário</label>
                    <input className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none text-sm dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Para quem é o pacote?" value={newPackage.recipientName} onFocus={() => setShowRecipientSuggestions(true)} onChange={e => setNewPackage({...newPackage, recipientName: e.target.value})} />
                    {showRecipientSuggestions && recipientSuggestions.length > 0 && (
                      <div className="absolute z-[80] w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border dark:border-slate-700 overflow-hidden">
                        {recipientSuggestions.map(p => (
                          <button key={p.id} onClick={() => { setNewPackage({...newPackage, recipientName: p.driverName}); setShowRecipientSuggestions(false); }} className="w-full p-3 text-left hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors border-b dark:border-slate-700 last:border-0 font-bold text-sm uppercase dark:text-white">{p.driverName}</button>
                        ))}
                      </div>
                    )}
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Descrição</label>
                    <input className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none text-sm dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Caixa, Envelope, Lacre..." value={newPackage.description} onChange={e => setNewPackage({...newPackage, description: e.target.value})} />
                 </div>
              </div>
              <div className="flex gap-3 pt-2">
                 <button onClick={() => setShowAddModal(false)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-xs uppercase">Cancelar</button>
                 <button onClick={handleAddPackage} className="flex-1 p-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase shadow-lg shadow-indigo-200">Registrar</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: ENTREGAR */}
      {showDeliverModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-6 animate-in zoom-in duration-300">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest text-center">Registrar Entrega</h3>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                 <span className="text-[10px] font-black text-indigo-400 uppercase block mb-1">Encomenda Para</span>
                 <p className="font-bold dark:text-white uppercase">{showDeliverModal.recipientName}</p>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Quem está retirando?</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                       <button onClick={() => setDeliveryData({...deliveryData, pickupType: 'Próprio', deliveredTo: showDeliverModal.recipientName})} className={`p-3 rounded-xl border-2 font-bold text-xs ${deliveryData.pickupType === 'Próprio' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-400'}`}>O PRÓPRIO</button>
                       <button onClick={() => setDeliveryData({...deliveryData, pickupType: 'Terceiro', deliveredTo: ''})} className={`p-3 rounded-xl border-2 font-bold text-xs ${deliveryData.pickupType === 'Terceiro' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-400'}`}>OUTRA PESSOA</button>
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome do Recebedor</label>
                    <input autoFocus={deliveryData.pickupType === 'Terceiro'} className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none text-sm dark:text-white focus:ring-2 focus:ring-green-500 font-bold uppercase" placeholder="Nome completo..." value={deliveryData.deliveredTo} onChange={e => setDeliveryData({...deliveryData, deliveredTo: e.target.value})} />
                 </div>
              </div>
              <div className="flex gap-3 pt-2">
                 <button onClick={() => setShowDeliverModal(null)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-xs uppercase">Cancelar</button>
                 <button onClick={handleDeliverPackage} className="flex-1 p-4 bg-green-600 text-white rounded-2xl font-bold text-xs uppercase shadow-lg shadow-green-200">Confirmar Saída</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const FilterBtn = ({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>
    {label}
  </button>
);

export default PackageManager;
