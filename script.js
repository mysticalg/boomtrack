// Handles mobile menu toggling and keeps ARIA state synchronized.
const navToggle = document.getElementById('navToggle');
const siteNav = document.getElementById('siteNav');

if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('show');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

// Lightweight newsletter validation with immediate feedback.
const signupForm = document.getElementById('signupForm');
const emailInput = document.getElementById('email');
const formMessage = document.getElementById('formMessage');

if (signupForm && emailInput && formMessage) {
  signupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();

    if (!email || !email.includes('@') || !email.includes('.')) {
      formMessage.style.color = '#ff9b9b';
      formMessage.textContent = 'Please enter a valid email address.';
      return;
    }

    formMessage.style.color = '#6af7a6';
    formMessage.textContent = 'You are on the list. Welcome to Infinite Dimensions.';
    signupForm.reset();
  });
}

// Simulates account registration/login and keeps state in localStorage.
// This is a UI-only flow; real OAuth and secure auth must be implemented on a backend.
const ACCOUNT_STORAGE_KEY = 'id_account_profile';
const accountMessage = document.getElementById('accountMessage');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const registerTab = document.getElementById('registerTab');
const loginTab = document.getElementById('loginTab');
const registerPanel = document.getElementById('registerPanel');
const loginPanel = document.getElementById('loginPanel');
const socialButtons = document.querySelectorAll('.social-btn');
const socialRegistrationForm = document.getElementById('socialRegistrationForm');
const socialUsernameInput = document.getElementById('socialUsername');
const socialDisplayNameInput = document.getElementById('socialDisplayName');
const oauthFlowStatus = document.getElementById('oauthFlowStatus');
const sessionStatus = document.getElementById('sessionStatus');
const sessionRefreshBtn = document.getElementById('sessionRefreshBtn');
const guestView = document.getElementById('guestView');
const accountView = document.getElementById('accountView');
const accountName = document.getElementById('accountName');
const accountProvider = document.getElementById('accountProvider');
const accountEmail = document.getElementById('accountEmail');
const accountUsername = document.getElementById('accountUsername');
const logoutBtn = document.getElementById('logoutBtn');

// Message board local-storage setup for fast, backend-free demo behavior.
const THREAD_STORAGE_KEY = 'id_message_threads';
const boardForm = document.getElementById('boardForm');
const boardMessage = document.getElementById('boardMessage');
const boardSubmit = document.getElementById('boardSubmit');
const boardHint = document.getElementById('boardHint');
const boardStatus = document.getElementById('boardStatus');
const boardThreads = document.getElementById('boardThreads');

const SOCIAL_ACCOUNT_STORAGE_KEY = 'id_social_accounts';

const SESSION_STORAGE_KEY = 'id_social_session';
const SESSION_DURATION_MS = 30 * 60 * 1000;

// Temporary testing bypass: when enabled, message board posting/replies do not require login.
// Set this back to false when production auth is ready so community actions are protected again.
const INSECURE_ADMIN_TEST_MODE = true;

// Some browsers/privacy modes can block localStorage and throw SecurityError.
// These wrappers keep the app responsive so non-auth features (like Releases) still load.
function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`Storage read blocked for ${key}. Falling back to in-memory defaults.`, error);
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Storage write blocked for ${key}. Changes will not persist.`, error);
    return false;
  }
}

function safeStorageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Storage remove blocked for ${key}.`, error);
  }
}

function setOauthFlowStatus(message, isError = false) {
  if (!oauthFlowStatus) {
    return;
  }

  oauthFlowStatus.style.color = isError ? '#ff9b9b' : 'var(--muted)';
  oauthFlowStatus.textContent = message;
}

function loadSession() {
  const raw = safeStorageGet(SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Unable to parse social session', error);
    safeStorageRemove(SESSION_STORAGE_KEY);
    return null;
  }
}

function clearSession() {
  safeStorageRemove(SESSION_STORAGE_KEY);
  updateSessionStatus(null);
}

function createSession(profile) {
  // OAuth callback simulation: issue a short-lived local session token and expiration timestamp.
  const now = Date.now();
  const session = {
    sessionToken: `sess_${Math.random().toString(36).slice(2)}_${now}`,
    provider: profile.provider,
    username: profile.username,
    issuedAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  };

  safeStorageSet(SESSION_STORAGE_KEY, JSON.stringify(session));
  updateSessionStatus(session);
  return session;
}

