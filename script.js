/* ==========================================================
   Exam Registration System - script.js
   Plain JavaScript only. No frameworks, no backend, no APIs.
   Data is kept in the browser's Local Storage.
   ========================================================== */
'use strict';

/* ==========================================================
   1. DATA AND CONSTANTS
   ========================================================== */

// Local Storage keys
const STORAGE = {
  registrations: 'ers_registrations',
  session: 'ers_session',
  theme: 'ers_theme',
  password: 'ers_password'
};

// Demo student account (there is no backend, so this stands in for a database)
const STUDENT = {
  username: 'student',
  regNo: '24IT1001',
  name: 'Ananya Krishnan',
  email: 'ananya.k@college.edu',
  phone: '9876543210',
  department: 'Information Technology',
  year: '2',
  semester: '5',
  programme: 'B.Tech',
  academicYear: '2026-27'
};
const DEFAULT_PASSWORD = 'Exam@2026';

// An exam is treated as completed this many hours after its start time
const EXAM_DURATION_HOURS = 3;

// Subjects. Dates are ISO (YYYY-MM-DD) so they are easy to compare.
// Subjects without a date have not been scheduled yet.
// NOTE: CS24505 to CS24507 are placeholder codes - replace with your real codes.
const SUBJECTS = [
  { code: 'CS24501', name: 'OOSE', fullName: 'Object Oriented Software Engineering',
    description: 'Object Oriented Software Engineering: requirements, UML modelling, design patterns and project practice.',
    date: '2026-10-15', time: '10:00 AM', time24: '10:00' },
  { code: 'CS24502', name: 'Mobile Application Development', fullName: 'Mobile Application Development',
    description: 'Building apps for phones and tablets: interface design, app lifecycle, storage and deployment.',
    date: '2026-10-17', time: '10:00 AM', time24: '10:00' },
  { code: 'CS24503', name: 'Software Testing', fullName: 'Software Testing',
    description: 'Test planning, test case design, automation basics and quality assurance practice.',
    date: '2026-10-19', time: '10:00 AM', time24: '10:00' },
  { code: 'CS24504', name: 'UI/UX Design', fullName: 'UI/UX Design',
    description: 'User research, wireframing, prototyping and usability evaluation of digital products.',
    date: '2026-10-21', time: '10:00 AM', time24: '10:00' },
  { code: 'CS24505', name: 'Foundation of Robotics', fullName: 'Foundation of Robotics',
    description: 'Introduction to robot components, sensors, actuators, kinematics and control.',
    date: '', time: '', time24: '' },
  { code: 'CS24506', name: 'Professional Ethics and Human Values', fullName: 'Professional Ethics and Human Values',
    description: 'Ethical thinking, professional responsibility and human values in engineering practice.',
    date: '', time: '', time24: '' },
  { code: 'CS24507', name: 'Cloud Computing', fullName: 'Cloud Computing',
    description: 'Cloud service models, virtualisation, storage, scaling and deployment fundamentals.',
    date: '', time: '', time24: '' }
];

// Validation patterns
const PATTERNS = {
  name: /^[A-Za-z][A-Za-z .'-]{2,59}$/,
  regNo: /^[A-Za-z0-9]{6,15}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  phone: /^[6-9]\d{9}$/
};

/* ==========================================================
   2. APPLICATION STATE
   ========================================================== */
let registrations = [];      // Registered subjects loaded from Local Storage
let selectedCode = '';       // Subject currently chosen for registration
let popupDismiss = null;     // Callback run when the message popup is dismissed
let lastFocused = null;      // Element to return focus to after a popup closes

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ==========================================================
   3. SMALL HELPERS
   ========================================================== */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Escape text before inserting it into HTML. */
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

/** 2026-10-15  ->  15-10-2026 */
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/** 2026-10-15  ->  { day: '15', month: 'Oct' } (used by the login ticket) */
function dateParts(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: date.toLocaleString('en-GB', { month: 'short' })
  };
}

function getSubject(code) {
  return SUBJECTS.find(s => s.code === code);
}

function firstName(fullName) {
  return fullName.split(' ')[0];
}

function initials(fullName) {
  return fullName.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
}

// Local Storage wrappers (they fail quietly if storage is blocked)
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (err) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (err) { /* storage unavailable */ }
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (err) { /* storage unavailable */ }
}

function getPassword() {
  return storageGet(STORAGE.password) || DEFAULT_PASSWORD;
}

