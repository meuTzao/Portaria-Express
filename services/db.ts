
import { 
  VehicleEntry, AppSettings, UserSession, ImportOrigin, 
  WorkShift, BreakfastRecord, PackageRecord, Meter, 
  MeterReading, ShiftBackupPayload, AppLog, PatrolRecord, InternalUser 
} from '../types';
import { STORAGE_KEYS } from '../constants';

const DELETED_QUEUE_KEY = 'portaria_express_deleted_queue';
const SESSION_KEY = 'portaria_express_active_session_v2';

// Define DeletedItem interface used by the deletion queue
interface DeletedItem {
  id: string;
  table: string;
  timestamp: string;
}

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const db = {
  // --- CACHE DE USUÁRIOS INTERNOS ---
  getUsersCache: (): InternalUser[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS_CACHE);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },
  saveUsersCache: (users: InternalUser[]) => {
    localStorage.setItem(STORAGE_KEYS.USERS_CACHE, JSON.stringify(users));
  },
  updateUserInCache: (user: InternalUser) => {
    const cache = db.getUsersCache();
    const index = cache.findIndex(u => u.id === user.id);
    if (index !== -1) {
      cache[index] = user;
    } else {
      cache.push(user);
    }
    db.saveUsersCache(cache);
  },

  // --- SINCRONIZAÇÃO CORE ---
  upsertFromCloud: <T extends { id: string, synced?: boolean }>(key: string, cloudItems: T[]) => {
    try {
      const localDataStr = localStorage.getItem(key);
      let localList: T[] = localDataStr ? JSON.parse(localDataStr) : [];
      if (!Array.isArray(localList)) localList = [];
      
      const localIds = new Set(localList.map(item => item.id));
      
      let addedCount = 0;
      let updatedCount = 0;

      cloudItems.forEach(cloudItem => {
        const itemToStore = { ...cloudItem, synced: true };
        if (localIds.has(cloudItem.id)) {
          const index = localList.findIndex(i => i.id === cloudItem.id);
          if (localList[index].synced) {
            localList[index] = itemToStore;
            updatedCount++;
          }
        } else {
          localList.push(itemToStore);
          addedCount++;
        }
      });

      if (addedCount > 0 || updatedCount > 0) {
        localStorage.setItem(key, JSON.stringify(localList));
      }
      return { added: addedCount, updated: updatedCount };
    } catch (e) {
      console.error(`Erro no upsert cloud: ${key}`, e);
      return { added: 0, updated: 0 };
    }
  },

  markForDeletion: (id: string, table: string) => {
    let queue: DeletedItem[] = [];
    try {
      const stored = localStorage.getItem(DELETED_QUEUE_KEY);
      queue = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(queue)) queue = [];
    } catch (e) { queue = []; }

    queue.push({ id, table, timestamp: new Date().toISOString() });
    localStorage.setItem(DELETED_QUEUE_KEY, JSON.stringify(queue));
  },

  getDeletedQueue: () => {
    try {
      const stored = localStorage.getItem(DELETED_QUEUE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },

  clearDeletedQueue: (idsToRemove: string[]) => {
    let queue = db.getDeletedQueue();
    queue = queue.filter((item: any) => !idsToRemove.includes(item.id));
    localStorage.setItem(DELETED_QUEUE_KEY, JSON.stringify(queue));
  },

  markAsSynced: (key: string, ids: string[]) => {
    try {
      const dataStr = localStorage.getItem(key);
      if (!dataStr) return;
      const list = JSON.parse(dataStr);
      if (!Array.isArray(list)) return;
      const updatedList = list.map((item: any) => {
        if (ids.includes(item.id)) return { ...item, synced: true };
        return item;
      });
      localStorage.setItem(key, JSON.stringify(updatedList));
    } catch (e) { console.error(`Erro ao marcar sync em ${key}`, e); }
  },

  getUnsyncedItems: <T>(key: string): T[] => {
    try {
      const dataStr = localStorage.getItem(key);
      if (!dataStr) return [];
      const list = JSON.parse(dataStr);
      if (!Array.isArray(list)) return [];
      return list.filter((item: any) => item.synced !== true);
    } catch (e) { return []; }
  },

  // --- SESSÃO ---
  getSession: (): UserSession | null => {
    try {
      const active = sessionStorage.getItem(SESSION_KEY); 
      const data = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (active) {
        const parsed = JSON.parse(active);
        return { operatorName: parsed.username, loginTime: '' };
      }
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },
  saveSession: (session: UserSession) => localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session)),
  clearSession: () => localStorage.removeItem(STORAGE_KEYS.SESSION),

  // --- LOGS ---
  getLogs: (): AppLog[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOGS);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },
  saveLogs: (logs: AppLog[]) => localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(-2000))),
  addLog: (module: AppLog['module'], action: string, refId?: string, details?: string) => {
    const logs = db.getLogs();
    const session = db.getSession();
    const now = new Date().toISOString();
    const newLog: AppLog = {
      id: generateUUID(), timestamp: now, user: session?.operatorName || "Sistema",
      module, action, referenceId: refId, details, synced: false, created_at: now, updated_at: now
    };
    logs.push(newLog);
    db.saveLogs(logs);
  },

  // --- RONDAS ---
  getPatrols: (): PatrolRecord[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PATROLS);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },
  savePatrols: (list: PatrolRecord[]) => localStorage.setItem(STORAGE_KEYS.PATROLS, JSON.stringify(list)),
  addPatrol: (patrol: PatrolRecord) => {
    const list = db.getPatrols();
    const now = new Date().toISOString();
    list.push({ ...patrol, id: patrol.id || generateUUID(), synced: false, criadoEm: now, updated_at: now });
    db.savePatrols(list);
  },
  updatePatrol: (updated: PatrolRecord) => {
    const list = db.getPatrols();
    const index = list.findIndex(p => p.id === updated.id);
    if (index !== -1) {
      list[index] = { ...updated, synced: false, updated_at: new Date().toISOString() };
      db.savePatrols(list);
    }
  },
  deletePatrol: (id: string) => {
    const list = db.getPatrols();
    db.savePatrols(list.filter(p => p.id !== id));
    db.markForDeletion(id, 'patrols');
  },

  // --- MEDIDORES ---
  getMeters: (): Meter[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.METERS);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },
  saveMeters: (list: Meter[]) => localStorage.setItem(STORAGE_KEYS.METERS, JSON.stringify(list)),
  addMeter: (meter: Meter) => {
    const list = db.getMeters();
    const now = new Date().toISOString();
    list.push({ ...meter, id: meter.id || generateUUID(), synced: false, createdAt: now, updated_at: now });
    db.saveMeters(list);
  },
  deleteMeter: (id: string) => {
    const list = db.getMeters();
    db.saveMeters(list.filter(m => m.id !== id));
    db.markForDeletion(id, 'meters');
  },

  // --- LEITURAS ---
  getReadings: (): MeterReading[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.METER_READINGS);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },
  saveReadings: (list: MeterReading[]) => localStorage.setItem(STORAGE_KEYS.METER_READINGS, JSON.stringify(list)),
  addReading: (reading: MeterReading) => {
    const list = db.getReadings();
    const now = new Date().toISOString();
    list.push({ ...reading, id: reading.id || generateUUID(), synced: false, timestamp: reading.timestamp || now, updated_at: now });
    db.saveReadings(list);
  },
  getReadingsByMeter: (meterId: string) => db.getReadings().filter(r => r.meterId === meterId).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),

  // --- CAFÉ ---
  getBreakfastList: (): BreakfastRecord[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BREAKFAST);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },
  saveBreakfastList: (list: BreakfastRecord[]) => localStorage.setItem(STORAGE_KEYS.BREAKFAST, JSON.stringify(list)),
  markBreakfastDelivered: (id: string, operatorName: string) => {
    const list = db.getBreakfastList();
    const index = list.findIndex(item => item.id === id);
    if (index !== -1) {
      const now = new Date().toISOString();
      list[index].status = 'Entregue';
      list[index].deliveredAt = now;
      list[index].operatorName = operatorName;
      list[index].synced = false;
      list[index].updated_at = now;
      db.saveBreakfastList(list);
    }
  },
  addBreakfastPerson: (person: BreakfastRecord) => {
    const list = db.getBreakfastList();
    const now = new Date().toISOString();
    list.push({ ...person, id: person.id || generateUUID(), synced: false, updated_at: now });
    db.saveBreakfastList(list);
  },
  clearBreakfastByDate: (date: string) => {
    const list = db.getBreakfastList();
    const toRemove = list.filter(item => item.date === date);
    db.saveBreakfastList(list.filter(item => item.date !== date));
    toRemove.forEach(item => db.markForDeletion(item.id, 'breakfast_list'));
  },

  // --- ENCOMENDAS ---
  getPackages: (): PackageRecord[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PACKAGES);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },
  savePackages: (list: PackageRecord[]) => localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(list)),
  addPackage: (record: PackageRecord) => {
    const list = db.getPackages();
    const now = new Date().toISOString();
    list.push({ ...record, id: record.id || generateUUID(), synced: false, receivedAt: now, updated_at: now });
    db.savePackages(list);
  },
  updatePackage: (updated: PackageRecord) => {
    const list = db.getPackages();
    const index = list.findIndex(p => p.id === updated.id);
    if (index !== -1) {
      list[index] = { ...updated, synced: false, updated_at: new Date().toISOString() };
      db.savePackages(list);
    }
  },
  deletePackage: (id: string) => {
    const list = db.getPackages();
    db.savePackages(list.filter(p => p.id !== id));
    db.markForDeletion(id, 'packages');
  },

  // --- PORTARIA ---
  getEntries: (): VehicleEntry[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ENTRIES);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },
  saveEntries: (entries: VehicleEntry[]) => localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries)),
  addEntry: (entry: VehicleEntry) => {
    const entries = db.getEntries();
    const now = new Date().toISOString();
    entries.push({ ...entry, id: entry.id || generateUUID(), synced: false, createdAt: entry.createdAt || now, updated_at: now });
    db.saveEntries(entries);
  },
  updateEntry: (updatedEntry: VehicleEntry) => {
    const entries = db.getEntries();
    const index = entries.findIndex(e => e.id === updatedEntry.id);
    if (index !== -1) {
      entries[index] = { ...updatedEntry, synced: false, updated_at: new Date().toISOString() };
      db.saveEntries(entries);
    }
  },
  deleteProfileEntries: (name: string, plate: string) => {
    const entries = db.getEntries();
    const toRemove = entries.filter(e => e.driverName.toLowerCase() === name.toLowerCase() && (e.vehiclePlate || '').toLowerCase() === plate.toLowerCase());
    db.saveEntries(entries.filter(e => !(e.driverName.toLowerCase() === name.toLowerCase() && (e.vehiclePlate || '').toLowerCase() === plate.toLowerCase())));
    toRemove.forEach(e => db.markForDeletion(e.id, 'vehicle_entries'));
  },
  updateProfileEntries: (oldName: string, oldPlate: string, updates: Partial<VehicleEntry>) => {
    const entries = db.getEntries();
    const now = new Date().toISOString();
    const updated = entries.map(e => (e.driverName.toLowerCase() === oldName.toLowerCase() && (e.vehiclePlate || '').toLowerCase() === oldPlate.toLowerCase()) ? { ...e, ...updates, synced: false, updated_at: now } : e);
    db.saveEntries(updated);
  },
  importEntries: (newEntries: VehicleEntry[], origin: ImportOrigin) => {
    const current = db.getEntries();
    const currentIds = new Set(current.map(e => e.id));
    let addedCount = 0;
    newEntries.forEach(entry => {
      if (!currentIds.has(entry.id)) {
        current.push({ ...entry, origin, synced: false });
        addedCount++;
      }
    });
    if (addedCount > 0) db.saveEntries(current);
    return addedCount;
  },

  // --- PONTO ---
  getShifts: (): WorkShift[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SHIFTS);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  },
  saveShifts: (shifts: WorkShift[]) => localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts)),
  updateShift: (updatedShift: WorkShift) => {
    const shifts = db.getShifts();
    const now = new Date().toISOString();
    const index = shifts.findIndex(s => s.id === updatedShift.id);
    if (index !== -1) shifts[index] = { ...updatedShift, synced: false, updated_at: now };
    else shifts.push({ ...updatedShift, id: updatedShift.id || generateUUID(), synced: false, updated_at: now });
    db.saveShifts(shifts);
  },

  // --- SETTINGS ---
  getSettings: (): AppSettings => {
    const defaults: AppSettings = { 
      sectorContacts: [], 
      companyName: 'Portaria PX', 
      deviceName: 'Estação Principal', 
      theme: 'light', 
      fontSize: 'medium', 
      synced: true 
    };

    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...defaults,
          ...parsed,
          // Ensure arrays are arrays if they happened to be null/undefined in storage
          sectorContacts: Array.isArray(parsed.sectorContacts) ? parsed.sectorContacts : []
        };
      }
      return defaults;
    } catch (e) {
      return defaults;
    }
  },
  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ 
      ...settings, 
      synced: false, 
      updated_at: new Date().toISOString() 
    }));
  },

  // --- DRAFTS & BACKUPS ---
  getDraft: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DRAFT);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },
  saveDraft: (formData: any, step: number) => localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify({ formData, step })),
  clearDraft: () => localStorage.removeItem(STORAGE_KEYS.DRAFT),
  exportCompleteBackup: () => JSON.stringify({ entries: db.getEntries(), breakfast: db.getBreakfastList(), packages: db.getPackages(), meters: db.getMeters(), readings: db.getReadings(), shifts: db.getShifts(), logs: db.getLogs(), patrols: db.getPatrols(), settings: db.getSettings() }),
  importCompleteBackup: (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.entries && Array.isArray(data.entries)) db.saveEntries(data.entries);
      if (data.breakfast && Array.isArray(data.breakfast)) db.saveBreakfastList(data.breakfast);
      if (data.packages && Array.isArray(data.packages)) db.savePackages(data.packages);
      if (data.meters && Array.isArray(data.meters)) db.saveMeters(data.meters);
      if (data.readings && Array.isArray(data.readings)) db.saveReadings(data.readings);
      if (data.shifts && Array.isArray(data.shifts)) db.saveShifts(data.shifts);
      if (data.logs && Array.isArray(data.logs)) db.saveLogs(data.logs);
      if (data.patrols && Array.isArray(data.patrols)) db.savePatrols(data.patrols);
      if (data.settings) db.saveSettings(data.settings);
    } catch (e) {
      console.error("Erro ao importar backup completo", e);
      throw new Error("Formato de arquivo inválido.");
    }
  }
};
