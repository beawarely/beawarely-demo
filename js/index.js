// Minimalny bootstrap (bez Supabase). Supa dodamy w Kroku 2.

(function () {
  // Loader + motyw
  document.addEventListener('DOMContentLoaded', () => {
    const isLight = (localStorage.getItem('mode') || 'dark') === 'light';
    document.body.classList.toggle('light-mode', isLight);

    // loader out
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.display = 'none';
    }

    // tryb
    const modeIcon = document.getElementById('modeIcon');
    if (modeIcon) {
      modeIcon.textContent = isLight ? '🌞' : '🌛';
      modeIcon.addEventListener('click', () => {
        const newIsLight = !document.body.classList.contains('light-mode');
        document.body.classList.toggle('light-mode', newIsLight);
        localStorage.setItem('mode', newIsLight ? 'light' : 'dark');
        modeIcon.textContent = newIsLight ? '🌞' : '🌛';
      });
    }

    // kliknięcia kart
    const grid = document.getElementById('toolsGrid');
    if (grid) {
      grid.querySelectorAll('.tool-card').forEach(card => {
        card.addEventListener('click', () => {
          const href = card.dataset.href;
          if (href) window.location.href = href;
        });
      });
    }

    // modale (demo)
    const loginModal = document.getElementById('loginModal');
    const supportModal = document.getElementById('supportModal');

    const openLogin = () => loginModal && loginModal.classList.add('open');
    const closeLogin = () => loginModal && loginModal.classList.remove('open');
    const openSupport = () => supportModal && supportModal.classList.add('open');
    const closeSupport = () => supportModal && supportModal.classList.remove('open');

    const loginBtn = document.getElementById('loginBtn');
    const demoLogin = document.getElementById('demoLogin');
    const closeLoginBtn = document.getElementById('closeLogin');

    const closeSupportBtn = document.getElementById('closeSupport');
    const copyCrypto = document.getElementById('copyCrypto');

    if (loginBtn) loginBtn.addEventListener('click', openLogin);
    if (demoLogin) demoLogin.addEventListener('click', () => alert('OAuth podłączymy w Kroku 2 ✅'));
    if (closeLoginBtn) closeLoginBtn.addEventListener('click', closeLogin);

    if (closeSupportBtn) closeSupportBtn.addEventListener('click', closeSupport);
    const supportTopBtn = document.createElement('a');
    supportTopBtn.id = 'supportTopBtn';
    supportTopBtn.className = 'pill';
    supportTopBtn.href = 'javascript:void(0)';
    supportTopBtn.textContent = '💲💲💲';
    supportTopBtn.addEventListener('click', openSupport);
    const left = document.querySelector('#topbar .topbar-left');
    if (left) left.appendChild(supportTopBtn);

    if (copyCrypto) {
      copyCrypto.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText('YOUR_CRYPTO_ADDRESS');
          const note = document.getElementById('copiedNote');
          if (note) { note.style.display = 'block'; setTimeout(() => (note.style.display = 'none'), 1600); }
        } catch (e) { console.error('Copy failed', e); }
      });
    }

    // zamykanie modalów kliknięciem w tło + ESC
    window.addEventListener('click', (e) => {
      if (e.target === loginModal) closeLogin();
      if (e.target === supportModal) closeSupport();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (loginModal?.classList.contains('open')) closeLogin();
        else if (supportModal?.classList.contains('open')) closeSupport();
      }
    });

    console.log('index.js ready (no Supabase yet)');
  });
})();
