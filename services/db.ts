
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
      return data ? JSON.parse(data) : [];
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

  // Fix: DeletedItem is now defined above
  markForDeletion: (id: string, table: string) => {
    const queue: DeletedItem[] = JSON.parse(localStorage.getItem(DELETED_QUEUE_KEY) || '[]');
    queue.push({ id, table, timestamp: new Date().toISOString() });
    localStorage.setItem(DELETED_QUEUE_KEY, JSON.stringify(queue));
  },

  getDeletedQueue: () => JSON.parse(localStorage.getItem(DELETED_QUEUE_KEY) || '[]'),

  clearDeletedQueue: (idsToRemove: string[]) => {
    let queue = JSON.parse(localStorage.getItem(DELETED_QUEUE_KEY) || '[]');
    queue = queue.filter((item: any) => !idsToRemove.includes(item.id));
    localStorage.setItem(DELETED_QUEUE_KEY, JSON.stringify(queue));
  },

  markAsSynced: (key: string, ids: string[]) => {
    try {
      const dataStr = localStorage.getItem(key);
      if (!dataStr) return;
      const list = JSON.parse(dataStr);
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
      return list.filter((item: any) => item.synced !== true);
    } catch (e) { return []; }
  },

  // --- SESSÃO ---
  getSession: (): UserSession | null => {
    const active = sessionStorage.getItem(SESSION_KEY); 
    const data = localStorage.getItem(STORAGE_KEYS.SESSION);
    return active ? { operatorName: JSON.parse(active).username, loginTime: '' } : (data ? JSON.parse(data) : null);
  },
  saveSession: (session: UserSession) => localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session)),
  clearSession: () => localStorage.removeItem(STORAGE_KEYS.SESSION),

  // --- LOGS ---
  getLogs: (): AppLog[] => {
    const data = localStorage.getItem(STORAGE_KEYS.LOGS);
    return data ? JSON.parse(data) : [];
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
  getPatrols: (): PatrolRecord[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.PATROLS) || '[]'),
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
  getMeters: (): Meter[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.METERS) || '[]'),
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
  getReadings: (): MeterReading[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.METER_READINGS) || '[]'),
  saveReadings: (list: MeterReading[]) => localStorage.setItem(STORAGE_KEYS.METER_READINGS, JSON.stringify(list)),
  addReading: (reading: MeterReading) => {
    const list = db.getReadings();
    const now = new Date().toISOString();
    list.push({ ...reading, id: reading.id || generateUUID(), synced: false, timestamp: reading.timestamp || now, updated_at: now });
    db.saveReadings(list);
  },
  getReadingsByMeter: (meterId: string) => db.getReadings().filter(r => r.meterId === meterId).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),

  // --- CAFÉ ---
  getBreakfastList: (): BreakfastRecord[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.BREAKFAST) || '[]'),
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
  getPackages: (): PackageRecord[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.PACKAGES) || '[]'),
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
  getEntries: (): VehicleEntry[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.ENTRIES) || '[]'),
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
  getShifts: (): WorkShift[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.SHIFTS) || '[]'),
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
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : { sectorContacts: [], companyName: 'Portaria PX', deviceName: 'Estação Principal', theme: 'light', fontSize: 'medium', synced: true };
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
    const data = JSON.parse(jsonStr);
    if (data.entries) db.saveEntries(data.entries);
    if (data.breakfast) db.saveBreakfastList(data.breakfast);
    if (data.packages) db.savePackages(data.packages);
    if (data.meters) db.saveMeters(data.meters);
    if (data.readings) db.saveReadings(data.readings);
    if (data.shifts) db.saveShifts(data.shifts);
    if (data.logs) db.saveLogs(data.logs);
    if (data.patrols) db.savePatrols(data.patrols);
    if (data.settings) db.saveSettings(data.settings);
  }
};