function refreshSession() {
  const existingSession = loadSession();

  if (!existingSession) {
    setOauthFlowStatus('No active social session to refresh.', true);
    updateSessionStatus(null);
    return;
  }

  const refreshedSession = {
    ...existingSession,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  safeStorageSet(SESSION_STORAGE_KEY, JSON.stringify(refreshedSession));
  updateSessionStatus(refreshedSession);
  setOauthFlowStatus(`Session refreshed for @${refreshedSession.username} via ${refreshedSession.provider}.`);
}

function updateSessionStatus(session) {
  if (!sessionStatus || !sessionRefreshBtn) {
    return;
  }

  if (!session) {
    sessionStatus.textContent = 'Session: not active';
    sessionRefreshBtn.disabled = true;
    return;
  }

  const expiresOn = new Date(session.expiresAt);
  if (Date.now() >= session.expiresAt) {
    sessionStatus.textContent = 'Session expired. Please sign in again.';
    sessionRefreshBtn.disabled = true;
    return;
  }

  sessionStatus.textContent = `Session active for @${session.username} via ${session.provider} until ${expiresOn.toLocaleTimeString()}.`;
  sessionRefreshBtn.disabled = false;
}


// Username rules stay strict so IDs are clean and easy to mention in the community board.
function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function isValidUsername(value) {
  return /^[a-z0-9._]{3,24}$/.test(value);
}

function loadSocialAccounts() {
  const raw = safeStorageGet(SOCIAL_ACCOUNT_STORAGE_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Unable to parse social accounts', error);
    safeStorageRemove(SOCIAL_ACCOUNT_STORAGE_KEY);
    return {};
  }
}

function saveSocialAccounts(accounts) {
  safeStorageSet(SOCIAL_ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
}

const defaultThreads = [
  {
    id: 'seed-1',
    author: 'AuroraPilot',
    message: 'The low-end on “Starlight Engine” feels amazing on headphones. Anyone else testing on speakers?',
    createdAt: '2026-03-10T19:14:00.000Z',
    replies: [
      {
        id: 'seed-1-r1',
        author: 'EchoMapper',
        message: 'Yes! It translates nicely even on small monitors.',
        createdAt: '2026-03-11T09:20:00.000Z',
      },
    ],
  },
  {
    id: 'seed-2',
    author: 'CelestialWave',
    message: 'Would love a behind-the-scenes post on your sound design chain.',
    createdAt: '2026-03-09T12:00:00.000Z',
    replies: [],
  },
];

function setAccountMessage(message, isError = false) {
  if (!accountMessage) {
    return;
  }

  accountMessage.style.color = isError ? '#ff9b9b' : '#6af7a6';
  accountMessage.textContent = message;
}

function setBoardStatus(message, isError = false) {
  if (!boardStatus) {
    return;
  }

  boardStatus.style.color = isError ? '#ff9b9b' : '#6af7a6';
  boardStatus.textContent = message;
}

function loadProfile() {
  const raw = safeStorageGet(ACCOUNT_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Unable to parse account profile', error);
    safeStorageRemove(ACCOUNT_STORAGE_KEY);
    return null;
  }
}

function setAuthView(profile) {
  if (!guestView || !accountView || !accountName || !accountProvider || !accountEmail || !accountUsername) {
    return;
  }

  if (!profile) {
    guestView.hidden = false;
    accountView.hidden = true;
    clearSession();
    setOauthFlowStatus('Ready to authenticate with a social provider.');
  } else {
    guestView.hidden = true;
    accountView.hidden = false;
    accountName.textContent = `👋 ${profile.name}`;
    accountUsername.textContent = `@${profile.username || profile.name}`;
    accountProvider.textContent = profile.provider;
    accountEmail.textContent = profile.email;
  }

  // Keeps board visible to everyone but posting locked for guests.
  updateBoardPostingState(profile);
}

function saveProfile(profile) {
  safeStorageSet(ACCOUNT_STORAGE_KEY, JSON.stringify(profile));
  setAuthView(profile);
}

function switchAuthTab(mode) {
  if (!registerTab || !loginTab || !registerPanel || !loginPanel) {
    return;
  }

  const registerActive = mode === 'register';
  registerTab.classList.toggle('active', registerActive);
  loginTab.classList.toggle('active', !registerActive);
  registerTab.setAttribute('aria-selected', String(registerActive));
  loginTab.setAttribute('aria-selected', String(!registerActive));
  registerPanel.classList.toggle('active', registerActive);
  loginPanel.classList.toggle('active', !registerActive);
  registerPanel.hidden = !registerActive;
  loginPanel.hidden = registerActive;
}

function updateBoardPostingState(profile) {
  if (!boardMessage || !boardSubmit || !boardHint) {
    return;
  }

  const isLoggedIn = Boolean(profile) || INSECURE_ADMIN_TEST_MODE;
  boardMessage.disabled = !isLoggedIn;
  boardSubmit.disabled = !isLoggedIn;
  boardHint.textContent = isLoggedIn
    ? INSECURE_ADMIN_TEST_MODE
      ? '⚠️ Test mode is on: posting and replies are currently open to everyone.'
      : '✅ You are logged in. You can post new threads and replies.'
    : '💡 Login in My Account to publish posts and replies.';
}

function loadThreads() {
  const raw = safeStorageGet(THREAD_STORAGE_KEY);

  if (!raw) {
    return defaultThreads;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaultThreads;
  } catch (error) {
    console.error('Unable to parse thread data', error);
    return defaultThreads;
  }
}

function saveThreads(threads) {
  safeStorageSet(THREAD_STORAGE_KEY, JSON.stringify(threads));
}

function formatDate(dateText) {
  const date = new Date(dateText);
  return Number.isNaN(date.valueOf()) ? 'Unknown date' : date.toLocaleString();
}

function renderThreads() {
  if (!boardThreads) {
    return;
  }

  const profile = loadProfile();
  const threads = loadThreads();
  boardThreads.innerHTML = '';

  threads
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((thread) => {
      const article = document.createElement('article');
      article.className = 'thread-card';

      const header = document.createElement('div');
      header.className = 'thread-header';
      header.innerHTML = `<strong>🧑 ${thread.author}</strong><span class="microcopy">${formatDate(thread.createdAt)}</span>`;

      const body = document.createElement('p');
      body.textContent = thread.message;

      const replyButton = document.createElement('button');
      replyButton.type = 'button';
      replyButton.className = 'btn btn-ghost thread-reply-btn';
      replyButton.textContent = '↩ Reply';
      const canReply = Boolean(profile) || INSECURE_ADMIN_TEST_MODE;
      replyButton.title = canReply ? 'Reply to this thread' : 'Login required to reply';
      replyButton.disabled = !canReply;

      const replyForm = document.createElement('form');
      replyForm.className = 'reply-form';
      replyForm.hidden = true;
      replyForm.innerHTML = `
        <label class="microcopy" for="reply-${thread.id}">Add a reply</label>
        <textarea id="reply-${thread.id}" name="reply" rows="2" maxlength="300" placeholder="Add your response" title="Reply to this thread"></textarea>
        <button class="btn btn-primary" type="submit">Post reply</button>
      `;

      const replyList = document.createElement('div');
      replyList.className = 'reply-list';

      thread.replies.forEach((reply) => {
        const replyCard = document.createElement('div');
        replyCard.className = 'reply-card';
        replyCard.innerHTML = `
          <p><strong>🧵 ${reply.author}</strong> <span class="microcopy">${formatDate(reply.createdAt)}</span></p>
          <p>${reply.message}</p>
        `;
        replyList.appendChild(replyCard);
      });

      replyButton.addEventListener('click', () => {
        replyForm.hidden = !replyForm.hidden;
      });

      replyForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const activeProfile = loadProfile();
        const formData = new FormData(replyForm);
        const replyText = (formData.get('reply') || '').toString().trim();

        if (!activeProfile && !INSECURE_ADMIN_TEST_MODE) {
          setBoardStatus('Please log in before posting a reply.', true);
          return;
        }

        if (!replyText) {
          setBoardStatus('Reply cannot be empty.', true);
          return;
        }

        const allThreads = loadThreads();
        const targetThread = allThreads.find((item) => item.id === thread.id);

        if (!targetThread) {
          setBoardStatus('Thread not found. Refresh and try again.', true);
          return;
        }

        targetThread.replies.push({
          id: `reply-${Date.now()}`,
          // In testing bypass mode, guest replies are labeled clearly for moderation cleanup later.
          author: activeProfile ? `@${activeProfile.username || activeProfile.name}` : '@guest-tester',
          message: replyText,
          createdAt: new Date().toISOString(),
        });

        saveThreads(allThreads);
        setBoardStatus('Reply posted successfully.');
        renderThreads();
      });

      article.append(header, body, replyButton, replyForm, replyList);
      boardThreads.appendChild(article);
    });
}

