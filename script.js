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

// Automatically keeps the footer year current.
const year = document.getElementById('year');
if (year) {
  year.textContent = new Date().getFullYear();
}
