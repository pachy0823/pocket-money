import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://llebcqlmeunhcskwehid.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZWJjcWxtZXVuaGNza3dlaGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MDg3NjMsImV4cCI6MjA5MjA4NDc2M30.19Tb-L0Kz8zQbXQY44Bhx64y3LIsFreLbI3obvYTRtg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);