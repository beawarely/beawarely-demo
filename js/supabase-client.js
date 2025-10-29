(function () {
  const SUPABASE_URL = "https://xzwpqyomqjzmiqsszwkg.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6d3BxeW9tcWp6bWlxc3N6d2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MjIxMTYsImV4cCI6MjA2OTk5ODExNn0.QbjDO1xifFkDuIAZZ9WHfGomgxwhanP9BQtgMrFqDgg";

  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[supabase-client] Supabase SDK not found. Ensure the CDN script is loaded before this file.');
    return;
  }

  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabase = client;
    window.supabaseClient = client;
    console.log('[supabase-client] Supabase client initialized.');
  } catch (e) {
    console.error('[supabase-client] Initialization failed:', e);
  }
})();