if (registerTab && loginTab) {
  registerTab.addEventListener('click', () => switchAuthTab('register'));
  loginTab.addEventListener('click', () => switchAuthTab('login'));
}

if (registerForm) {
  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    const name = (formData.get('displayName') || '').toString().trim();
    const email = (formData.get('email') || '').toString().trim();
    const password = (formData.get('password') || '').toString();

    if (!name || !email.includes('@') || password.length < 8) {
      setAccountMessage('Please provide a name, valid email, and password with at least 8 characters.', true);
      return;
    }

    saveProfile({ name, username: normalizeUsername(name.replace(/\s+/g, '_')), email, provider: 'email' });
    setAccountMessage(`Account created. Welcome aboard, ${name}!`);
    registerForm.reset();
    renderThreads();
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = (formData.get('email') || '').toString().trim();
    const password = (formData.get('password') || '').toString();

    if (!email.includes('@') || password.length < 4) {
      setAccountMessage('Enter a valid email and password to continue.', true);
      return;
    }

    const currentProfile = loadProfile();
    const profile = {
      name: currentProfile?.name || email.split('@')[0],
      username: currentProfile?.username || normalizeUsername((currentProfile?.name || email.split('@')[0]).replace(/\s+/g, '_')),
      email,
      provider: 'email',
    };

    saveProfile(profile);
    setAccountMessage(`Welcome back, ${profile.name}. You are signed in.`);
    loginForm.reset();
    renderThreads();
  });
}

