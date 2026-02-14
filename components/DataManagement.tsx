
import React, { useState, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { getUniqueProfiles, exportMasterDataToJSON } from '../services/utils';
import { Icons } from '../constants';
import { VehicleEntry, AccessType, ImportOrigin } from '../types';

interface DataManagementProps {
  onBack: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ onBack }) => {
  const [filter, setFilter] = useState('');
  const [entries, setEntries] = useState<VehicleEntry[]>(db.getEntries());
  const [editingProfile, setEditingProfile] = useState<VehicleEntry | null>(null);
  const [editForm, setEditForm] = useState<Partial<VehicleEntry>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profiles = useMemo(() => getUniqueProfiles(entries), [entries]);

  const filtered = profiles.filter(p => 
    p.driverName.toLowerCase().includes(filter.toLowerCase()) ||
    (p.vehiclePlate && p.vehiclePlate.toLowerCase().includes(filter.toLowerCase())) ||
    p.company.toLowerCase().includes(filter.toLowerCase())
  );

  const handleExport = () => {
    exportMasterDataToJSON(profiles);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json.entries)) {
          const added = db.importEntries(json.entries, ImportOrigin.FILE);
          alert(`${added} novos perfis importados com sucesso!`);
          setEntries(db.getEntries());
        } else {
          alert('Arquivo inválido. Certifique-se de que é um backup da base de dados.');
        }
      } catch (err) {
        alert('Erro ao processar o arquivo.');
      }
    };
    reader.readAsText(file);
  };

  const handleDelete = (profile: VehicleEntry) => {
    if (confirm(`Deseja remover ${profile.driverName} da base de dados? Isso removerá todos os atendimentos vinculados a este perfil.`)) {
      db.deleteProfileEntries(profile.driverName, profile.vehiclePlate || '');
      setEntries(db.getEntries());
    }
  };

  const handleEdit = (profile: VehicleEntry) => {
    setEditingProfile(profile);
    setEditForm({
      driverName: profile.driverName,
      company: profile.company,
      vehiclePlate: profile.vehiclePlate,
      trailerPlate: profile.trailerPlate,
      documentNumber: profile.documentNumber
    });
  };

  const saveEdit = () => {
    if (editingProfile && editForm) {
      db.updateProfileEntries(
        editingProfile.driverName, 
        editingProfile.vehiclePlate || '', 
        editForm
      );
      setEntries(db.getEntries());
      setEditingProfile(null);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg">
             ←
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Base de Dados</h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 shadow-md active:scale-95 transition-all"
          >
            IMPORTAR
          </button>
          <button 
            onClick={handleExport}
            className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 shadow-md active:scale-95 transition-all"
          >
            EXPORTAR
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
        Esta base é sincronizada: ao importar, novos registros são adicionados sem substituir os atuais. Edições refletem em todo o histórico do perfil.
      </div>

      <div className="relative">
        <input
          className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 text-sm dark:text-white"
          placeholder="Pesquisar por nome, placa ou empresa..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400 italic text-sm">Nenhum cadastro recorrente encontrado.</div>
        ) : (
          filtered.map((p, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center text-xl">
                  {p.accessType === AccessType.PEDESTRE ? '🚶' : '🚛'}
                </div>
                <div>
                   <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{p.driverName}</h4>
                   <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
                     {p.company} {p.vehiclePlate ? `• PLACA: ${p.vehiclePlate}` : ''}
                   </p>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => handleEdit(p)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">✏️</button>
                 <button onClick={() => handleDelete(p)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>

      {editingProfile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in zoom-in duration-200">
            <h3 className="text-lg font-bold dark:text-white">Editar Perfil</h3>
            
            <div className="space-y-3">
               <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nome</label>
                  <input className="w-full p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border-none text-sm dark:text-white" value={editForm.driverName} onChange={e => setEditForm({...editForm, driverName: e.target.value})} />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Empresa</label>
                  <input className="w-full p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border-none text-sm dark:text-white" value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})} />
               </div>
               {editingProfile.accessType !== AccessType.PEDESTRE ? (
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Placa</label>
                    <input className="w-full p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border-none text-sm uppercase dark:text-white" value={editForm.vehiclePlate} onChange={e => setEditForm({...editForm, vehiclePlate: e.target.value.toUpperCase()})} />
                 </div>
               ) : (
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Documento</label>
                    <input className="w-full p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border-none text-sm dark:text-white" value={editForm.documentNumber} onChange={e => setEditForm({...editForm, documentNumber: e.target.value})} />
                 </div>
               )}
            </div>

            <div className="flex gap-2 pt-2">
               <button onClick={() => setEditingProfile(null)} className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl font-bold text-xs uppercase">Cancelar</button>
               <button onClick={saveEdit} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataManagement;