/* ==========================================================
   4. LOCAL STORAGE FOR REGISTERED SUBJECTS
   ========================================================== */
function loadRegistrations() {
  try {
    const data = JSON.parse(storageGet(STORAGE.registrations) || '[]');
    // Keep only records that match a known subject
    return Array.isArray(data) ? data.filter(r => r && getSubject(r.code)) : [];
  } catch (err) {
    return [];
  }
}

function saveRegistrations() {
  storageSet(STORAGE.registrations, JSON.stringify(registrations));
}

function getRegistration(code) {
  return registrations.find(r => r.code === code);
}

function isRegistered(code) {
  return Boolean(getRegistration(code));
}

/** Creates a reference number such as ERS-2026-K3F9A2 */
function createReference() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ERS-${new Date().getFullYear()}-${suffix}`;
}

/* ==========================================================
   5. EXAM DATE / STATUS LOGIC
   ========================================================== */
function getExamEnd(subject) {
  if (!subject.date) return null;
  const [hours, minutes] = subject.time24.split(':').map(Number);
  const end = new Date(`${subject.date}T00:00:00`);
  end.setHours(hours + EXAM_DURATION_HOURS, minutes);
  return end;
}

function isCompleted(subject) {
  const end = getExamEnd(subject);
  return end ? end < new Date() : false;
}

/** Returns the label and badge style shown for a subject. */
function getSubjectStatus(subject) {
  const registered = isRegistered(subject.code);
  const completed = isCompleted(subject);

  if (registered && completed) return { key: 'completed', label: 'Completed', badge: 'badge-muted' };
  if (registered) return { key: 'registered', label: 'Registered', badge: 'badge-success' };
  if (completed) return { key: 'closed', label: 'Registration closed', badge: 'badge-warn' };
  if (!subject.date) return { key: 'tba', label: 'Date to be announced', badge: 'badge-warn' };
  return { key: 'open', label: 'Open for registration', badge: 'badge-info' };
}

/* ==========================================================
   6. POPUP MESSAGES (MODALS)
   ========================================================== */
const POPUP_ICONS = { success: '\u2713', error: '!', warning: '!', info: 'i' };

function openModal(id) {
  const modal = document.getElementById(id);
  lastFocused = document.activeElement;
  modal.hidden = false;
  document.body.classList.add('modal-open');
  const focusTarget = $('input, select, textarea, button', modal);
  if (focusTarget) focusTarget.focus();
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.hidden = true;
  if (!$('.modal:not([hidden])')) document.body.classList.remove('modal-open');
  if (lastFocused && document.body.contains(lastFocused) && typeof lastFocused.focus === 'function') {
    lastFocused.focus();
  }
}

/** Closes a modal the way a user would (Esc key or click outside). */
function dismissModal(id) {
  closeModal(id);
  if (id === 'messageModal' && popupDismiss) {
    const callback = popupDismiss;
    popupDismiss = null;
    callback();
  }
}

/** Builds the buttons shown at the bottom of the message popup. */
function setPopupButtons(buttons) {
  const box = $('#messageActions');
  box.innerHTML = '';
  buttons.forEach(config => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ${config.primary ? 'btn-primary' : 'btn-ghost'}`;
    button.textContent = config.label;
    button.addEventListener('click', () => {
      popupDismiss = null;
      closeModal('messageModal');
      if (config.onClick) config.onClick();
    });
    box.appendChild(button);
  });
}

function fillPopup(type, title, message) {
  const icon = $('#messageIcon');
  icon.className = `modal-icon ${type}`;
  icon.textContent = POPUP_ICONS[type] || 'i';
  $('#messageTitle').textContent = title;
  $('#messageText').textContent = message;
}

/** Shows a message popup with a single OK button. */
function showPopup(type, title, message, onClose) {
  fillPopup(type, title, message);
  popupDismiss = onClose || null;
  setPopupButtons([{ label: 'OK', primary: true, onClick: onClose }]);
  openModal('messageModal');
}

/** Shows a popup that asks the user to confirm an action. */
function showConfirm(title, message, confirmLabel, onConfirm) {
  fillPopup('warning', title, message);
  popupDismiss = null;
  setPopupButtons([
    { label: 'Cancel', primary: false },
    { label: confirmLabel, primary: true, onClick: onConfirm }
  ]);
  openModal('messageModal');
}

/* ==========================================================
   7. FORM VALIDATION HELPERS
   ========================================================== */