// Human-friendly labels keep social messaging consistent across the app.
const SOCIAL_PROVIDER_LABELS = {
  google: 'Google',
  facebook: 'Facebook',
  github: 'GitHub',
  x: 'X.com',
};

// Release catalog stays local for a fast static site experience without runtime API dependencies.
// Add a spotifyUrl when available so cards deep-link directly to the exact release.
const RELEASES = [
  { title: 'Endorphin Architecture (Extended Version)', youtubeUrl: 'https://www.youtube.com/watch?v=0lWQIkeIDuY&list=OLAK5uy_lYlIzgySScqrhoUoysXL3jpdJHqWv3CBY' },
  {
    title: 'Fractal Funk of the Moving Mind',
    youtubeUrl: 'https://www.youtube.com/watch?v=MAik9vHz7pY&list=OLAK5uy_klIBP4_vmYYfrV-wJWypoBS0K8wo-LEdc',
    spotifyUrl: 'https://open.spotify.com/album/5yMJm9Kp9svgyUyLPUGaFG?si=vAOoqhN8R_D2zVYsohTsUw',
  },
  { title: 'The Awakening Protocol', youtubeUrl: 'https://www.youtube.com/watch?v=EpVMr1fZ07w&list=OLAK5uy_l0SKqLROjZbRRMA0qRWkkGXn2rdzYIrR4' },
  { title: 'The Hidden Chrysalis of Light', youtubeUrl: 'https://www.youtube.com/watch?v=op9Rq1aKMzQ&list=OLAK5uy_lvy0qEPHXwrQ-NK7GmjufR8_k6wLMpZ4Y' },
  { title: 'Synaptic Spiral Gateway', youtubeUrl: 'https://www.youtube.com/watch?v=8D5Gzh3D8-8&list=OLAK5uy_lDS3lPu9oOTDwC16_c2mU91Ghn9Axgt3Y' },
  { title: 'Primordial Stirring', youtubeUrl: 'https://www.youtube.com/watch?v=Nv60bMcp2qE&list=OLAK5uy_nYvTfx67_CmLT5KKYSyjDEqjeOGUVHAhw' },
  { title: 'Echoes Of The Electric Ocean', youtubeUrl: 'https://www.youtube.com/watch?v=Prg6jrx3V9w&list=OLAK5uy_kJ0rxGccRu_xsw0GqlNXxrE90MgUkuC24' },
  { title: 'Fragments of Forever', youtubeUrl: 'https://www.youtube.com/watch?v=FAHg6OJ0Qes&list=OLAK5uy_kzxhaBkyO9opWDptnP8HoyRpV73aKR6rY' },
  { title: 'Commando', youtubeUrl: 'https://www.youtube.com/watch?v=VEoz-5nCwq4&list=OLAK5uy_mWg7wdYht3xrAFzKwEyuZWhe1_fqMaZcc' },
  { title: 'Echoes Of Tomorrow', youtubeUrl: 'https://www.youtube.com/watch?v=VQKVIv3W5Do&list=OLAK5uy_nWKOwbUeCtHahyo54b6QeLcpyaK7J9464' },
  { title: 'Primordial Soup', youtubeUrl: 'https://www.youtube.com/watch?v=2ub9bpBWlkY&list=OLAK5uy_lmfZyaVcyOE_NKCThBnHv12f0_JdLK744&pp=0gcJCbQEOCosWNin' },
  { title: 'Robots Attacked My Car', youtubeUrl: 'https://www.youtube.com/watch?v=L6HHtTO7m2w&list=OLAK5uy_l1wNjt5c_MSaX4q-kYZgIk6ul1fzGJxnc&pp=0gcJCbQEOCosWNin' },
  { title: 'Drum N Space II', youtubeUrl: 'https://www.youtube.com/watch?v=Jup6BwiT3ss&list=OLAK5uy_l_BQj9Sz4zUdSIkFKYbllHPr1udiLaK7w&pp=0gcJCbQEOCosWNin' },
  { title: 'Drum N Space', youtubeUrl: 'https://www.youtube.com/watch?v=C3PLrbsz8Mg&list=OLAK5uy_lwnZfSynzCZlpEpI99hrNGZ8I6nsbqnRk' },
  { title: 'The Conspiracy', youtubeUrl: 'https://www.youtube.com/watch?v=zOkxFqYbVYQ&list=OLAK5uy_kw7Pr9qlwYzqJH6bP2eZ5Gogx9R-mON6o' },
  { title: 'Cosmic Shift II', youtubeUrl: 'https://www.youtube.com/watch?v=6f-K_ewB_hU&list=OLAK5uy_nW_2jqX0CX9oxoh1Hk6yM_YCtrbyCGSPw' },
  { title: 'Freeform Fantasy II', youtubeUrl: 'https://www.youtube.com/watch?v=35DsMgYpaxU&list=OLAK5uy_mvnH8PCgOHUbaTAGUXot-drbHHuYr3Afw' },
  { title: 'Electro Psychedelics', youtubeUrl: 'https://www.youtube.com/watch?v=lIaCqYdJQxw&list=OLAK5uy_mCeFfhA3PqWB-n7xzgjukY9fDX9ObJhNc&pp=0gcJCbQEOCosWNin' },
  { title: 'Freeform Fantasy', youtubeUrl: 'https://www.youtube.com/watch?v=xOmbBD0htCQ&list=OLAK5uy_l7odIQmck5cQF5eOV9JW0IJ6duW-tnmq0' },
  { title: 'Cosmic Shift', youtubeUrl: 'https://www.youtube.com/watch?v=zstJVuhKrl0&list=OLAK5uy_mT0Kw2ll225fopUsGiCrR8Q7vRUwIaYdk' },
  { title: 'Looking at the Stars', youtubeUrl: 'https://www.youtube.com/watch?v=2lBEwJCU9dw&list=OLAK5uy_n9m2f1kBoPMiPXssvB_80nXPpkU651L2Y' },
  { title: 'Skinhead', youtubeUrl: 'https://www.youtube.com/watch?v=yLM9uaok7ok&list=OLAK5uy_nVDddwwRMSunelQUwanvuRFB6Qg5S6x1A' },
  { title: 'Mr. Hardcore', youtubeUrl: 'https://www.youtube.com/watch?v=oiYOzpHzHL4&list=OLAK5uy_k2-N3-ATv-o6Aht_m9Ag8E-h-bOv829Qw' },
  { title: 'Nuts in Yo', youtubeUrl: 'https://www.youtube.com/watch?v=3terweayj_w&list=OLAK5uy_kY1kQmJGdLS-GdQQGzUTcgfk4zBWPaUHw' },
  { title: 'Love My Body', youtubeUrl: 'https://www.youtube.com/watch?v=rAgDg0eVBpU&list=OLAK5uy_nkqOZ5RGZzYmgDSHe31oiUCPl-1uqxMjE' },
  { title: "Don't You Want Somebody", youtubeUrl: 'https://www.youtube.com/watch?v=LTSHq4kvWtE&list=OLAK5uy_n_ksKMPgStDX6RyWA-AJTQB0f_qXcDHpg' },
  { title: 'Skate Or Die', youtubeUrl: 'https://www.youtube.com/watch?v=93NhKcf9usg&list=OLAK5uy_kQhIwiQZQF-Q4PgxYe3iwGYYf9-1P506k' },
  { title: 'Polymetric Velocity of the Open Mind', youtubeUrl: 'https://www.youtube.com/watch?v=u_tE673zw3E&list=OLAK5uy_leT9WI2osOr6DqzSOXu5b41R00khF8CDM' },
  { title: 'Electric Emergence', youtubeUrl: 'https://www.youtube.com/watch?v=Rm3uHgZcuKg&list=OLAK5uy_mK6443AmO6vgOPAkT_ssSUB7oPtzH3bEY' },
  { title: 'Dancing Fractal Funk', youtubeUrl: 'https://www.youtube.com/watch?v=-yF9XbwJ8II&list=OLAK5uy_m5P6nwOlI4NbNQJPOIqp1EuEDHNYzWlD8' },
  { title: 'Viridion Drift Cascade (Extended Version)', youtubeUrl: 'https://www.youtube.com/watch?v=amwCeH2Tjs4&list=OLAK5uy_kEtRh0-vuw5rGYg8sP6RLnUK-QUJonbas' },
  { title: 'Distant Keys', youtubeUrl: 'https://www.youtube.com/watch?v=CTCpWH32PkA&list=OLAK5uy_lp0SKmy6VgdMT-SMP8reN5tBk5c8dS-xI' },
  { title: 'Shimmering Fade', youtubeUrl: 'https://www.youtube.com/watch?v=c37VnhEKuoU&list=OLAK5uy_nfRgSxnSTG6PN35ZtYGdgPT_bnCv9bax4' },
  { title: 'Urban Chords', youtubeUrl: 'https://www.youtube.com/watch?v=nZDf3dzCPK8&list=OLAK5uy_nerjOCsrqqMTtZMt5aXpgcwHrSP3MPlsQ' },
  { title: 'Viral Dream Constructs', youtubeUrl: 'https://www.youtube.com/watch?v=pyCvJwD9v6Y&list=OLAK5uy_m-ODRWeoS3fobR68WWCL0qGHgRJ4voYdE' },
  { title: 'Lunar Measure', youtubeUrl: 'https://www.youtube.com/watch?v=mr6QMZLPorE&list=OLAK5uy_ktsxfRfslVGfkwM4Lj7zGVRsjnnOfEs-0' },
  { title: 'Late Night Decadence', youtubeUrl: 'https://www.youtube.com/watch?v=c5cvNc9IK8A&list=OLAK5uy_lRKBFJGEhexfJw6ObJiUnZ0lDhORAe6Ck' },
  { title: 'Coast Sketch', youtubeUrl: 'https://www.youtube.com/watch?v=S3fm25hpf9M&list=OLAK5uy_nbaa-MjNiG87G_EnYuvkiO0Ts6ZgDyCiE' },
  { title: 'Signal Drift', youtubeUrl: 'https://www.youtube.com/watch?v=wy3-tGXVsmQ&list=OLAK5uy_lLUU7FIyrzKcVU384jtOH6Q67769TRrG0&pp=0gcJCbQEOCosWNin' },
  { title: 'Shifting Signatures', youtubeUrl: 'https://www.youtube.com/watch?v=27KN0GY1sa0&list=OLAK5uy_lqDoYgSTzRXyNEkp9sKTa8bbA0MVLeGy0' },
  { title: 'Broken Silence', youtubeUrl: 'https://www.youtube.com/watch?v=D2En1PzYSTY&list=OLAK5uy_kt3sk8QfkraMYFzDHnS-XFp3GARnvlDcs' },
  { title: 'Diffused Tones', youtubeUrl: 'https://www.youtube.com/watch?v=typ34ddJKRc&list=OLAK5uy_kiugaiw2CjfNaGp0j9x7QAtPrQ89KRLRY' },
];

