(function () {
  const SUPABASE_URL = "https://xzwpqyomqjzmiqsszwkg.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6d3BxeW9tcWp6bWlxc3N6d2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MjIxMTYsImV4cCI6MjA2OTk5ODExNn0.QbjDO1xifFkDuIAZZ9WHfGomgxwhanP9BQtgMrFqDgg";

  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  // =========================
  // BeAwarely: unified UX helpers (global)
  // =========================
  function ensureToastCss() {
    try {
      if (document.getElementById("baToastStyle")) return;
      const style = document.createElement("style");
      style.id = "baToastStyle";
      style.textContent = `
#baToastHost{
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 100000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(560px, calc(100vw - 24px));
  pointer-events: none;
}
.ba-toast{
  pointer-events: auto;
  background: rgba(10, 14, 25, 0.92);
  border: 1px solid rgba(102,178,255,0.45);
  border-radius: 12px;
  padding: 10px 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
  color: #fff;
  font-size: 0.95rem;
  line-height: 1.25;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ba-toast button{
  pointer-events: auto;
  background: transparent;
  border: 0;
  color: #66b2ff;
  font-weight: 700;
  cursor: pointer;
  padding: 6px 8px;
}
.ba-toast.ba-error{ border-color: rgba(255,80,80,0.45); }
.ba-toast.ba-success{ border-color: rgba(0,204,102,0.45); }
      `.trim();
      (document.head || document.documentElement).appendChild(style);
    } catch (e) {
      console.error("[ux] ensureToastCss failed:", e);
    }
  }

  if (!window.baToast) {
    window.baToast = function (message, type = "info", timeout = 3500) {
      try {
        ensureToastCss();

        let host = document.getElementById("baToastHost");
        if (!host) {
          host = document.createElement("div");
          host.id = "baToastHost";
          (document.body || document.documentElement).appendChild(host);
        }

        const el = document.createElement("div");
        el.className = "ba-toast" + (type ? (" ba-" + type) : "");

        const msg = document.createElement("span");
        msg.textContent = message;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "OK";

        const remove = () => { try { el.remove(); } catch {} };
        btn.addEventListener("click", remove);

        el.appendChild(msg);
        el.appendChild(btn);
        host.appendChild(el);

        if (timeout) setTimeout(remove, timeout);
      } catch (e) {
        console.error("[ux] baToast failed:", e);
        try { alert(message); } catch {}
      }
    };
  }

  if (!window.baSetBusy) {
    window.baSetBusy = function (btn, busy, busyText) {
      if (!btn) return;
      if (busy) {
        if (!btn.dataset.baOldText) btn.dataset.baOldText = btn.textContent;
        btn.textContent = busyText || "Loading…";
        btn.disabled = true;
        btn.dataset.baBusy = "1";
      } else {
        btn.disabled = false;
        if (btn.dataset.baOldText) btn.textContent = btn.dataset.baOldText;
        delete btn.dataset.baBusy;
      }
    };
  }

  if (!window.baRunWithBusy) {
    window.baRunWithBusy = async function (btn, busyText, fn) {
      if (btn && btn.dataset.baBusy === "1") return;
      window.baSetBusy(btn, true, busyText);
      try {
        return await fn();
      } catch (e) {
        console.error("[ux] Action failed:", e);
        window.baToast("❌ " + (e?.message || String(e)), "error");
      } finally {
        window.baSetBusy(btn, false);
      }
    };
  }

  // =========================
  // Supabase client init
  // =========================
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("[supabase-client] Supabase SDK not found. Ensure the CDN script is loaded before this file.");
    return;
  }

  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = client;
    console.log("[supabase-client] Supabase client initialized.");
  } catch (e) {
    console.error("[supabase-client] Initialization failed:", e);
  }
})();
