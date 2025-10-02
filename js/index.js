// --- Supabase Auth Integration ---

const SUPABASE_URL = "https://xzwpqyomqjzmiqsszwkg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6d3BxeW9tcWp6bWlxc3N6d2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MjIxMTYsImV4cCI6MjA2OTk5ODExNn0.QbjDO1xifFkDuIAZZ9WHfGomgxwhanP9BQtgMrFqDgg";

// create client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

// elements
const els = {
  loginBtn: document.getElementById('loginBtn'),
  loginModal: document.getElementById('loginModal'),
  closeLoginBtn: document.getElementById('closeLogin'),
  authForm: document.getElementById('authForm'),
  signInBtn: document.getElementById('signInBtn'),
  signUpBtn: document.getElementById('signUpBtn'),
  googleSignInBtn: document.getElementById('googleSignInBtn'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  authError: document.getElementById('authError'),
  toolsGrid: document.getElementById('toolsGrid'),
};

// helpers
function showError(msg){
  els.authError.textContent = msg;
  els.authError.style.display = 'block';
}
function hideError(){ els.authError.style.display = 'none'; }

function openLoginModal(){ els.loginModal.classList.add('open'); hideError(); }
function closeLoginModal(){ els.loginModal.classList.remove('open'); hideError(); }

// auth actions
async function handleSignIn(e){
  e.preventDefault();
  hideError();
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: els.emailInput.value,
    password: els.passwordInput.value,
  });
  if(error) showError(error.message);
  else closeLoginModal();
}

async function handleSignUp(e){
  e.preventDefault();
  hideError();
  const { error } = await supabaseClient.auth.signUp({
    email: els.emailInput.value,
    password: els.passwordInput.value,
  });
  if(error) showError(error.message);
  else {
    closeLoginModal();
    alert("Rejestracja pomyślna – sprawdź email, aby potwierdzić konto.");
  }
}

async function signInWithGoogle(){
  hideError();
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if(error) showError(error.message);
}

async function logout(){ await supabaseClient.auth.signOut(); }

// UI sync
function lockCards(locked){
  els.toolsGrid?.querySelectorAll('.tool-card').forEach(card=>{
    if(card.dataset.requiresAuth === "true"){
      card.classList.toggle('locked', locked);
    }
  });
}

function updateUI(session){
  const isLogged = !!session;
  els.loginBtn.textContent = isLogged ? "Logout" : "Login";
  els.loginBtn.onclick = isLogged ? logout : openLoginModal;
  lockCards(!isLogged);
}

// init
document.addEventListener("DOMContentLoaded", async ()=>{
  // hide loader
  const loader = document.getElementById('loader');
  if(loader) loader.style.display = 'none';

  // initial session

  const { data: { session } } = await supabaseClient.auth.getSession();
  updateUI(session);

  // state changes
  supabaseClient.auth.onAuthStateChange((_evt, session)=>{
    updateUI(session);
  });

  // modal
  els.closeLoginBtn.addEventListener("click", closeLoginModal);
  window.addEventListener("keydown", e=>{
    if(e.key==="Escape" && els.loginModal.classList.contains("open")) closeLoginModal();
  });
  els.loginModal.addEventListener("click", e=>{
    if(e.target===els.loginModal) closeLoginModal();
  });

  // auth form
  els.authForm.addEventListener("submit", handleSignIn);
  els.signUpBtn.addEventListener("click", handleSignUp);
  els.googleSignInBtn.addEventListener("click", signInWithGoogle);

  // cards
  els.toolsGrid?.querySelectorAll('.tool-card').forEach(card=>{
    card.addEventListener("click", e=>{
      const requiresAuth = card.dataset.requiresAuth === "true";
      const href = card.dataset.href;
      if(requiresAuth && !supabaseClient.auth.getSession().data.session){
        e.preventDefault(); e.stopPropagation(); openLoginModal();
      } else if(href){ window.location.href = href; }
    });
  });
});