const releaseGrid = document.getElementById('releaseGrid');
const releaseSyncNote = document.getElementById('releaseSyncNote');
const RELEASE_ARTWORK_CACHE_KEY = 'id_release_artwork_cache_v1';
const RELEASE_ARTWORK_FALLBACK_SVG = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8e7dff"/><stop offset="100%" stop-color="#41d8f5"/></linearGradient></defs><rect width="360" height="360" fill="#111327"/><rect x="14" y="14" width="332" height="332" rx="24" fill="url(#g)" fill-opacity="0.22" stroke="#2a2f56" stroke-width="4"/><g fill="#f3f5ff" font-family="Inter,Arial,sans-serif" text-anchor="middle"><text x="180" y="164" font-size="34">🎵</text><text x="180" y="196" font-size="20">Infinite Dimensions</text><text x="180" y="226" font-size="15" fill="#b4bad8">Artwork Loading</text></g></svg>`,
)}`;

function buildStoreSearchUrl(baseUrl, title) {
  return `${baseUrl}${encodeURIComponent(`Infinite Dimensions ${title}`)}`;
}

function loadArtworkCache() {
  const raw = safeStorageGet(RELEASE_ARTWORK_CACHE_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Unable to parse release artwork cache', error);
    safeStorageRemove(RELEASE_ARTWORK_CACHE_KEY);
    return {};
  }
}

function saveArtworkCache(cache) {
  safeStorageSet(RELEASE_ARTWORK_CACHE_KEY, JSON.stringify(cache));
}

async function fetchReleaseArtwork(title) {
  // iTunes Search API supports CORS and returns album artwork for catalog cards quickly.
  const endpoint = `https://itunes.apple.com/search?term=${encodeURIComponent(`Infinite Dimensions ${title}`)}&entity=album&limit=1`;
  const response = await fetch(endpoint, { cache: 'force-cache' });

  if (!response.ok) {
    throw new Error(`Artwork request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const [result] = payload.results || [];

  if (!result?.artworkUrl100) {
    return '';
  }

  // Upgrade 100x100 results to 600x600 when available for sharper release cards.
  return result.artworkUrl100.replace('100x100bb', '600x600bb');
}

function queueArtworkHydration(img, title, artworkCache) {
  const cachedArtwork = artworkCache[title];
  if (cachedArtwork) {
    img.src = cachedArtwork;
    return;
  }

  fetchReleaseArtwork(title)
    .then((artworkUrl) => {
      if (!artworkUrl) {
        return;
      }

      artworkCache[title] = artworkUrl;
      saveArtworkCache(artworkCache);
      img.src = artworkUrl;
    })
    .catch((error) => {
      console.warn(`Unable to load artwork for "${title}"`, error);
    });
}


function buildSpotifySearchUrl(title) {
  // Artist-scoped Spotify queries are more reliable than plain-title searches for this catalog.
  const query = encodeURIComponent(`artist:"Infinite Dimensions" album:"${title.trim()}"`);
  return `https://open.spotify.com/search/${query}`;
}

function buildSpotifyEmbedUrl(spotifyUrl) {
  if (!spotifyUrl) {
    return '';
  }

  try {
    const parsed = new URL(spotifyUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const [resourceType, resourceId] = segments;

    // Spotify embeds support albums, tracks, playlists, artists, episodes, and shows.
    const supportedTypes = new Set(['album', 'track', 'playlist', 'artist', 'episode', 'show']);
    if (!supportedTypes.has(resourceType) || !resourceId) {
      return '';
    }

    return `https://open.spotify.com/embed/${resourceType}/${resourceId}`;
  } catch (error) {
    console.warn('Unable to parse Spotify URL for release embed', error);
    return '';
  }
}

function buildEmbeddedStreamConfig(release) {
  // Spotify is now the canonical inline player. If an exact URI is missing, fall back to a Spotify search embed.
  const directSpotifyEmbedUrl = buildSpotifyEmbedUrl(release.spotifyUrl);
  const searchSpotifyEmbedUrl = `https://open.spotify.com/embed/search/${encodeURIComponent(release.title.trim())}`;

  return {
    embedUrl: directSpotifyEmbedUrl || searchSpotifyEmbedUrl,
    provider: 'spotify',
    playLabel: directSpotifyEmbedUrl ? 'Play on Spotify' : 'Search on Spotify',
    hideLabel: 'Hide Spotify player',
    icon: '🎧',
    iframeAllow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
  };
}

function createEmbeddedStreamPanel(release) {
  const wrapper = document.createElement('div');
  wrapper.className = 'release-stream-panel';

  const streamConfig = buildEmbeddedStreamConfig(release);
  if (!streamConfig) {
    wrapper.textContent = 'Embedded stream unavailable for this release. Use store links instead.';
    return { wrapper, toggleButton: null };
  }

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'btn btn-ghost release-stream-toggle';
  toggleButton.innerHTML = `<span aria-hidden="true">${streamConfig.icon}</span><span>${streamConfig.playLabel}</span>`;
  toggleButton.title = `Load inline ${streamConfig.provider} player for this release.`;
  toggleButton.setAttribute('aria-expanded', 'false');

  const iframe = document.createElement('iframe');
  iframe.className = 'release-stream-frame';
  iframe.title = `${release.title} embedded stream`;
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allow = streamConfig.iframeAllow;
  iframe.allowFullscreen = true;

  let isLoaded = false;
  let isExpanded = false;

  // Embeds are loaded on demand so dozens of releases do not block the initial page load.
  toggleButton.addEventListener('click', () => {
    isExpanded = !isExpanded;
    wrapper.classList.toggle('show', isExpanded);
    toggleButton.setAttribute('aria-expanded', String(isExpanded));
    toggleButton.innerHTML = isExpanded
      ? `<span aria-hidden="true">⏸️</span><span>${streamConfig.hideLabel}</span>`
      : `<span aria-hidden="true">${streamConfig.icon}</span><span>${streamConfig.playLabel}</span>`;

    if (!isLoaded) {
      iframe.src = streamConfig.embedUrl;
      wrapper.appendChild(iframe);
      isLoaded = true;
    }
  });

  return { wrapper, toggleButton };
}

function renderReleases() {
  if (!releaseGrid || !releaseSyncNote) {
    return;
  }

  releaseGrid.innerHTML = '';
  const artworkCache = loadArtworkCache();

  RELEASES.forEach((release) => {
    const card = document.createElement('article');
    card.className = 'track-card release-card';

    const artwork = document.createElement('img');
    artwork.className = 'release-artwork';
    artwork.src = RELEASE_ARTWORK_FALLBACK_SVG;
    artwork.alt = `${release.title} album artwork`;
    artwork.loading = 'lazy';
    artwork.decoding = 'async';
    artwork.title = 'Album artwork pulled from remote music catalog metadata.';

    const title = document.createElement('h3');
    title.textContent = `🎵 ${release.title}`;

    const helper = document.createElement('p');
    helper.className = 'microcopy';
    helper.textContent = 'Artwork auto-loads remotely. Use the embedded Spotify player, or jump to platform links.';

    const actions = document.createElement('div');
    actions.className = 'release-actions';
    const spotifyUrl = release.spotifyUrl || buildSpotifySearchUrl(release.title);
    const spotifyButtonLabel = release.spotifyUrl ? '🎧 Spotify' : '🎧 Spotify Search';
    const spotifyButtonTitle = release.spotifyUrl ? 'Open this release on Spotify' : 'Search this release on Spotify';

    actions.innerHTML = `
      <a class="btn btn-ghost release-link" href="${spotifyUrl}" target="_blank" rel="noreferrer noopener" title="${spotifyButtonTitle}">${spotifyButtonLabel}</a>
      <a class="btn btn-ghost release-link" href="${buildStoreSearchUrl('https://music.amazon.com/search/', release.title)}" target="_blank" rel="noreferrer noopener" title="Search this release on Amazon Music">🛒 Amazon</a>
      <a class="btn btn-ghost release-link" href="${buildStoreSearchUrl('https://play.google.com/store/search?q=', `${release.title} music`)}&c=music_and_audio" target="_blank" rel="noreferrer noopener" title="Search this release on Google Play">📲 Google Play</a>
    `;

    const youtubeRow = document.createElement('div');
    youtubeRow.className = 'release-secondary-actions';
    // YouTube is placed below the primary store row so the layout stays clean while still offering a quick fallback.
    youtubeRow.innerHTML = `
      <a class="btn btn-ghost release-link release-youtube-link" href="${release.youtubeUrl}" target="_blank" rel="noreferrer noopener" title="Open this release on YouTube">▶️ YouTube</a>
    `;

    const streamPanel = createEmbeddedStreamPanel(release);
    if (streamPanel.toggleButton) {
      actions.prepend(streamPanel.toggleButton);
    }

    card.append(artwork, title, helper, actions, youtubeRow, streamPanel.wrapper);
    releaseGrid.appendChild(card);

    queueArtworkHydration(artwork, release.title, artworkCache);
  });

  releaseSyncNote.textContent = `✅ Loaded ${RELEASES.length} releases from your local catalog list.`;
}

if (socialButtons.length) {
  socialButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const provider = (button.dataset.provider || '').toLowerCase();
      const providerLabel = SOCIAL_PROVIDER_LABELS[provider] || 'Social provider';
      const providerKey = `provider:${provider}`;
      const previousButtonMarkup = button.innerHTML;
      const socialAccounts = loadSocialAccounts();
      const socialProfile = socialAccounts[providerKey];
      const enteredUsername = normalizeUsername((socialUsernameInput?.value || '').toString());
      const enteredDisplayName = (socialDisplayNameInput?.value || '').toString().trim();

      // Existing provider account can sign in instantly without re-entering onboarding fields.
      if (socialProfile) {
        saveProfile(socialProfile);
        const activeSession = createSession(socialProfile);
        setOauthFlowStatus(`OAuth callback validated for ${providerLabel}. Session token issued.`);
        setAccountMessage(`Welcome back, @${socialProfile.username}. Signed in with ${providerLabel}.`);
        updateSessionStatus(activeSession);
        renderThreads();
        return;
      }

      if (!isValidUsername(enteredUsername)) {
        setAccountMessage('Choose a username between 3-24 characters using letters, numbers, underscores, or dots.', true);
        socialUsernameInput?.focus();
        return;
      }

      if (Object.values(socialAccounts).some((profile) => profile.username === enteredUsername)) {
        setAccountMessage(`@${enteredUsername} is already linked to another provider. Pick a different username.`, true);
        socialUsernameInput?.focus();
        return;
      }

      // Loading affordance makes tap/click feedback immediate and prevents accidental double-clicks.
      button.disabled = true;
      button.innerHTML = `<span aria-hidden="true">⏳</span><span>Connecting to ${providerLabel}...</span>`;
      setOauthFlowStatus(`Starting OAuth authorization with ${providerLabel}...`);

      // Simulates OAuth callback latency without blocking the UI thread.
      window.setTimeout(() => {
        const baseName = enteredDisplayName || enteredUsername;
        const profile = {
          name: baseName,
          username: enteredUsername,
          email: `${enteredUsername}+${provider || 'social'}@example.com`,
          provider: providerLabel,
        };

        socialAccounts[providerKey] = profile;
        saveSocialAccounts(socialAccounts);
        saveProfile(profile);
        const activeSession = createSession(profile);
        setOauthFlowStatus(`OAuth callback validated for ${providerLabel}. Session token issued.`);
        setAccountMessage(`Connected ${providerLabel}. Welcome, @${enteredUsername}.`);
        updateSessionStatus(activeSession);
        renderThreads();

        if (socialRegistrationForm) {
          socialRegistrationForm.reset();
        }

        button.disabled = false;
        button.innerHTML = previousButtonMarkup;
      }, 250);
    });
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    safeStorageRemove(ACCOUNT_STORAGE_KEY);
    clearSession();
    setAuthView(null);
    setAccountMessage('You have logged out. See you soon.');
    renderThreads();
  });
}

