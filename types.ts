
export enum OperationType {
  ENTREGA = 'Entrega',
  COLETA = 'Coleta',
  SERVICO = 'Serviço'
}

export enum AccessType {
  CAMINHAO = 'Caminhão',
  CARRO = 'Carro',
  MOTO = 'Moto',
  PEDESTRE = 'Visitante a pé'
}

export enum DestinationSector {
  LOGISTICA = 'Logística',
  ALMOXARIFADO = 'Almoxarifado',
  MANUTENCAO = 'Manutenção',
  OUTRO = 'Outro'
}

export enum EntryStatus {
  PENDENTE = 'Pendente',
  AUTORIZADO = 'Autorizado',
  RECUSADO = 'Recusado',
  FINALIZADO = 'Finalizado'
}

export enum ImportOrigin {
  LOCAL = 'LOCAL',
  FILE = 'ARQUIVO'
}

// Interface base para sincronização
interface SyncableRecord {
  synced?: boolean;
  updated_at?: string;
  created_at?: string; // Padronizar created_at
}

export interface SectorContact {
  id: string;
  name: string;
  number: string;
}

export interface WorkShift extends SyncableRecord {
  id: string;
  operatorName: string;
  date: string; // YYYY-MM-DD
  clockIn: string;
  lunchStart?: string;
  lunchEnd?: string;
  clockOut?: string;
}

export interface BreakfastRecord extends SyncableRecord {
  id: string;
  personName: string;
  breakfastType: 'Fruta' | 'Outro';
  status: 'Pendente' | 'Entregue';
  deliveredAt?: string;
  operatorName?: string;
  date: string; // YYYY-MM-DD
  observations?: string;
  origin: 'Importado' | 'Manual';
}

export enum PackageStatus {
  AGUARDANDO = 'Aguardando retirada',
  ENTREGUE = 'Entregue'
}

export interface PackageRecord extends SyncableRecord {
  id: string;
  deliveryCompany: string;
  recipientName: string;
  description?: string;
  operatorName: string;
  receivedAt: string;
  status: PackageStatus;
  deliveredAt?: string;
  deliveredTo?: string; // Nome de quem retirou
  pickupType?: 'Próprio' | 'Terceiro';
  photo?: string; // Base64
}

// --- Módulo de Medidores ---
export type MeterType = 'Água' | 'Energia' | 'Gás' | 'Outro';
export type MeterUnit = 'm³' | 'kWh' | 'Litros' | 'Personalizado';

export interface Meter extends SyncableRecord {
  id: string;
  name: string;
  type: MeterType;
  unit: MeterUnit;
  customUnit?: string;
  active: boolean;
  createdAt: string; // Manter compatibilidade, mas usar created_at para sync
}

export interface MeterReading extends SyncableRecord {
  id: string;
  meterId: string;
  value: number;
  consumption: number;
  photo: string; // Base64 otimizada
  observation?: string;
  operator: string;
  timestamp: string;
}

// --- Módulo de Rondas ---
export interface PatrolPhoto {
  id: string;
  imagemBase64: string;
}

export type PatrolStatus = 'EM_ANDAMENTO' | 'CONCLUIDA';

export interface PatrolRecord extends SyncableRecord {
  id: string;
  data: string; // YYYY-MM-DD
  horaInicio: string; // ISO String
  horaFim: string | null; // ISO String
  duracaoMinutos: number | null;
  porteiro: string;
  status: PatrolStatus;
  observacoes: string;
  fotos: PatrolPhoto[];
  criadoEm: string;
}

export interface VehicleEntry extends SyncableRecord {
  id: string;
  accessType: AccessType;
  driverName: string;
  company: string;
  supplier?: string;
  operationType?: OperationType;
  orderNumber?: string;
  vehiclePlate?: string;
  trailerPlate?: string;
  isTruck: boolean;
  documentNumber?: string;
  visitReason?: string;
  visitedPerson?: string;
  status: EntryStatus;
  rejectionReason?: string;
  entryTime?: string;
  exitTime?: string;
  volumes?: number;
  sector?: DestinationSector;
  observations?: string;
  exitObservations?: string;
  createdAt: string;
  
  // Metadados de Auditoria
  operatorName: string;
  deviceName: string;
  lastSyncAt?: string;
  origin: ImportOrigin;
  authorizedBy?: string; // Nome do contato que autorizou/negou
}

export interface UserSession {
  operatorName: string;
  loginTime: string;
}

export interface AppSettings extends SyncableRecord {
  sectorContacts: SectorContact[];
  companyName: string;
  deviceName: string;
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
}

export interface ShiftBackupPayload {
  versao: string;
  dataExportacao: string;
  geradoPor: string;
  dados: {
    cafe: BreakfastRecord[];
    encomendas: PackageRecord[];
    entradas: VehicleEntry[];
    medidores: Meter[];
    leituras: MeterReading[];
    expediente: WorkShift[];
    rondas?: PatrolRecord[];
    logs?: AppLog[];
  };
}

export interface AppLog extends SyncableRecord {
  id: string;
  timestamp: string;
  user: string;
  module: 'Café' | 'Encomendas' | 'Portaria' | 'Medidores' | 'Sistema' | 'Ponto' | 'Rondas';
  action: string;
  referenceId?: string;
  details?: string;
}

export type ViewState = 'DASHBOARD' | 'NEW_ENTRY' | 'ACTIVE_LIST' | 'REPORTS' | 'SETTINGS' | 'SYNC' | 'LOGIN' | 'SHIFT_MANAGER' | 'MASTER_DATA' | 'CONTACTS' | 'BREAKFAST' | 'PACKAGES' | 'METERS' | 'SYSTEM_LOGS' | 'PATROLS' | 'USER_MANAGEMENT';

// --- USUÁRIOS INTERNOS ---
export interface InternalUser {
  id: string;
  supabase_user_id: string;
  username: string;
  password_hash: string; // bcrypt hash
  role: 'admin' | 'porteiro';
  must_change_password: boolean;
  created_at: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
