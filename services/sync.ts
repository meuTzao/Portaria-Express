
import { supabase } from '../lib/supabaseClient';
import { db } from './db';
import { STORAGE_KEYS } from '../constants';
import { AppSettings, SyncStatus } from '../types';

export const syncService = {
  
  async checkConnection(): Promise<boolean> {
    try {
      const { error } = await supabase.from('app_settings').select('user_id').limit(1);
      return !error || error.code !== 'PGRST301';
    } catch { return false; }
  },

  withTimeout<T>(promise: Promise<T>, timeoutMs: number = 90000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Tempo limite atingido.')), timeoutMs))
    ]);
  },

  async syncAllModules(onStatusChange?: (status: SyncStatus) => void): Promise<{ success: boolean; message: string }> {
    if (!navigator.onLine) return { success: false, message: 'Sem conexão com a internet.' };
    if (onStatusChange) onStatusChange('syncing');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");
      const userId = session.user.id;

      const runSync = async () => {
        // 1. Processa deleções
        await this.processDeletionQueue();
        
        // 2. Push (Local -> Nuvem)
        const pushResults = await this.pushAllModules(userId);
        
        // 3. Pull (Nuvem -> Local) - IMPORTANTE: Aqui os contatos são baixados
        const pullResults = await this.pullAllModules(userId);

        const totalChanges = pullResults.totalAdded + pullResults.totalUpdated;
        
        if (pushResults.errors > 0) {
           return { success: false, message: `Sync parcial: ${pushResults.errors} falhas.` };
        }

        return { 
          success: true, 
          message: totalChanges > 0 ? `Sync OK! +${totalChanges} registros.` : 'Tudo atualizado.' 
        };
      };

      const result = await this.withTimeout(runSync(), 180000);
      if (onStatusChange) onStatusChange(result.success ? 'success' : 'error');
      return result;

    } catch (err: any) {
      console.error("❌ Erro no sync:", err);
      if (onStatusChange) onStatusChange('error');
      return { success: false, message: err.message || 'Falha de comunicação.' };
    }
  },

  async processDeletionQueue() {
    const queue = db.getDeletedQueue();
    if (queue.length === 0) return;
    const processedIds: string[] = [];
    const byTable: Record<string, string[]> = {};
    
    queue.forEach((item: any) => {
      if (!byTable[item.table]) byTable[item.table] = [];
      byTable[item.table].push(item.id);
    });

    for (const table of Object.keys(byTable)) {
      try {
        const { error } = await supabase.from(table).delete().in('id', byTable[table]);
        if (!error) processedIds.push(...byTable[table]);
      } catch (e) { console.warn(`Falha ao deletar ${table}`, e); }
    }
    db.clearDeletedQueue(processedIds);
  },

  async pushAllModules(userId: string): Promise<{ success: number; errors: number }> {
    let stats = { success: 0, errors: 0 };
    const safePush = async (name: string, fn: () => Promise<any>) => {
      try { await fn(); stats.success++; } 
      catch (e) { console.error(`Erro [${name}]:`, e); stats.errors++; }
    };

    // Ajustes SEMPRE primeiro para garantir que contatos subam
    await safePush('Settings', () => this.pushSettings(userId));
    await safePush('Entries', () => this.pushEntries(userId));
    await safePush('Breakfast', () => this.pushBreakfast(userId));
    await safePush('Packages', () => this.pushPackages(userId));
    await safePush('Shifts', () => this.pushShifts(userId));
    await safePush('Meters', () => this.pushMeters(userId));
    await safePush('Readings', () => this.pushMeterReadingsChunked(userId));
    await safePush('Patrols', () => this.pushPatrolsChunked(userId));
    await safePush('Logs', () => this.pushLogs(userId));

    return stats;
  },

  async pushSettings(userId: string) {
    const settings = db.getSettings();
    // Se não estiver sincronizado localmente, envia para a nuvem
    if (settings.synced) return;

    const payload = {
      user_id: userId, 
      company_name: settings.companyName, 
      device_name: settings.deviceName,
      theme: settings.theme, 
      font_size: settings.fontSize, 
      sector_contacts: settings.sectorContacts, // Array de contatos do WhatsApp
      updated_at: settings.updated_at || new Date().toISOString() // Usa data local ou nova se não existir
    };
    
    const { error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
    
    // Marca como sincronizado localmente
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...settings, synced: true }));
  },

  async pushEntries(userId: string) {
    const records = db.getUnsyncedItems<any>(STORAGE_KEYS.ENTRIES);
    if (records.length === 0) return;
    const payload = records.map(r => ({
      id: r.id, user_id: userId, access_type: r.accessType, driver_name: r.driverName,
      company: r.company, supplier: r.supplier, operation_type: r.operationType,
      order_number: r.order_number || r.orderNumber, vehicle_plate: r.vehiclePlate, trailer_plate: r.trailerPlate,
      is_truck: r.isTruck, document_number: r.documentNumber, visit_reason: r.visitReason,
      visited_person: r.visitedPerson, status: r.status, rejection_reason: r.rejectionReason,
      entry_time: r.entryTime, exit_time: r.exitTime, volumes: r.volumes, sector: r.sector,
      observations: r.observations, exit_observations: r.exitObservations,
      created_at: r.createdAt, updated_at: r.updated_at || new Date().toISOString(),
      operator_name: r.operatorName, device_name: r.deviceName, authorized_by: r.authorizedBy, origin: r.origin
    }));
    const { error } = await supabase.from('vehicle_entries').upsert(payload);
    if (error) throw error;
    db.markAsSynced(STORAGE_KEYS.ENTRIES, records.map(r => r.id));
  },

  async pushBreakfast(userId: string) {
    const records = db.getUnsyncedItems<any>(STORAGE_KEYS.BREAKFAST);
    if (records.length === 0) return;
    const payload = records.map(r => ({
      id: r.id, user_id: userId, person_name: r.personName, breakfast_type: r.breakfastType,
      status: r.status, delivered_at: r.deliveredAt, operator_name: r.operatorName,
      date: r.date, observations: r.observations, origin: r.origin, 
      created_at: r.created_at || new Date().toISOString(), updated_at: r.updated_at || new Date().toISOString()
    }));
    const { error } = await supabase.from('breakfast_list').upsert(payload);
    if (error) throw error;
    db.markAsSynced(STORAGE_KEYS.BREAKFAST, records.map(r => r.id));
  },

  async pushPackages(userId: string) {
    const records = db.getUnsyncedItems<any>(STORAGE_KEYS.PACKAGES);
    if (records.length === 0) return;
    const payload = records.map(r => ({
      id: r.id, user_id: userId, delivery_company: r.deliveryCompany, recipient_name: r.recipientName,
      description: r.description, operator_name: r.operatorName, received_at: r.receivedAt,
      status: r.status, delivered_at: r.deliveredAt, delivered_to: r.deliveredTo, pickup_type: r.pickupType,
      created_at: r.created_at || new Date().toISOString(), updated_at: r.updated_at || new Date().toISOString()
    }));
    const { error } = await supabase.from('packages').upsert(payload);
    if (error) throw error;
    db.markAsSynced(STORAGE_KEYS.PACKAGES, records.map(r => r.id));
  },

  async pushMeters(userId: string) {
    const records = db.getUnsyncedItems<any>(STORAGE_KEYS.METERS);
    if (records.length === 0) return;
    const payload = records.map(r => ({
      id: r.id, user_id: userId, name: r.name, type: r.type, unit: r.unit, custom_unit: r.customUnit,
      active: r.active, created_at: r.createdAt, updated_at: r.updated_at || new Date().toISOString()
    }));
    const { error } = await supabase.from('meters').upsert(payload);
    if (error) throw error;
    db.markAsSynced(STORAGE_KEYS.METERS, records.map(r => r.id));
  },

  async pushMeterReadingsChunked(userId: string) {
    const records = db.getUnsyncedItems<any>(STORAGE_KEYS.METER_READINGS);
    if (records.length === 0) return;
    for (const r of records) {
      const payload = {
        id: r.id, user_id: userId, meter_id: r.meterId, value: r.value, consumption: r.consumption,
        observation: r.observation, operator: r.operator, timestamp: r.timestamp,
        photo: r.photo, created_at: r.created_at || new Date().toISOString(), updated_at: r.updated_at || new Date().toISOString()
      };
      const { error } = await supabase.from('meter_readings').upsert(payload);
      if (!error) db.markAsSynced(STORAGE_KEYS.METER_READINGS, [r.id]);
    }
  },

  async pushPatrolsChunked(userId: string) {
    const records = db.getUnsyncedItems<any>(STORAGE_KEYS.PATROLS);
    if (records.length === 0) return;
    for (const r of records) {
      const payload = {
        id: r.id, user_id: userId, data: r.data, hora_inicio: r.horaInicio, hora_fim: r.horaFim,
        duracao_minutos: r.duracaoMinutos, porteiro: r.porteiro, status: r.status,
        observacoes: r.observacoes, fotos: r.fotos, created_at: r.createdAt, updated_at: r.updated_at || new Date().toISOString()
      };
      const { error } = await supabase.from('patrols').upsert(payload);
      if (!error) db.markAsSynced(STORAGE_KEYS.PATROLS, [r.id]);
    }
  },

  async pushShifts(userId: string) {
    const records = db.getUnsyncedItems<any>(STORAGE_KEYS.SHIFTS);
    if (records.length === 0) return;
    const payload = records.map(r => ({
      id: r.id, user_id: userId, operator_name: r.operatorName, date: r.date,
      clock_in: r.clockIn, lunch_start: r.lunchStart, lunch_end: r.lunchEnd, clock_out: r.clockOut,
      created_at: r.created_at || new Date().toISOString(), updated_at: r.updated_at || new Date().toISOString()
    }));
    const { error } = await supabase.from('work_shifts').upsert(payload);
    if (error) throw error;
    db.markAsSynced(STORAGE_KEYS.SHIFTS, records.map(r => r.id));
  },

  async pushLogs(userId: string) {
    const records = db.getUnsyncedItems<any>(STORAGE_KEYS.LOGS);
    if (records.length === 0) return;
    const payload = records.map(r => ({
      id: r.id, user_id: userId, timestamp: r.timestamp, user_name: r.user, module: r.module,
      action: r.action, reference_id: r.referenceId, details: r.details, created_at: r.created_at || new Date().toISOString()
    }));
    const { error } = await supabase.from('app_logs').upsert(payload);
    if (error) throw error;
    db.markAsSynced(STORAGE_KEYS.LOGS, records.map(r => r.id));
  },

  async pullAllModules(userId: string) {
    const results = { totalAdded: 0, totalUpdated: 0 };
    
    // 1. PULL CONFIGURAÇÕES (Sempre puxa a mais recente, sem limite de data)
    try {
      const { data: cloudSets, error: setErr } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!setErr && cloudSets) {
        const local = db.getSettings();
        // Se a nuvem for mais nova que o registro local, atualiza contatos
        if (!local.updated_at || new Date(cloudSets.updated_at) > new Date(local.updated_at)) {
          const mapped = {
            companyName: cloudSets.company_name,
            deviceName: cloudSets.device_name,
            theme: cloudSets.theme,
            fontSize: cloudSets.font_size,
            sectorContacts: cloudSets.sector_contacts || [],
            updated_at: cloudSets.updated_at,
            synced: true
          };
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(mapped));
          results.totalUpdated++;
        }
      }
    } catch (e) { console.warn("Erro ao puxar contatos"); }

    // 2. OUTROS MÓDULOS (Limite de 3 dias para performance)
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 3);

    const modules = [
      { table: 'vehicle_entries', key: STORAGE_KEYS.ENTRIES },
      { table: 'breakfast_list', key: STORAGE_KEYS.BREAKFAST },
      { table: 'packages', key: STORAGE_KEYS.PACKAGES },
      { table: 'meters', key: STORAGE_KEYS.METERS },
      { table: 'meter_readings', key: STORAGE_KEYS.METER_READINGS },
      { table: 'patrols', key: STORAGE_KEYS.PATROLS },
      { table: 'work_shifts', key: STORAGE_KEYS.SHIFTS }
    ];

    for (const mod of modules) {
      try {
        const { data, error } = await supabase
          .from(mod.table)
          .select('*')
          .eq('user_id', userId)
          .gt('updated_at', dateLimit.toISOString());

        if (!error && data) {
          const mappedData = this.mapToLocal(mod.table, data);
          const res = db.upsertFromCloud(mod.key, mappedData);
          results.totalAdded += res.added;
          results.totalUpdated += res.updated;
        }
      } catch (e) { console.warn(`Falha no pull: ${mod.table}`); }
    }
    return results;
  },

  mapToLocal(table: string, data: any[]): any[] {
    return data.map(r => {
      switch (table) {
        case 'vehicle_entries': return {
          id: r.id, accessType: r.access_type, driverName: r.driver_name, company: r.company,
          supplier: r.supplier, operationType: r.operation_type, orderNumber: r.order_number,
          vehiclePlate: r.vehicle_plate, trailerPlate: r.trailer_plate, isTruck: r.is_truck,
          documentNumber: r.document_number, visitReason: r.visit_reason, visitedPerson: r.visited_person,
          status: r.status, rejectionReason: r.rejection_reason, entryTime: r.entry_time, exitTime: r.exit_time,
          volumes: r.volumes, sector: r.sector, observations: r.observations, exitObservations: r.exit_observations,
          createdAt: r.created_at, updated_at: r.updated_at, operatorName: r.operator_name,
          deviceName: r.device_name, authorizedBy: r.authorized_by, origin: r.origin
        };
        case 'breakfast_list': return {
          id: r.id, personName: r.person_name, breakfastType: r.breakfast_type, status: r.status,
          deliveredAt: r.delivered_at, operatorName: r.operator_name, date: r.date,
          observations: r.observations, origin: r.origin, created_at: r.created_at, updated_at: r.updated_at
        };
        case 'packages': return {
          id: r.id, deliveryCompany: r.delivery_company, recipientName: r.recipient_name,
          description: r.description, operatorName: r.operator_name, receivedAt: r.received_at,
          status: r.status, deliveredAt: r.delivered_at, deliveredTo: r.delivered_to,
          pickupType: r.pickup_type, created_at: r.created_at, updated_at: r.updated_at
        };
        case 'meters': return {
          id: r.id, name: r.name, type: r.type, unit: r.unit, customUnit: r.custom_unit,
          active: r.active, createdAt: r.created_at, updated_at: r.updated_at
        };
        case 'meter_readings': return {
          id: r.id, meterId: r.meter_id, value: r.value, consumption: r.consumption,
          observation: r.observation, operator: r.operator, timestamp: r.timestamp,
          photo: r.photo, created_at: r.created_at, updated_at: r.updated_at
        };
        case 'patrols': return {
          id: r.id, data: r.data, horaInicio: r.hora_inicio, horaFim: r.hora_fim,
          duracaoMinutos: r.duracao_minutos, porteiro: r.porteiro, status: r.status,
          observacoes: r.observacoes, fotos: r.fotos, createdAt: r.created_at, updated_at: r.updated_at
        };
        case 'work_shifts': return {
          id: r.id, operatorName: r.operator_name, date: r.date,
          clockIn: r.clock_in, lunchStart: r.lunch_start, lunch_end: r.lunch_end, clockOut: r.clock_out,
          created_at: r.created_at, updated_at: r.updated_at
        };
        default: return r;
      }
    });
  }
};