if (boardForm && boardMessage) {
  boardForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const profile = loadProfile();
    const message = boardMessage.value.trim();

    if (!profile && !INSECURE_ADMIN_TEST_MODE) {
      setBoardStatus('Please log in before posting.', true);
      return;
    }

    if (!message) {
      setBoardStatus('Please write a message before posting.', true);
      return;
    }

    const threads = loadThreads();
    threads.push({
      id: `thread-${Date.now()}`,
      // In testing bypass mode, guest posts are labeled clearly for moderation cleanup later.
      author: profile ? `@${profile.username || profile.name}` : '@guest-tester',
      message,
      createdAt: new Date().toISOString(),
      replies: [],
    });

    saveThreads(threads);
    boardForm.reset();
    setBoardStatus('Message posted to the board.');
    renderThreads();
  });
}

setAuthView(loadProfile());
updateSessionStatus(loadSession());
renderReleases();
renderThreads();

if (sessionRefreshBtn) {
  sessionRefreshBtn.addEventListener('click', refreshSession);
}

// Keep session state fresh and fail-safe if it expires while user is browsing.
window.setInterval(() => {
  const activeSession = loadSession();

  if (!activeSession) {
    updateSessionStatus(null);
    return;
  }

  if (Date.now() >= activeSession.expiresAt) {
    clearSession();
    setOauthFlowStatus('OAuth session expired. Please sign in again to continue posting.', true);
    return;
  }

  updateSessionStatus(activeSession);
}, 15000);

// Automatically keeps the footer year current.
const year = document.getElementById('year');
if (year) {
  year.textContent = new Date().getFullYear();
}