/** Shows or clears an error under a field. Returns true when the field is valid. */
function setFieldError(input, message) {
  const field = input.closest('.field');
  const output = field.querySelector('.error-msg');
  if (message) {
    field.classList.add('has-error');
    input.setAttribute('aria-invalid', 'true');
    output.textContent = message;
  } else {
    field.classList.remove('has-error');
    input.removeAttribute('aria-invalid');
    output.textContent = '';
  }
  return !message;
}

function clearFormErrors(form) {
  $$('.field', form).forEach(field => {
    field.classList.remove('has-error');
    const output = field.querySelector('.error-msg');
    if (output) output.textContent = '';
    const input = field.querySelector('input, select, textarea');
    if (input) input.removeAttribute('aria-invalid');
  });
}

/** Focuses the first field in a form that has an error. */
function focusFirstError(form) {
  const bad = $('.field.has-error input, .field.has-error select, .field.has-error textarea', form);
  if (bad) bad.focus();
}

function isStrongPassword(value) {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

/* ==========================================================
   8. THEME (DARK MODE TOGGLE)
   ========================================================== */
function getSavedTheme() {
  const saved = storageGet(STORAGE.theme);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $$('.theme-toggle').forEach(button => {
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    $('.theme-icon', button).textContent = theme === 'dark' ? '\u2600' : '\u263E';
    $('.theme-label', button).textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  });
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  storageSet(STORAGE.theme, next);
  applyTheme(next);
}

/* ==========================================================
   9. LOGIN, LOGOUT AND PASSWORD RECOVERY
   ========================================================== */
function handleLogin(event) {
  event.preventDefault();
  const userInput = $('#loginUser');
  const passInput = $('#loginPass');
  const user = userInput.value.trim();
  const pass = passInput.value;

  // Step 1: check that both fields are filled in
  let valid = true;
  valid = setFieldError(userInput, user ? '' : 'Enter your register number or username.') && valid;
  valid = setFieldError(passInput, pass ? '' : 'Enter your password.') && valid;
  if (!valid) {
    showPopup('error', 'Login details missing', 'Enter both your register number (or username) and your password.');
    return;
  }

  // Step 2: check the credentials
  const knownUsers = [STUDENT.regNo.toLowerCase(), STUDENT.username.toLowerCase()];
  const userOk = knownUsers.includes(user.toLowerCase());
  if (!userOk || pass !== getPassword()) {
    setFieldError(passInput, 'The register number or password is incorrect.');
    showPopup('error', 'Login failed', 'The register number or password you entered is incorrect. Check both and try again, or use Forgot password.');
    return;
  }

  // Step 3: success
  storageSet(STORAGE.session, STUDENT.regNo);
  showApp();
  showPopup('success', 'Login successful', `Welcome back, ${firstName(STUDENT.name)}. Your dashboard is ready.`);
}

function handleLogout() {
  showConfirm('Log out?', 'You will need to log in again to register for exams.', 'Log out', () => {
    storageRemove(STORAGE.session);
    closeMobileNav();
    showLogin();
    showPopup('info', 'Logged out', 'You have been logged out safely.');
  });
}

function handleForgotUsername(event) {
  event.preventDefault();
  const emailInput = $('#fuEmail');
  const email = emailInput.value.trim();

  if (!PATTERNS.email.test(email)) {
    setFieldError(emailInput, 'Enter a valid email address.');
    return;
  }
  setFieldError(emailInput, '');
  closeModal('forgotUserModal');

  if (email.toLowerCase() === STUDENT.email.toLowerCase()) {
    // This is a demo, so the username is shown here instead of being emailed.
    showPopup('success', 'Username found',
      `Your username is your register number: ${STUDENT.regNo}. (Demo only: in a real system this would be emailed to you.)`);
  } else {
    showPopup('error', 'No account found', 'No student account uses that email address. Check the address and try again.');
  }
}

function handleForgotPassword(event) {
  event.preventDefault();
  const userInput = $('#fpUser');
  const emailInput = $('#fpEmail');
  const newInput = $('#fpNew');
  const confirmInput = $('#fpConfirm');

  let valid = true;
  valid = setFieldError(userInput, userInput.value.trim() ? '' : 'Enter your register number or username.') && valid;
  valid = setFieldError(emailInput, PATTERNS.email.test(emailInput.value.trim()) ? '' : 'Enter a valid email address.') && valid;
  valid = setFieldError(newInput, isStrongPassword(newInput.value) ? '' : 'Use at least 8 characters with a letter and a number.') && valid;
  valid = setFieldError(confirmInput, confirmInput.value === newInput.value ? '' : 'The passwords do not match.') && valid;
  if (!valid) { focusFirstError(event.target); return; }

  const user = userInput.value.trim().toLowerCase();
  const identityOk =
    [STUDENT.regNo.toLowerCase(), STUDENT.username.toLowerCase()].includes(user) &&
    emailInput.value.trim().toLowerCase() === STUDENT.email.toLowerCase();

  closeModal('forgotPassModal');
  if (!identityOk) {
    showPopup('error', 'Details do not match', 'The register number and email do not match our records. Check them and try again.');
    return;
  }

  storageSet(STORAGE.password, newInput.value);
  event.target.reset();
  showPopup('success', 'Password updated', 'Your password has been changed. Log in with your new password.');
}

/* ==========================================================
   10. SHOWING / HIDING THE LOGIN PAGE AND APP
   ========================================================== */
function showApp() {
  $('#loginPage').hidden = true;
  $('#app').hidden = false;

  // Fill in student details
  $('#topName').textContent = STUDENT.name;
  $('#topReg').textContent = STUDENT.regNo;
  $('#topAvatar').textContent = initials(STUDENT.name);
  $('#welcomeName').textContent = firstName(STUDENT.name);
  $('#welcomeReg').textContent = STUDENT.regNo;
  $('#todayDate').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  registrations = loadRegistrations();
  renderProfile();
  resetRegistrationForm();
  renderAll(true);
  window.scrollTo(0, 0);
}

function showLogin() {
  $('#app').hidden = true;
  $('#loginPage').hidden = false;
  const form = $('#loginForm');
  form.reset();
  clearFormErrors(form);
  window.scrollTo(0, 0);
}

/* ==========================================================
   11. RENDERING
   ========================================================== */

/** Re-draws every section that depends on registration data. */
function renderAll(replayDashboard = false) {
  renderSubjectOptions();
  renderSubjects();
  renderRegistered();
  renderSchedule();
  renderStatus();
  renderDashboard(replayDashboard);
}

/* ---------- Dashboard (dynamic card updates) ---------- */
function animateNumber(element, target) {
  const from = Number(element.dataset.value || 0);
  element.dataset.value = target;

  if (reduceMotion || from === target) {
    element.textContent = target;
    return;
  }
  const start = performance.now();
  const duration = 700;
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderDashboard(replay) {
  const grid = $('#statGrid');
  const counters = [
    ['#statTotal', SUBJECTS.length],
    ['#statRegistered', registrations.length],
    ['#statUpcoming', registrations.filter(r => !isCompleted(getSubject(r.code))).length],
    ['#statCompleted', registrations.filter(r => isCompleted(getSubject(r.code))).length]
  ];

  if (replay) {
    // Restart the entrance animation and count up from zero
    grid.classList.remove('is-animated');
    void grid.offsetWidth; // force reflow so the animation can run again
    grid.classList.add('is-animated');
    counters.forEach(([selector]) => {
      const el = $(selector);
      el.dataset.value = 0;
      el.textContent = 0;
    });
  }
  counters.forEach(([selector, value]) => animateNumber($(selector), value));
}

/* ---------- Available subjects with search and filter ---------- */
function renderSubjects() {
  const query = $('#searchInput').value.trim().toLowerCase();
  const filter = $('#filterSelect').value;

  const list = SUBJECTS.filter(subject => {
    const text = `${subject.code} ${subject.name} ${subject.fullName}`.toLowerCase();
    if (query && !text.includes(query)) return false;

    const status = getSubjectStatus(subject).key;
    if (filter === 'open') return status === 'open';
    if (filter === 'registered') return status === 'registered' || status === 'completed';
    if (filter === 'tba') return !subject.date;
    return true;
  });

  $('#resultCount').textContent = `Showing ${list.length} of ${SUBJECTS.length} subjects`;

  const grid = $('#subjectGrid');
  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No subjects match your search</h3>
        <p>Try a different name or code, or change the filter.</p>
        <button type="button" class="btn btn-ghost" id="clearSearchBtn">Clear search</button>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(subject => {
    const status = getSubjectStatus(subject);
    const canRegister = status.key === 'open';
    const buttonLabel = canRegister ? 'Register for this exam'
      : status.key === 'registered' || status.key === 'completed' ? 'Already registered'
      : status.key === 'tba' ? 'Not open yet' : 'Registration closed';

    return `
      <article class="subject-card ${selectedCode === subject.code ? 'is-selected' : ''}">
        <div class="subject-top">
          <span class="code-chip">${subject.code}</span>
          <span class="badge ${status.badge}">${status.label}</span>
        </div>
        <h3>${escapeHTML(subject.name)}</h3>
        <p class="subject-desc">${escapeHTML(subject.description)}</p>
        <dl class="subject-meta">
          <div><dt>Exam date</dt><dd>${subject.date ? formatDate(subject.date) : 'To be announced'}</dd></div>
          <div><dt>Time</dt><dd>${subject.time || 'To be announced'}</dd></div>
        </dl>
        <button type="button" class="btn btn-primary btn-sm" data-select="${subject.code}" ${canRegister ? '' : 'disabled'}>${buttonLabel}</button>
      </article>`;
  }).join('');
}

/* ---------- Registration form: subject dropdown ---------- */
function renderSubjectOptions() {
  const select = $('#regSubject');
  const keep = selectedCode;

  select.innerHTML = '<option value="">Select a subject</option>' + SUBJECTS.map(subject => {
    const status = getSubjectStatus(subject);
    const unavailable = status.key === 'registered' || status.key === 'completed' || status.key === 'closed';
    const note = unavailable ? ' (not available)' : '';
    return `<option value="${subject.code}" ${unavailable ? 'disabled' : ''}>${subject.code} - ${escapeHTML(subject.name)}${note}</option>`;
  }).join('');

  const stillValid = keep && !select.querySelector(`option[value="${keep}"]`)?.disabled;
  select.value = stillValid ? keep : '';
  selectedCode = select.value;
  updateExamFields();
}

/** Fills the read-only exam date/time fields for the chosen subject. */
function updateExamFields() {
  const subject = getSubject($('#regSubject').value);
  $('#regDate').value = subject ? (subject.date ? formatDate(subject.date) : 'To be announced') : '';
  $('#regTime').value = subject ? (subject.time || 'To be announced') : '';
}

/* ---------- Registered subjects ---------- */
function renderRegistered() {
  const grid = $('#registeredGrid');
  const summary = $('#registeredSummary');

  if (!registrations.length) {
    summary.textContent = 'Subjects you have registered for appear here.';
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No registrations yet</h3>
        <p>Choose a subject and submit the registration form. It will show up here straight away.</p>
        <button type="button" class="btn btn-primary" data-scroll="subjects">Browse subjects</button>
      </div>`;
    return;
  }

  summary.textContent = `You have registered for ${registrations.length} of ${SUBJECTS.length} subjects.`;
  grid.innerHTML = registrations.map(reg => {
    const subject = getSubject(reg.code);
    const completed = isCompleted(subject);
    return `
      <article class="subject-card">
        <div class="subject-top">
          <span class="code-chip">${reg.code}</span>
          <span class="badge ${completed ? 'badge-muted' : 'badge-success'}">${completed ? 'Completed' : 'Registered'}</span>
        </div>
        <h3>${escapeHTML(subject.name)}</h3>
        <dl class="subject-meta">
          <div><dt>Exam date</dt><dd>${subject.date ? formatDate(subject.date) : 'To be announced'}</dd></div>
          <div><dt>Time</dt><dd>${subject.time || 'To be announced'}</dd></div>
        </dl>
        <p class="reg-detail">Reference: <strong>${escapeHTML(reg.ref)}</strong></p>
        <p class="reg-detail">Registered on ${new Date(reg.registeredOn).toLocaleDateString('en-GB')} for year ${escapeHTML(reg.year)}, semester ${escapeHTML(reg.semester)}</p>
        <div class="card-actions">
          <button type="button" class="btn btn-danger btn-sm" data-cancel="${reg.code}" ${completed ? 'disabled' : ''}>Cancel registration</button>
        </div>
      </article>`;
  }).join('');
}

/* ---------- Exam schedule table ---------- */
function renderSchedule() {
  const scheduled = SUBJECTS.filter(s => s.date);
  $('#scheduleBody').innerHTML = scheduled.map(subject => {
    const status = getSubjectStatus(subject);
    return `
      <tr>
        <td data-label="Subject code"><span class="code-chip">${subject.code}</span></td>
        <td data-label="Subject name">${escapeHTML(subject.name)}</td>
        <td data-label="Exam date">${formatDate(subject.date)}</td>
        <td data-label="Exam time">${subject.time}</td>
        <td data-label="Exam status"><span class="badge ${status.badge}">${status.label}</span></td>
      </tr>`;
  }).join('');

  const pending = SUBJECTS.filter(s => !s.date).map(s => s.name);
  $('#scheduleNote').textContent = pending.length
    ? `Dates for ${pending.join(', ')} will be announced later.`
    : '';
}

/* ---------- Registration status ---------- */
function renderStatus() {
  const total = SUBJECTS.length;
  const done = registrations.length;
  const percent = Math.round((done / total) * 100);

  $('#progressText').textContent = `${done} of ${total} subjects registered`;
  $('#progressPercent').textContent = `${percent}%`;
  $('#progressFill').style.width = `${percent}%`;
  $('#progressBar').setAttribute('aria-valuenow', percent);

  $('#statusList').innerHTML = SUBJECTS.map(subject => {
    const status = getSubjectStatus(subject);
    const reg = getRegistration(subject.code);
    return `
      <li class="status-row">
        <div class="status-name">
          <span class="code-chip">${subject.code}</span>
          <strong>${escapeHTML(subject.name)}</strong>
        </div>
        <div class="status-right">
          <span class="status-ref">${reg ? `Ref: ${escapeHTML(reg.ref)}` : 'No reference yet'}</span>
          <span class="badge ${status.badge}">${status.label}</span>
        </div>
      </li>`;
  }).join('');
}

/* ---------- Student profile ---------- */
function renderProfile() {
  $('#profileAvatar').textContent = initials(STUDENT.name);
  const rows = [
    ['Full name', STUDENT.name],
    ['Register number', STUDENT.regNo],
    ['Email', STUDENT.email],
    ['Phone number', STUDENT.phone],
    ['Programme', STUDENT.programme],
    ['Department', STUDENT.department],
    ['Year', `Year ${STUDENT.year}`],
    ['Semester', `Semester ${STUDENT.semester}`],
    ['Academic year', STUDENT.academicYear]
  ];
  $('#profileList').innerHTML = rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHTML(value)}</dd></div>`)
    .join('');
}

/* ---------- Login page ticket preview ---------- */
function renderTicket() {
  $('#ticketList').innerHTML = SUBJECTS.filter(s => s.date).map(subject => {
    const parts = dateParts(subject.date);
    return `
      <li>
        <div class="ticket-date">${parts.day}<small>${parts.month}</small></div>
        <div class="ticket-subject">
          <strong>${escapeHTML(subject.name)}</strong>
          <span>${subject.code}, ${subject.time}</span>
        </div>
      </li>`;
  }).join('');
}

/* ==========================================================
   12. SUBJECT SELECTION AND REGISTRATION
   ========================================================== */

/** Called when a student picks a subject card or the dropdown. */
function selectSubject(code) {
  selectedCode = code;
  $('#regSubject').value = code;
  setFieldError($('#regSubject'), '');
  updateExamFields();
  renderSubjects(); // highlights the chosen card
}

/** Pre-fills the form with the student's profile details. */
function resetRegistrationForm() {
  const form = $('#registerForm');
  form.reset();
  clearFormErrors(form);
  selectedCode = '';
  $('#regName').value = STUDENT.name;
  $('#regNo').value = STUDENT.regNo;
  $('#regEmail').value = STUDENT.email;
  $('#regPhone').value = STUDENT.phone;
  $('#regDept').value = STUDENT.department;
  $('#regYear').value = STUDENT.year;
  $('#regSem').value = STUDENT.semester;
  $('#regSubject').value = '';
  updateExamFields();
}

function handleRegistration(event) {
  event.preventDefault();
  const form = event.target;

  const nameInput = $('#regName');
  const regNoInput = $('#regNo');
  const emailInput = $('#regEmail');
  const phoneInput = $('#regPhone');
  const deptInput = $('#regDept');
  const yearInput = $('#regYear');
  const semInput = $('#regSem');
  const subjectInput = $('#regSubject');

  // Validate every field (each call both checks and shows its message)
  let valid = true;
  valid = setFieldError(nameInput, PATTERNS.name.test(nameInput.value.trim()) ? '' : 'Enter your full name (letters only, at least 3 characters).') && valid;
  valid = setFieldError(regNoInput, PATTERNS.regNo.test(regNoInput.value.trim()) ? '' : 'Enter a register number of 6 to 15 letters or digits.') && valid;
  valid = setFieldError(emailInput, PATTERNS.email.test(emailInput.value.trim()) ? '' : 'Enter a valid email address.') && valid;
  valid = setFieldError(phoneInput, PATTERNS.phone.test(phoneInput.value.replace(/\s/g, '')) ? '' : 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.') && valid;
  valid = setFieldError(deptInput, deptInput.value ? '' : 'Select your department.') && valid;
  valid = setFieldError(yearInput, yearInput.value ? '' : 'Select your year.') && valid;
  valid = setFieldError(semInput, semInput.value ? '' : 'Select your semester.') && valid;
  valid = setFieldError(subjectInput, subjectInput.value ? '' : 'Select the subject you want to register for.') && valid;

  if (!valid) {
    focusFirstError(form);
    showPopup('error', 'Check your details', 'Some fields are missing or incorrect. The problems are marked in red.');
    return;
  }

  const subject = getSubject(subjectInput.value);

  // Prevent duplicate registration for the same subject
  if (isRegistered(subject.code)) {
    showPopup('error', 'Already registered', `You have already registered for ${subject.name} (${subject.code}). Each subject can be registered only once.`);
    return;
  }
  if (isCompleted(subject)) {
    showPopup('error', 'Registration closed', `The ${subject.name} exam has already been held, so registration is closed.`);
    return;
  }

  // Save the registration in Local Storage
  const record = {
    ref: createReference(),
    code: subject.code,
    studentName: nameInput.value.trim(),
    regNo: regNoInput.value.trim().toUpperCase(),
    email: emailInput.value.trim(),
    phone: phoneInput.value.replace(/\s/g, ''),
    department: deptInput.value,
    year: yearInput.value,
    semester: semInput.value,
    registeredOn: new Date().toISOString()
  };
  registrations.push(record);
  saveRegistrations();

  resetRegistrationForm();
  renderAll();

  const when = subject.date ? `${formatDate(subject.date)} at ${subject.time}` : 'a date that will be announced';
  showPopup('success', 'Registration successful',
    `You are registered for ${subject.name} (${subject.code}). Exam: ${when}. Reference number: ${record.ref}.`,
    () => scrollToSection('registered'));
}

function cancelRegistration(code) {
  const subject = getSubject(code);
  showConfirm('Cancel registration?',
    `Your registration for ${subject.name} (${subject.code}) will be removed. You can register again later.`,
    'Cancel registration',
    () => {
      registrations = registrations.filter(r => r.code !== code);
      saveRegistrations();
      renderAll();
      showPopup('info', 'Registration cancelled', `Your registration for ${subject.name} has been removed.`);
    });
}

/* ==========================================================
   13. CONTACT FORM
   ========================================================== */
function handleContact(event) {
  event.preventDefault();
  const nameInput = $('#contactName');
  const emailInput = $('#contactEmail');
  const messageInput = $('#contactMessage');

  let valid = true;
  valid = setFieldError(nameInput, PATTERNS.name.test(nameInput.value.trim()) ? '' : 'Enter your name.') && valid;
  valid = setFieldError(emailInput, PATTERNS.email.test(emailInput.value.trim()) ? '' : 'Enter a valid email address.') && valid;
  valid = setFieldError(messageInput, messageInput.value.trim().length >= 10 ? '' : 'Write at least 10 characters so we can help you.') && valid;
  if (!valid) { focusFirstError(event.target); return; }

  event.target.reset();
  showPopup('success', 'Message sent', 'Thank you. The examination cell will reply to your email address. (Demo only: nothing is actually sent.)');
}

/* ==========================================================
   14. NAVIGATION: SMOOTH SCROLL, MOBILE MENU, ACTIVE LINK
   ========================================================== */
function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

function openMobileNav() {
  $('#sidebar').classList.add('open');
  $('#overlay').hidden = false;
  document.body.classList.add('nav-open');
  $('#menuBtn').setAttribute('aria-expanded', 'true');
  $('#menuBtn').setAttribute('aria-label', 'Close navigation menu');
}

function closeMobileNav() {
  $('#sidebar').classList.remove('open');
  $('#overlay').hidden = true;
  document.body.classList.remove('nav-open');
  $('#menuBtn').setAttribute('aria-expanded', 'false');
  $('#menuBtn').setAttribute('aria-label', 'Open navigation menu');
}

function toggleMobileNav() {
  $('#sidebar').classList.contains('open') ? closeMobileNav() : openMobileNav();
}

/** Highlights the sidebar link of the section currently on screen. */
function setupScrollSpy() {
  const sections = $$('main section[id]');
  const links = $$('.nav-link');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(link => link.classList.toggle('active', link.dataset.scroll === entry.target.id));
    });
  }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
  sections.forEach(section => observer.observe(section));
}

