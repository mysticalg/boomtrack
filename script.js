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
const guestView = document.getElementById('guestView');
const accountView = document.getElementById('accountView');
const accountName = document.getElementById('accountName');
const accountProvider = document.getElementById('accountProvider');
const accountEmail = document.getElementById('accountEmail');
const logoutBtn = document.getElementById('logoutBtn');

function setAccountMessage(message, isError = false) {
  if (!accountMessage) {
    return;
  }

  accountMessage.style.color = isError ? '#ff9b9b' : '#6af7a6';
  accountMessage.textContent = message;
}

function setAuthView(profile) {
  if (!guestView || !accountView || !accountName || !accountProvider || !accountEmail) {
    return;
  }

  if (!profile) {
    guestView.hidden = false;
    accountView.hidden = true;
    return;
  }

  guestView.hidden = true;
  accountView.hidden = false;
  accountName.textContent = `👋 ${profile.name}`;
  accountProvider.textContent = profile.provider;
  accountEmail.textContent = profile.email;
}

function saveProfile(profile) {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(profile));
  setAuthView(profile);
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

    const profile = {
      name,
      email,
      provider: 'email',
    };

    saveProfile(profile);
    setAccountMessage(`Account created. Welcome aboard, ${name}!`);
    registerForm.reset();
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
      email,
      provider: 'email',
    };

    saveProfile(profile);
    setAccountMessage(`Welcome back, ${profile.name}. You are signed in.`);
    loginForm.reset();
  });
}

if (socialButtons.length) {
  socialButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const provider = button.dataset.provider;
      const providerLabel = provider === 'x' ? 'x.com' : provider;
      const profile = {
        name: `${providerLabel} listener`,
        email: `${provider}@example.com`,
        provider: providerLabel,
      };

      // Demo-only behavior: this simulates successful OAuth callback.
      saveProfile(profile);
      setAccountMessage(`Connected successfully with ${providerLabel}.`);
    });
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    setAuthView(null);
    setAccountMessage('You have logged out. See you soon.');
  });
}

setAuthView(loadProfile());

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

loadMerchCatalog();

// Automatically keeps the footer year current.
const year = document.getElementById('year');
if (year) {
  year.textContent = new Date().getFullYear();
}
