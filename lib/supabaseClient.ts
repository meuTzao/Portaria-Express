import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://ymwexrygdtsipjjksooy.supabase.co"
const supabaseKey = "sb_publishable_V4X0ECMPD46IFePiz_l-1Q_WRncKYCW"

export const supabase = createClient(supabaseUrl, supabaseKey)