/* ==========================================================
   15. EVENT LISTENERS
   ========================================================== */
function bindEvents() {
  // Theme toggles (login page and top bar)
  $$('.theme-toggle').forEach(button => button.addEventListener('click', toggleTheme));

  // Login page
  $('#loginForm').addEventListener('submit', handleLogin);
  $('#togglePass').addEventListener('click', () => {
    const input = $('#loginPass');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('#togglePass').textContent = show ? 'Hide' : 'Show';
    $('#togglePass').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  $('#forgotUserBtn').addEventListener('click', () => {
    $('#forgotUserForm').reset();
    clearFormErrors($('#forgotUserForm'));
    openModal('forgotUserModal');
  });
  $('#forgotPassBtn').addEventListener('click', () => {
    $('#forgotPassForm').reset();
    clearFormErrors($('#forgotPassForm'));
    openModal('forgotPassModal');
  });
  $('#forgotUserForm').addEventListener('submit', handleForgotUsername);
  $('#forgotPassForm').addEventListener('submit', handleForgotPassword);

  // Popups: close buttons and clicking outside the box
  $$('[data-close-modal]').forEach(button => {
    button.addEventListener('click', () => closeModal(button.dataset.closeModal));
  });
  $$('.modal').forEach(modal => {
    modal.addEventListener('mousedown', event => {
      if (event.target === modal) dismissModal(modal.id);
    });
  });

  // Clear a field's error as soon as the user edits it
  document.addEventListener('input', event => {
    const field = event.target.closest && event.target.closest('.field.has-error');
    if (field) setFieldError(event.target, '');
  });
  document.addEventListener('change', event => {
    const field = event.target.closest && event.target.closest('.field.has-error');
    if (field) setFieldError(event.target, '');
  });

  // Top bar
  $('#menuBtn').addEventListener('click', toggleMobileNav);
  $('#overlay').addEventListener('click', closeMobileNav);
  $('#logoutBtn').addEventListener('click', handleLogout);

  // Any element with data-scroll scrolls smoothly to that section
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-scroll]');
    if (!trigger) return;
    event.preventDefault();
    closeMobileNav();
    scrollToSection(trigger.dataset.scroll);
  });

  // Subject search and filter
  $('#searchInput').addEventListener('input', renderSubjects);
  $('#filterSelect').addEventListener('change', renderSubjects);

  // Subject cards, empty state and registered cards (event delegation)
  document.addEventListener('click', event => {
    const selectBtn = event.target.closest('[data-select]');
    if (selectBtn && !selectBtn.disabled) {
      selectSubject(selectBtn.dataset.select);
      scrollToSection('register');
      return;
    }
    const cancelBtn = event.target.closest('[data-cancel]');
    if (cancelBtn && !cancelBtn.disabled) {
      cancelRegistration(cancelBtn.dataset.cancel);
      return;
    }
    if (event.target.closest('#clearSearchBtn')) {
      $('#searchInput').value = '';
      $('#filterSelect').value = 'all';
      renderSubjects();
    }
  });

  // Registration form
  $('#regSubject').addEventListener('change', event => selectSubject(event.target.value));
  $('#registerForm').addEventListener('submit', handleRegistration);
  $('#resetFormBtn').addEventListener('click', () => {
    resetRegistrationForm();
    renderSubjects();
  });

  // Contact form
  $('#contactForm').addEventListener('submit', handleContact);

  // Keyboard: Escape closes popups and the mobile menu; Tab stays inside open popups
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const openModalEl = $('.modal:not([hidden])');
      if (openModalEl) dismissModal(openModalEl.id);
      else closeMobileNav();
    }
    if (event.key === 'Tab') {
      const modal = $('.modal:not([hidden])');
      if (!modal) return;
      const focusable = $$('button, input, select, textarea, a[href]', modal).filter(el => !el.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  // Close the drawer if the window grows to desktop width
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 992) closeMobileNav();
  });
}

/* ==========================================================
   16. START-UP
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getSavedTheme());
  renderTicket();
  bindEvents();
  setupScrollSpy();

  // Stay logged in if a session exists, otherwise show the login page
  if (storageGet(STORAGE.session) === STUDENT.regNo) {
    showApp();
  } else {
    showLogin();
  }
});
