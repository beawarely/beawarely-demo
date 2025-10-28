// --- BeAwarely unified Supabase init ---
// Ten plik jest wspólny dla wszystkich stron BeAwarely
// Używamy tylko klucza ANON (bez service_role!)

const SB_URL = 'https://xzwpqyomqjzmiqsszwkg.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6d3BxeW9tcWp6bWlxc3N6d2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MjIxMTYsImV4cCI6MjA2OTk5ODExNn0.QbjDO1xifFkDuIAZZ9WHfGomgxwhanP9BQtgMrFqDgg';

if (!window.supabaseClient) {
  window.supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);
}

console.log("✅ Supabase client initialized globally");
