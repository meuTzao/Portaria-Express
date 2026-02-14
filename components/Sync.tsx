
import React, { useState, useRef } from 'react';
import { db } from '../services/db';
import { VehicleEntry, ImportOrigin } from '../types';
import { Icons } from '../constants';

interface SyncProps {
  entries: VehicleEntry[];
  onUpdate: () => void;
  onBack: () => void;
}

const Sync: React.FC<SyncProps> = ({ entries, onUpdate, onBack }) => {
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    const session = db.getSession();
    const operatorName = session?.operatorName || 'Porteiro';
    const date = new Date().toISOString().split('T')[0];
    const defaultFilename = `${operatorName}_${date}.json`;

    const dataStr = JSON.stringify({
      version: "1.0",
      exportedBy: operatorName,
      exportedAt: new Date().toISOString(),
      entries: entries
    }, null, 2);

    // Tenta usar a File System Access API para permitir escolher local (Desktop/Chrome moderno)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [{
            description: 'JSON Backup',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(dataStr);
        await writable.close();
        setStatus({ type: 'success', msg: 'Backup salvo com sucesso!' });
        return;
      } catch (err) {
        // Se o usuário cancelar, apenas retorna
        if ((err as Error).name === 'AbortError') return;
        console.error(err);
        // Fallback para download padrão em caso de erro no seletor
      }
    }

    // Fallback para dispositivos mobile/tablets Android onde a API Picker não é suportada
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultFilename;
    link.click();
    URL.revokeObjectURL(url);
    setStatus({ type: 'success', msg: 'Backup JSON baixado!' });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json.entries)) {
          const added = db.importEntries(json.entries, ImportOrigin.FILE);
          setStatus({ type: 'success', msg: `${added} novos registros adicionados!` });
          onUpdate();
        } else {
          throw new Error('Formato inválido');
        }
      } catch (err) {
        setStatus({ type: 'error', msg: 'Erro ao ler arquivo. Verifique o formato.' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={onBack} className="p-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg">
           ←
        </button>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Sincronização Manual</h2>
      </div>

      {status && (
        <div className={`p-4 rounded-xl flex items-center justify-between ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <span className="text-sm font-bold">{status.msg}</span>
          <button onClick={() => setStatus(null)}>✕</button>
        </div>
      )}

      <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6 text-center">
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto"><Icons.File /></div>
        
        <div>
           <h3 className="font-bold dark:text-white text-lg">Transferência via Arquivo JSON</h3>
           <p className="text-xs text-slate-500 mt-2 px-6">Use esta opção para mover o banco de dados entre dispositivos ou fazer cópias de segurança offline.</p>
        </div>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={exportData}
            className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-5 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
          >
            📤 EXPORTAR DADOS (BACKUP)
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-200"
          >
            📥 IMPORTAR DADOS (UNIR)
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".json" 
            onChange={handleImportFile}
          />
        </div>
      </section>

      <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
           <span className="text-blue-500">ℹ</span> Regras de Segurança
         </h4>
         <ul className="text-[10px] space-y-2 text-slate-500 dark:text-slate-400 list-disc ml-4">
           <li><strong>Sem Duplicidade:</strong> O sistema identifica registros existentes pelo ID único e nunca cria duplicatas.</li>
           <li><strong>Preservação Local:</strong> Registros já existentes no seu dispositivo não são alterados por importações.</li>
           <li><strong>Rastreabilidade:</strong> Cada registro importado mantém sua auditoria original (quem criou e onde).</li>
           <li><strong>Nome de Arquivo:</strong> O arquivo sugerido contém o seu nome e a data atual para facilitar a organização.</li>
         </ul>
      </div>
    </div>
  );
};

export default Sync;
