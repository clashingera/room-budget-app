// ui.js

export let currentUserRole = null;

// DOM Elements
const profilePanel = document.getElementById('profilePanel');
const loginBtn = document.getElementById('loginBtn');
const profilePic = document.getElementById('profilePic');
const closeProfilePanelBtn = document.getElementById('closeProfilePanelBtn');
const profileUsername = document.getElementById('profileUsername');
const profileMenu = document.getElementById('profileMenu');
const profileContent = document.getElementById('profileContent'); // The area to show lists
const mainContent = document.getElementById('mainContent');
const statusMessage = document.getElementById('statusMessage');

// Initialize profile panel
if (profilePic) {
  profilePic.addEventListener('click', () => {
    profilePanel.classList.add('open');
    document.body.classList.add('profile-panel-open');
    setPanelContent(''); // Clear content when opening
    gsap.fromTo(profilePanel, { x: '100%' }, { x: 0, duration: 0.6, ease: 'power4.inOut' });
  });
}
if (closeProfilePanelBtn) {
  closeProfilePanelBtn.addEventListener('click', () => {
    gsap.to(profilePanel, {
      x: '100%',
      duration: 0.5,
      ease: 'power4.inOut',
      onComplete: () => {
        profilePanel.classList.remove('open');
        document.body.classList.remove('profile-panel-open');
      },
    });
  });
}

// === UI State Functions ===

export function showWaitingForApproval(user) {
  mainContent.classList.add('hidden');
  statusMessage.classList.remove('hidden', 'status-rejected');
  statusMessage.classList.add('status-pending');
  statusMessage.innerHTML = `Hi ${user.displayName || user.email}, your request is pending admin approval.`;
  
  profilePic.style.display = 'block';
  profilePic.src = user.photoURL;
  loginBtn.style.display = 'none';
  profileUsername.textContent = `Hello, ${user.displayName.split(' ')[0]}`;
  buildProfileMenu(null); // Show basic menu with logout
}

export function showRejectedUI(user, resendHandler) {
  mainContent.classList.add('hidden');
  statusMessage.classList.remove('hidden', 'status-pending');
  statusMessage.classList.add('status-rejected');
  statusMessage.innerHTML = `
    Hi ${user.displayName || user.email}, your access request was rejected.
    <br/>
    <button id="resendRequestBtn">Resend Request</button>
  `;
  document.getElementById('resendRequestBtn').onclick = () => resendHandler(user);

  profilePic.style.display = 'block';
  profilePic.src = user.photoURL;
  loginBtn.style.display = 'none';
  profileUsername.textContent = `Hello, ${user.displayName.split(' ')[0]}`;
  buildProfileMenu(null); // Show basic menu with logout
}

export function updateUIToLoggedIn(user, role) {
  mainContent.classList.remove('hidden');
  statusMessage.classList.add('hidden');

  document.body.classList.remove('is-viewer');
  if (role === 'admin') {
    document.body.classList.add('is-admin');
  } else {
    document.body.classList.remove('is-admin');
  }
  profilePic.src = user.photoURL;
  profilePic.title = user.displayName;
  profilePic.style.display = 'block';
  loginBtn.style.display = 'none';
  profileUsername.textContent = `Hello, ${user.displayName.split(' ')[0]}`;
  currentUserRole = role;
  buildProfileMenu(role);
}

export function updateUIToLoggedOut() {
  mainContent.classList.add('hidden');
  statusMessage.classList.add('hidden');

  document.body.classList.add('is-viewer');
  document.body.classList.remove('is-admin');
  profilePic.style.display = 'none';
  loginBtn.style.display = 'block';
  profileUsername.textContent = 'Hello, Guest';
  profileMenu.innerHTML = '';
  currentUserRole = null;

  // Clear amounts and table
  const totalFund = document.getElementById('totalFund');
  const totalSpent = document.getElementById('totalSpent');
  const remainingBalance = document.getElementById('remainingBalance');
  totalFund.textContent = '₹0';
  totalSpent.textContent = '₹0';
  remainingBalance.textContent = '₹0';

  const expenseTable = document.getElementById('expenseTable');
  if (expenseTable) expenseTable.innerHTML = '';
}


// Build profile menu. Give buttons IDs so we can attach listeners.
function buildProfileMenu(role) {
  profileMenu.innerHTML = '';

  if (role === 'admin') {
    const requestsBtn = document.createElement('button');
    requestsBtn.id = 'uiRequestsBtn'; // Add ID
    requestsBtn.innerHTML = '<i class="fas fa-user-plus"></i> Requests';
    profileMenu.appendChild(requestsBtn);

    const membersBtn = document.createElement('button');
    membersBtn.id = 'uiMembersBtn'; // Add ID
    membersBtn.innerHTML = '<i class="fas fa-users"></i> Members';
    profileMenu.appendChild(membersBtn);
  }

  // Theme toggle button
  const theme = document.body.getAttribute('data-theme') || 'light';
  const themeLabel = theme === 'light' ? 'Dark' : 'Light';
  const themeToggleBtn = document.createElement('button');
  themeToggleBtn.id = 'uiThemeToggleBtn';
  themeToggleBtn.innerHTML = `<i class="fas fa-adjust"></i> Toggle Theme (${themeLabel})`;
  profileMenu.appendChild(themeToggleBtn);

  // Logout Button
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'uiProfileLogoutBtn';
  logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
  profileMenu.appendChild(logoutBtn);
}


// === Click Handlers & Panel Content Functions ===

export function onLoginClick(handler) {
  loginBtn.onclick = handler;
}

// Use event delegation for menu items since they are rebuilt
export function onRequestsClick(handler) {
    profileMenu.addEventListener('click', e => {
        if (e.target.closest('#uiRequestsBtn')) handler();
    });
}
export function onMembersClick(handler) {
    profileMenu.addEventListener('click', e => {
        if (e.target.closest('#uiMembersBtn')) handler();
    });
}
export function onLogoutClick(handler) {
  profileMenu.addEventListener('click', e => {
    if (e.target.closest('#uiProfileLogoutBtn')) handler();
  });
}
export function onThemeToggleClick(handler) {
  profileMenu.addEventListener('click', e => {
    if (e.target.closest('#uiThemeToggleBtn')) handler();
  });
}

// Functions to control the content of the profile panel
export function showPanelLoading() {
    profileContent.innerHTML = '<div class="spinner"></div>';
}
export function setPanelContent(html) {
    profileContent.innerHTML = html;
}

export function getCurrentRole() {
  return currentUserRole;
}