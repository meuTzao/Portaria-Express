
import React, { useState, useEffect, useMemo } from 'react';
import { VehicleEntry, OperationType, EntryStatus, DestinationSector, AppSettings, SectorContact, AccessType, ImportOrigin } from '../types';
import { Icons, OPERATIONS, SECTORS } from '../constants';
import { generateWhatsAppLink, getUniqueProfiles } from '../services/utils';
import { db } from '../services/db';

interface NewEntryFlowProps {
  settings: AppSettings;
  operatorName: string;
  onComplete: () => void;
  onCancel: () => void;
}

const NewEntryFlow: React.FC<NewEntryFlowProps> = ({ settings, operatorName, onComplete, onCancel }) => {
  const [step, setStep] = useState(0); 
  const [selectedContact, setSelectedContact] = useState<SectorContact | null>(
    settings.sectorContacts.length > 0 ? settings.sectorContacts[0] : null
  );

  const [formData, setFormData] = useState<Partial<VehicleEntry>>({
    id: Math.random().toString(36).substr(2, 9).toUpperCase(),
    accessType: AccessType.CAMINHAO,
    driverName: '',
    company: '',
    supplier: '',
    operationType: OperationType.ENTREGA,
    orderNumber: '',
    vehiclePlate: '',
    trailerPlate: '',
    isTruck: false,
    documentNumber: '',
    visitReason: '',
    visitedPerson: '',
    status: EntryStatus.PENDENTE,
    createdAt: new Date().toISOString(),
    operatorName: operatorName,
    deviceName: settings.deviceName,
    origin: ImportOrigin.LOCAL
  });

  const [activeSuggestionField, setActiveSuggestionField] = useState<'name' | 'plate' | null>(null);

  // Perfis únicos do histórico para sugestões
  const profiles = useMemo(() => getUniqueProfiles(db.getEntries()), []);

  const nameSuggestions = useMemo(() => {
    if (!formData.driverName || formData.driverName.length < 2) return [];
    return profiles.filter(p => 
      p.driverName.toLowerCase().includes(formData.driverName!.toLowerCase())
    ).slice(0, 5);
  }, [formData.driverName, profiles]);

  const plateSuggestions = useMemo(() => {
    if (!formData.vehiclePlate || formData.vehiclePlate.length < 2) return [];
    return profiles.filter(p => 
      p.vehiclePlate?.toLowerCase().includes(formData.vehiclePlate!.toLowerCase())
    ).slice(0, 5);
  }, [formData.vehiclePlate, profiles]);

  useEffect(() => {
    const draft = db.getDraft();
    if (draft) {
      setFormData(prev => ({ ...prev, ...draft.formData }));
      setStep(draft.step);
    }
  }, []);

  useEffect(() => {
    if (step >= 0) {
      db.saveDraft(formData, step);
    }
  }, [formData, step]);

  const handleSelectAccessType = (type: AccessType) => {
    setFormData(prev => ({ 
      ...prev, 
      accessType: type,
      isTruck: type === AccessType.CAMINHAO 
    }));
    setStep(1);
  };

  const handleSelectSuggestion = (profile: VehicleEntry) => {
    setFormData(prev => ({
      ...prev,
      driverName: profile.driverName,
      company: profile.company,
      vehiclePlate: profile.vehiclePlate,
      trailerPlate: profile.trailerPlate,
      isTruck: !!profile.trailerPlate,
      accessType: profile.accessType,
      documentNumber: profile.documentNumber
    }));
    setActiveSuggestionField(null);
  };

  const handleNextStep = () => {
    if (step === 1 && selectedContact) {
      const whatsappUrl = generateWhatsAppLink(formData as VehicleEntry, selectedContact.number);
      window.open(whatsappUrl, '_blank');
      setStep(2);
    }
  };

  const handleAuthorize = () => {
    setFormData(prev => ({ 
      ...prev, 
      status: EntryStatus.AUTORIZADO,
      entryTime: new Date().toISOString(),
      authorizedBy: selectedContact?.name
    }));
    setStep(3);
  };

  const handleReject = () => {
    const reason = prompt("Motivo da recusa:");
    if (reason !== null) {
      const finalEntry: VehicleEntry = {
        ...(formData as VehicleEntry),
        status: EntryStatus.RECUSADO,
        rejectionReason: reason || 'Não informado',
        authorizedBy: selectedContact?.name
      };
      db.addEntry(finalEntry);
      db.clearDraft();
      onComplete();
    }
  };

  const handleFinalRegister = () => {
    const finalEntry: VehicleEntry = {
      ...(formData as VehicleEntry),
    };
    db.addEntry(finalEntry);
    db.clearDraft();
    onComplete();
  };

  const handleCancel = () => {
    if (confirm("Deseja descartar os dados atuais?")) {
      db.clearDraft();
      onCancel();
    } else {
      onCancel();
    }
  };

  const isFormValid = () => {
    if (!formData.driverName) return false;
    if (formData.accessType !== AccessType.PEDESTRE && !formData.vehiclePlate) return false;
    if (formData.accessType === AccessType.PEDESTRE && !formData.documentNumber) return false;
    return true;
  };

  return (
    <div className="p-6 transition-colors">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          {step === 0 && "Tipo de Acesso"}
          {step === 1 && "1. Dados do Visitante"}
          {step === 2 && "2. Aguardando"}
          {step === 3 && "3. Cadastro Final"}
        </h2>
        <button onClick={handleCancel} className="text-slate-400 dark:text-slate-600 font-bold p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">✕</button>
      </div>

      {step === 0 && (
        <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
          <AccessTypeButton icon="🚛" label="Caminhão" onClick={() => handleSelectAccessType(AccessType.CAMINHAO)} />
          <AccessTypeButton icon="🚗" label="Carro" onClick={() => handleSelectAccessType(AccessType.CARRO)} />
          <AccessTypeButton icon="🏍️" label="Moto" onClick={() => handleSelectAccessType(AccessType.MOTO)} />
          <AccessTypeButton icon="🚶" label="A pé" onClick={() => handleSelectAccessType(AccessType.PEDESTRE)} />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
          <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl flex items-center gap-3 border border-blue-100 dark:border-blue-900/30">
            <span className="text-2xl">{formData.accessType === AccessType.CAMINHAO ? '🚛' : formData.accessType === AccessType.CARRO ? '🚗' : formData.accessType === AccessType.MOTO ? '🏍️' : '🚶'}</span>
            <span className="font-bold text-blue-800 dark:text-blue-300 uppercase text-xs">{formData.accessType}</span>
            <button onClick={() => setStep(0)} className="ml-auto text-[10px] bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm">Alterar</button>
          </div>

          <div className="relative">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Nome Completo</label>
            <input
              className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-lg dark:text-slate-100"
              placeholder="Ex: João Silva"
              value={formData.driverName}
              onFocus={() => setActiveSuggestionField('name')}
              onChange={e => setFormData({ ...formData, driverName: e.target.value })}
            />
            {activeSuggestionField === 'name' && nameSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {nameSuggestions.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectSuggestion(p)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors border-b dark:border-slate-700 last:border-0"
                  >
                    <div className="text-blue-500"><Icons.History /></div>
                    <div>
                      <div className="text-sm font-bold dark:text-white">{p.driverName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{p.company} {p.vehiclePlate && `• ${p.vehiclePlate}`}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {formData.accessType === AccessType.PEDESTRE && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Documento (RG/CPF)</label>
              <input
                className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-lg dark:text-slate-100"
                placeholder="000.000.000-00"
                value={formData.documentNumber}
                onChange={e => setFormData({ ...formData, documentNumber: e.target.value })}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Transportadora / Empresa</label>
              <input
                className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-lg dark:text-slate-100"
                placeholder="Ex: Braspress"
                value={formData.company}
                onChange={e => setFormData({ ...formData, company: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Destinatário</label>
              <input
                className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-lg dark:text-slate-100"
                placeholder="Ex: Nome na Nota"
                value={formData.supplier}
                onChange={e => setFormData({ ...formData, supplier: e.target.value })}
              />
            </div>
          </div>
          
          {formData.accessType !== AccessType.PEDESTRE && (
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Placa</label>
                <input
                  className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-lg uppercase dark:text-slate-100 font-mono"
                  placeholder="ABC1234"
                  value={formData.vehiclePlate}
                  onFocus={() => setActiveSuggestionField('plate')}
                  onChange={e => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })}
                />
                {activeSuggestionField === 'plate' && plateSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {plateSuggestions.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectSuggestion(p)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors border-b dark:border-slate-700 last:border-0"
                      >
                        <div className="text-blue-500 font-bold">#</div>
                        <div>
                          <div className="text-sm font-bold dark:text-white">{p.vehiclePlate}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">{p.driverName} • {p.company}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {formData.accessType === AccessType.CAMINHAO ? (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">NF / Pedido</label>
                  <input
                    className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-lg dark:text-slate-100"
                    placeholder="Número"
                    value={formData.orderNumber}
                    onChange={e => setFormData({ ...formData, orderNumber: e.target.value })}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Pessoa Visitada</label>
                  <input
                    className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-lg dark:text-slate-100"
                    placeholder="Nome"
                    value={formData.visitedPerson}
                    onChange={e => setFormData({ ...formData, visitedPerson: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          {formData.accessType === AccessType.CAMINHAO && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <input 
                  type="checkbox" 
                  id="isTruck" 
                  className="w-6 h-6 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  checked={formData.isTruck}
                  onChange={e => setFormData({ ...formData, isTruck: e.target.checked })}
                />
                <label htmlFor="isTruck" className="font-semibold text-slate-700 dark:text-slate-300 select-none">Possui Reboque?</label>
              </div>

              {formData.isTruck && (
                <div className="animate-in fade-in duration-300">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Placa Reboque</label>
                  <input
                    className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-lg uppercase dark:text-slate-100 font-mono"
                    placeholder="XYZ9876"
                    value={formData.trailerPlate}
                    onChange={e => setFormData({ ...formData, trailerPlate: e.target.value.toUpperCase() })}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Tipo de Operação</label>
                <div className="grid grid-cols-3 gap-2">
                  {OPERATIONS.map(op => (
                    <button
                      key={op}
                      onClick={() => setFormData({ ...formData, operationType: op as OperationType })}
                      className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                        formData.operationType === op ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(formData.accessType !== AccessType.CAMINHAO) && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Motivo da Visita</label>
              <input
                className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-lg dark:text-slate-100"
                placeholder="Ex: Reunião, Entrega rápida..."
                value={formData.visitReason}
                onChange={e => setFormData({ ...formData, visitReason: e.target.value })}
              />
            </div>
          )}

          <div className="pt-4 border-t dark:border-slate-700">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Enviar Autorização Para:</label>
            <div className="grid grid-cols-1 gap-2">
              {settings.sectorContacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    selectedContact?.id === contact.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 text-blue-800 dark:text-blue-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className="font-bold">{contact.name}</span>
                  <span className="text-xs opacity-60 font-mono">{contact.number}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={!isFormValid() || !selectedContact}
            onClick={handleNextStep}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white p-6 rounded-2xl text-xl font-bold flex items-center justify-center gap-3 mt-8 shadow-lg active:scale-95 transition-all"
          >
            <Icons.Whatsapp /> SOLICITAR ACESSO
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="text-center py-10 space-y-8 animate-in zoom-in duration-300">
          <div className="p-10 bg-blue-50 dark:bg-blue-900/20 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-4 border-4 border-blue-200 dark:border-blue-900/30">
             <div className="animate-bounce text-blue-600 dark:text-blue-400"><Icons.Whatsapp /></div>
          </div>
          <div>
            <p className="text-slate-600 dark:text-slate-300 text-lg px-4">Solicitação enviada para <strong>{selectedContact?.name}</strong>.</p>
            <p className="text-sm font-bold text-slate-400 dark:text-slate-600 mt-2 uppercase tracking-widest">Aguardando Autorização...</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={handleAuthorize}
              className="bg-green-600 hover:bg-green-700 text-white p-8 rounded-2xl text-2xl font-bold shadow-lg active:scale-95 transition-all"
            >
              🟢 AUTORIZAR
            </button>
            <button
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700 text-white p-8 rounded-2xl text-2xl font-bold shadow-lg active:scale-95 transition-all"
            >
              🔴 RECUSAR
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-in slide-in-from-left duration-300">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30 rounded-xl text-green-800 dark:text-green-400 text-center font-bold">
            ENTRADA LIBERADA ÀS {new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Setor de Destino</label>
            <div className="grid grid-cols-2 gap-2">
              {SECTORS.map(s => (
                <button
                  key={s}
                  onClick={() => setFormData({ ...formData, sector: s as DestinationSector })}
                  className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                    formData.sector === s ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-500 uppercase mb-1">Observações Portaria</label>
            <textarea
              className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 text-lg dark:text-slate-100"
              placeholder="Notas adicionais..."
              rows={3}
              value={formData.observations}
              onChange={e => setFormData({ ...formData, observations: e.target.value })}
            />
          </div>

          <button
            onClick={handleFinalRegister}
            className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-6 rounded-2xl text-xl font-bold flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"
          >
            ✅ REGISTRAR ENTRADA
          </button>
        </div>
      )}
    </div>
  );
};

const AccessTypeButton = ({ icon, label, onClick }: { icon: string, label: string, onClick: () => void }) => (
  <button
    onClick={onClick}
    className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-6 rounded-2xl flex flex-col items-center gap-3 shadow-sm hover:border-blue-500 dark:hover:border-blue-700 transition-all active:scale-95"
  >
    <span className="text-4xl">{icon}</span>
    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm uppercase">{label}</span>
  </button>
);

export default NewEntryFlow;
