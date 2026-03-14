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

function setOauthFlowStatus(message, isError = false) {
  if (!oauthFlowStatus) {
    return;
  }

  oauthFlowStatus.style.color = isError ? '#ff9b9b' : 'var(--muted)';
  oauthFlowStatus.textContent = message;
}

function loadSession() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);

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
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
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

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
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

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(refreshedSession));
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
  const raw = localStorage.getItem(SOCIAL_ACCOUNT_STORAGE_KEY);

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Unable to parse social accounts', error);
    localStorage.removeItem(SOCIAL_ACCOUNT_STORAGE_KEY);
    return {};
  }
}

function saveSocialAccounts(accounts) {
  localStorage.setItem(SOCIAL_ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
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
  const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Unable to parse account profile', error);
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
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
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(profile));
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

  const isLoggedIn = Boolean(profile);
  boardMessage.disabled = !isLoggedIn;
  boardSubmit.disabled = !isLoggedIn;
  boardHint.textContent = isLoggedIn
    ? '✅ You are logged in. You can post new threads and replies.'
    : '💡 Login in My Account to publish posts and replies.';
}

function loadThreads() {
  const raw = localStorage.getItem(THREAD_STORAGE_KEY);

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
  localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(threads));
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
      replyButton.title = profile ? 'Reply to this thread' : 'Login required to reply';
      replyButton.disabled = !profile;

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

        if (!activeProfile) {
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
          author: `@${activeProfile.username || activeProfile.name}`,
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
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
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

    if (!profile) {
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
      author: `@${profile.username || profile.name}`,
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

// Printful catalog rendering. It pulls from a local JSON file generated by
// scripts/sync_printful_products.py so the storefront stays static, fast, and safe.
const merchGrid = document.getElementById('merchGrid');
const merchStatus = document.getElementById('merchStatus');
const merchLastUpdated = document.getElementById('merchLastUpdated');

function renderMerchCards(products) {
  if (!merchGrid) {
    return;
  }

  merchGrid.innerHTML = '';

  products.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'merch-card';

    const title = document.createElement('h3');
    title.textContent = `🛒 ${product.title}`;

    const description = document.createElement('p');
    description.textContent = product.description || 'Fresh from the Infinite Dimensions merch vault.';

    const image = document.createElement('img');
    image.loading = 'lazy';
    image.src = product.image || 'https://via.placeholder.com/600x600/111327/f3f5ff?text=Merch';
    image.alt = product.title;

    const footer = document.createElement('div');
    footer.className = 'merch-card-footer';

    const price = document.createElement('span');
    price.className = 'price';
    price.title = 'Starting price from your Printful listing';
    price.textContent = product.price_display || 'From $--';

    const link = document.createElement('a');
    link.className = 'btn btn-ghost';
    link.textContent = 'View product ↗';

    if (product.product_url) {
      link.href = product.product_url;
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
      link.title = 'Open product details in a new tab';
    } else {
      // Keeps UI transparent when a listing has no public storefront URL yet.
      link.href = '#';
      link.setAttribute('aria-disabled', 'true');
      link.classList.add('disabled-link');
      link.title = 'Publish/connect this product to a sales channel to enable public links';
    }

    footer.append(price, link);
    card.append(image, title, description, footer);
    merchGrid.appendChild(card);
  });
}

async function loadMerchCatalog() {
  if (!merchGrid || !merchStatus || !merchLastUpdated) {
    return;
  }

  try {
    const response = await fetch('data/printful-products.json', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Catalog request failed with ${response.status}`);
    }

    const catalog = await response.json();
    const products = Array.isArray(catalog.products) ? catalog.products : [];

    if (!products.length) {
      merchStatus.textContent = '⚠️ No products found yet. Run the Printful sync script to populate catalog data.';
      return;
    }

    renderMerchCards(products);
    merchStatus.textContent = `✅ Showing ${products.length} products from your latest Printful sync.`;

    const syncedAt = catalog.last_synced ? new Date(catalog.last_synced) : null;
    merchLastUpdated.textContent = syncedAt && !Number.isNaN(syncedAt.valueOf())
      ? `Last sync: ${syncedAt.toLocaleString()}`
      : 'Last sync: Unknown';
  } catch (error) {
    merchStatus.textContent = '⚠️ Unable to load merch catalog. Confirm data/printful-products.json exists and is valid JSON.';
    merchLastUpdated.textContent = 'Last sync: unavailable';
    console.error('Failed to load merch catalog', error);
  }
}

setAuthView(loadProfile());
updateSessionStatus(loadSession());
renderThreads();
loadMerchCatalog();

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
