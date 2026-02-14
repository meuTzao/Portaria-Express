
import React, { useState, useRef } from 'react';
import { AppSettings, SectorContact } from '../types';
import { Icons } from '../constants';
import { exportContactsToJSON } from '../services/utils';

interface ContactManagementProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onBack: () => void;
  userRole?: string;
}

const ContactManagement: React.FC<ContactManagementProps> = ({ settings, onSave, onBack, userRole }) => {
  const isAdmin = userRole === 'admin';
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [newContact, setNewContact] = useState({ name: '', number: '' });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleAddContact = () => {
    if (!isAdmin) return;
    if (newContact.name && newContact.number) {
      const contact: SectorContact = {
        id: Math.random().toString(36).substr(2, 9),
        name: newContact.name,
        number: newContact.number.replace(/\D/g, '')
      };
      const updated = {
        ...formData,
        sectorContacts: [...formData.sectorContacts, contact]
      };
      setFormData(updated);
      setNewContact({ name: '', number: '' });
    }
  };

  const handleRemoveContact = (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Deseja excluir este contato permanentemente?")) return;
    setFormData({
      ...formData,
      sectorContacts: formData.sectorContacts.filter(c => c.id !== id)
    });
  };

  const handleUpdateContact = (id: string, name: string, number: string) => {
    if (!isAdmin) return;
    setFormData({
      ...formData,
      sectorContacts: formData.sectorContacts.map(c => 
        c.id === id ? { ...c, name, number: number.replace(/\D/g, '') } : c
      )
    });
  };

  const handleExportContacts = () => {
    exportContactsToJSON(formData.sectorContacts);
  };

  const handleImportContacts = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json.contacts)) {
          const currentNumbers = new Set(formData.sectorContacts.map(c => c.number));
          const toAdd = json.contacts.filter((c: SectorContact) => !currentNumbers.has(c.number));
          
          if (toAdd.length > 0) {
            setFormData({
              ...formData,
              sectorContacts: [...formData.sectorContacts, ...toAdd]
            });
            alert(`${toAdd.length} novos contatos adicionados!`);
          } else {
            alert('Todos os contatos do arquivo já existem.');
          }
        }
      } catch (err) {
        alert('Erro ao processar arquivo.');
      }
    };
    reader.readAsText(file);
  };

  const handleFinish = () => {
    if (isAdmin) {
       onSave(formData);
    } else {
       onBack();
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg">
             ←
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Lista de Telefones</h2>
        </div>
        
        {isAdmin && (
          <div className="flex gap-2">
             <button 
               onClick={() => importFileRef.current?.click()}
               className="text-[9px] font-black bg-blue-600 text-white px-3 py-2 rounded-lg shadow-md"
             >
               IMPORTAR
             </button>
             <button 
               onClick={handleExportContacts}
               className="text-[9px] font-black bg-slate-900 dark:bg-slate-700 text-white px-3 py-2 rounded-lg shadow-md"
             >
               EXPORTAR
             </button>
             <input type="file" ref={importFileRef} className="hidden" accept=".json" onChange={handleImportContacts} />
          </div>
        )}
      </div>

      <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isAdmin ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800'}`}>
        <span className="text-xl">{isAdmin ? '🛡️' : '👁️'}</span>
        <div>
           <p className={`text-[10px] font-black uppercase tracking-widest ${isAdmin ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'}`}>
             {isAdmin ? 'Modo Gerenciamento Ativo' : 'Modo Apenas Consulta'}
           </p>
           <p className="text-[9px] opacity-70 dark:text-slate-400">
             {isAdmin ? 'Você pode adicionar, editar e remover números de contato.' : 'Visualize os números para solicitações via WhatsApp.'}
           </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/50 p-6 rounded-[32px] border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contatos Registrados</h3>
        
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {formData.sectorContacts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic text-xs">Nenhum contato cadastrado.</div>
          ) : (
            formData.sectorContacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-800 transition-all">
                {isAdmin && editingContactId === contact.id ? (
                  <div className="flex-1 grid grid-cols-1 gap-2 mr-4">
                    <input className="text-xs p-3 rounded-xl bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500" value={contact.name} onChange={e => handleUpdateContact(contact.id, e.target.value, contact.number)} placeholder="Nome" />
                    <input className="text-xs p-3 rounded-xl bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500 font-mono" value={contact.number} onChange={e => handleUpdateContact(contact.id, contact.name, e.target.value)} placeholder="Número" />
                  </div>
                ) : (
                  <div className="flex-1">
                    <span className="font-black text-sm dark:text-slate-100 block uppercase tracking-tight">{contact.name}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-widest">{contact.number}</span>
                  </div>
                )}
                
                {isAdmin && (
                  <div className="flex gap-2">
                     <button 
                       onClick={() => setEditingContactId(editingContactId === contact.id ? null : contact.id)} 
                       className={`text-[9px] font-black px-3 py-2 rounded-lg transition-colors ${editingContactId === contact.id ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'}`}
                     >
                       {editingContactId === contact.id ? 'SALVAR' : 'EDITAR'}
                     </button>
                     <button onClick={() => handleRemoveContact(contact.id)} className="p-2 text-red-500 opacity-60 hover:opacity-100 transition-opacity">🗑️</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {isAdmin && (
          <div className="pt-6 border-t dark:border-slate-700 space-y-4">
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Novo Responsável</h4>
             <div className="grid grid-cols-1 gap-2">
               <input
                  className="w-full p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl text-sm border-none focus:ring-2 focus:ring-green-500 dark:text-white"
                  placeholder="Setor / Nome"
                  value={newContact.name}
                  onChange={e => setNewContact({...newContact, name: e.target.value})}
               />
               <div className="flex gap-2">
                 <input
                    className="flex-1 p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl text-sm border-none focus:ring-2 focus:ring-green-500 dark:text-white font-mono"
                    placeholder="55DDD900000000"
                    value={newContact.number}
                    onChange={e => setNewContact({...newContact, number: e.target.value})}
                 />
                 <button onClick={handleAddContact} className="bg-green-600 text-white px-6 rounded-2xl font-black text-[10px] shadow-lg active:scale-95 transition-all">ADICIONAR</button>
               </div>
             </div>
          </div>
        )}
      </div>

      <button
        onClick={handleFinish}
        className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-6 rounded-3xl text-xl font-black shadow-xl active:scale-95 transition-all uppercase tracking-widest"
      >
        {isAdmin ? 'CONCLUIR GESTÃO' : 'VOLTAR AO MENU'}
      </button>
    </div>
  );
};

export default ContactManagement;
