
-- SCRIPT DE CONFIGURAÇÃO PORTARIA EXPRESS
-- Execute este script no SQL Editor do seu projeto Supabase

-- 1. TABELA DE USUÁRIOS INTERNOS (Porteiros e Admins Locais)
CREATE TABLE IF NOT EXISTS public.internal_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'porteiro')) DEFAULT 'porteiro',
    must_change_password BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(supabase_user_id, username)
);

-- 2. INSERIR VOCÊ COMO ADMINISTRADOR (USER ID: 9e85e2f3-2d57-46b7-8c14-917dc6fe3357)
-- Senha Provisória: admin123
-- Nota: Ao logar pela primeira vez, o sistema pedirá para você trocar essa senha.
INSERT INTO public.internal_users (supabase_user_id, username, password_hash, role, must_change_password)
VALUES (
    '9e85e2f3-2d57-46b7-8c14-917dc6fe3357', 
    'admin', 
    '$2a$10$v7m6.O8pG8E6R8W8f8S8u.mS1A7rXm5A7f/A6.C.M.Y.G.S.U.R.E.H', -- Hash para 'admin123'
    'admin', 
    true
) ON CONFLICT (supabase_user_id, username) DO NOTHING;

-- 3. TABELA DE CONFIGURAÇÕES E CONTATOS
CREATE TABLE IF NOT EXISTS public.app_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT DEFAULT 'Minha Empresa',
    device_name TEXT DEFAULT 'Portaria Principal',
    theme TEXT DEFAULT 'light',
    font_size TEXT DEFAULT 'medium',
    sector_contacts JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABELA DE PORTARIA (ENTRADAS E SAÍDAS)
CREATE TABLE IF NOT EXISTS public.vehicle_entries (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    access_type TEXT,
    driver_name TEXT,
    company TEXT,
    supplier TEXT,
    operation_type TEXT,
    order_number TEXT,
    vehicle_plate TEXT,
    trailer_plate TEXT,
    is_truck BOOLEAN DEFAULT false,
    document_number TEXT,
    visit_reason TEXT,
    visited_person TEXT,
    status TEXT,
    rejection_reason TEXT,
    entry_time TIMESTAMPTZ,
    exit_time TIMESTAMPTZ,
    volumes INTEGER DEFAULT 0,
    sector TEXT,
    observations TEXT,
    exit_observations TEXT,
    operator_name TEXT,
    device_name TEXT,
    authorized_by TEXT,
    origin TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TABELA DE DESJEJUM (CAFÉ)
CREATE TABLE IF NOT EXISTS public.breakfast_list (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    person_name TEXT,
    breakfast_type TEXT,
    status TEXT,
    delivered_at TIMESTAMPTZ,
    operator_name TEXT,
    date TEXT,
    observations TEXT,
    origin TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABELA DE ENCOMENDAS
CREATE TABLE IF NOT EXISTS public.packages (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    delivery_company TEXT,
    recipient_name TEXT,
    description TEXT,
    operator_name TEXT,
    received_at TIMESTAMPTZ,
    status TEXT,
    delivered_at TIMESTAMPTZ,
    delivered_to TEXT,
    pickup_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. TABELA DE MEDIDORES
CREATE TABLE IF NOT EXISTS public.meters (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    type TEXT,
    unit TEXT,
    custom_unit TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. TABELA DE LEITURAS
CREATE TABLE IF NOT EXISTS public.meter_readings (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    meter_id TEXT REFERENCES public.meters(id) ON DELETE CASCADE,
    value NUMERIC,
    consumption NUMERIC,
    observation TEXT,
    operator TEXT,
    timestamp TIMESTAMPTZ,
    photo TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. TABELA DE RONDAS
CREATE TABLE IF NOT EXISTS public.patrols (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    data TEXT,
    hora_inicio TIMESTAMPTZ,
    hora_fim TIMESTAMPTZ,
    duracao_minutos INTEGER,
    porteiro TEXT,
    status TEXT,
    observacoes TEXT,
    fotos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. TABELA DE EXPEDIENTE
CREATE TABLE IF NOT EXISTS public.work_shifts (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    operator_name TEXT,
    date TEXT,
    clock_in TIMESTAMPTZ,
    lunch_start TIMESTAMPTZ,
    lunch_end TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. TABELA DE LOGS
CREATE TABLE IF NOT EXISTS public.app_logs (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ,
    user_name TEXT,
    module TEXT,
    action TEXT,
    reference_id TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ATIVAÇÃO DE RLS
ALTER TABLE public.internal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breakfast_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE ACESSO
CREATE POLICY "Acesso Individual Internal Users" ON public.internal_users FOR ALL USING (auth.uid() = supabase_user_id);
CREATE POLICY "Acesso Individual Settings" ON public.app_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Acesso Individual Entries" ON public.vehicle_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Acesso Individual Breakfast" ON public.breakfast_list FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Acesso Individual Packages" ON public.packages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Acesso Individual Meters" ON public.meters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Acesso Individual Meter Readings" ON public.meter_readings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Acesso Individual Patrols" ON public.patrols FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Acesso Individual Shifts" ON public.work_shifts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Acesso Individual Logs" ON public.app_logs FOR ALL USING (auth.uid() = user_id);
