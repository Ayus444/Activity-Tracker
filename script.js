/* ============================================================
   DayFlow — Daily Activity Tracker
   script.js
   ============================================================ */

// ── SVG gradient injection ────────────────────────────────────
const svgNS = 'http://www.w3.org/2000/svg';
function injectGradient() {
  const svg = document.getElementById('circularSVG');
  const defs = document.createElementNS(svgNS, 'defs');
  const grad = document.createElementNS(svgNS, 'linearGradient');
  grad.setAttribute('id', 'progressGradient');
  grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
  grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '100%');
  const s1 = document.createElementNS(svgNS, 'stop');
  s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', '#6c63ff');
  const s2 = document.createElementNS(svgNS, 'stop');
  s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', '#ff6b9d');
  grad.appendChild(s1); grad.appendChild(s2);
  defs.appendChild(grad);
  svg.insertBefore(defs, svg.firstChild);
}

// ── State ────────────────────────────────────────────────────
let state = {
  currentYear: 0,
  currentMonth: 0,
  selectedDate: null,   // 'YYYY-MM-DD'
  tasks: {},            // { 'YYYY-MM-DD': [ taskObj, ... ] }
  streaks: { study: 0, fitness: 0, streaming: 0, personal: 0 },
  editingTaskId: null,
  selectedCategory: 'study',
  moveDayOpen: false,
};

// ── Load / Save ───────────────────────────────────────────────
function loadState() {
  try {
    const saved = localStorage.getItem('dayflow_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      state.tasks = parsed.tasks || {};
      state.streaks = parsed.streaks || { study: 0, fitness: 0, streaming: 0, personal: 0 };
    }
  } catch(e) { /* ignore */ }
}
function saveState() {
  try {
    localStorage.setItem('dayflow_v2', JSON.stringify({
      tasks: state.tasks,
      streaks: state.streaks,
    }));
  } catch(e) { /* ignore */ }
}

// ── ID generator ─────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ── Date helpers ──────────────────────────────────────────────
function toKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function keyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function todayKey() { return keyFromDate(new Date()); }
function parseKey(key) {
  const [y,m,d] = key.split('-').map(Number);
  return new Date(y, m-1, d);
}
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const DAY_NAMES_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_NAMES_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── Calendar render ───────────────────────────────────────────
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const title = document.getElementById('currentMonthTitle');
  const { currentYear: y, currentMonth: m } = state;
  title.textContent = `${MONTH_NAMES[m]} ${y}`;

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();
  const today = todayKey();

  grid.innerHTML = '';

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day';

    let dateKey = null;
    if (i < firstDay) {
      const d = daysInPrev - firstDay + i + 1;
      cell.classList.add('other-month');
      cell.innerHTML = `<span class="day-num">${d}</span>`;
    } else if (i >= firstDay + daysInMonth) {
      const d = i - firstDay - daysInMonth + 1;
      cell.classList.add('other-month');
      cell.innerHTML = `<span class="day-num">${d}</span>`;
    } else {
      const d = i - firstDay + 1;
      dateKey = toKey(y, m, d);

      if (dateKey === today) cell.classList.add('today');
      if (dateKey === state.selectedDate) cell.classList.add('selected');

      const tasks = state.tasks[dateKey] || [];
      const total = tasks.length;
      const done = tasks.filter(t => t.completed).length;
      const pct = total ? Math.round((done/total)*100) : 0;

      // Category dots
      const cats = [...new Set(tasks.map(t => t.category))].slice(0,3);
      const dotsHtml = cats.map(c => `<div class="day-dot" style="background:var(--cat-${c})"></div>`).join('');

      cell.innerHTML = `
        <span class="day-num">${d}</span>
        ${total > 0 ? `
          <div class="day-progress-ring"><div class="day-progress-fill" style="width:${pct}%"></div></div>
          <div class="day-dots">${dotsHtml}</div>
        ` : ''}
      `;

      cell.dataset.key = dateKey;
      cell.addEventListener('click', () => selectDay(dateKey));
    }

    grid.appendChild(cell);
  }
}

function selectDay(key) {
  state.selectedDate = key;
  renderCalendar();
  renderDayPanel();
}

// ── Day Panel ─────────────────────────────────────────────────
function renderDayPanel() {
  const key = state.selectedDate;
  if (!key) return;

  const date = parseKey(key);
  const label = document.getElementById('selectedDateLabel');
  const sub = document.getElementById('selectedDateSub');

  label.textContent = `${DAY_NAMES_LONG[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
  sub.textContent = date.getFullYear();

  renderTaskList(key);
  updateProgress(key);
}

function renderTaskList(key) {
  const list = document.getElementById('taskList');
  const empty = document.getElementById('emptyState');
  const tasks = (state.tasks[key] || []).slice().sort((a,b) => a.timeStart.localeCompare(b.timeStart));

  list.innerHTML = '';
  list.appendChild(empty);

  if (tasks.length === 0) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  tasks.forEach((task, idx) => {
    const el = buildTaskEl(task, key);
    el.style.animationDelay = `${idx * 0.04}s`;
    list.appendChild(el);
  });

  initDragDrop(key);
}

function buildTaskEl(task, dateKey) {
  const el = document.createElement('div');
  el.className = `task-item cat-${task.category}${task.completed ? ' completed' : ''}`;
  el.dataset.id = task.id;
  el.draggable = true;

  const timeLabel = task.timeEnd
    ? `${task.timeStart} – ${task.timeEnd}`
    : task.timeStart;

  el.innerHTML = `
    <div class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></div>
    <div class="task-checkbox${task.completed ? ' checked' : ''}" data-id="${task.id}">
      <svg class="checkmark-svg" viewBox="0 0 14 11">
        <polyline points="1 5.5 5 9.5 13 1.5"/>
      </svg>
    </div>
    <div class="task-info">
      <div class="task-time"><i class="fa-regular fa-clock"></i> ${timeLabel}</div>
      <div class="task-name">${escHtml(task.name)}</div>
      ${task.notes ? `<div class="task-notes">${escHtml(task.notes)}</div>` : ''}
    </div>
    <span class="task-cat-badge cat-${task.category}">${task.category}</span>
    <div class="task-actions">
      <button class="task-action-btn edit-btn" data-id="${task.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
      <button class="task-action-btn delete-btn" data-id="${task.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
    </div>
  `;

  // Checkbox toggle
  el.querySelector('.task-checkbox').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTask(dateKey, task.id);
  });

  // Edit
  el.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(dateKey, task.id);
  });

  // Delete
  el.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(dateKey, task.id, el);
  });

  return el;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Progress ──────────────────────────────────────────────────
function updateProgress(key) {
  const tasks = state.tasks[key] || [];
  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Linear bar
  document.getElementById('progressBarFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = `${done} of ${total} task${total !== 1 ? 's' : ''} done`;

  // Circular
  const circumference = 2 * Math.PI * 32; // ≈ 201
  const offset = circumference - (pct / 100) * circumference;
  document.getElementById('cpFill').style.strokeDashoffset = offset;
  document.getElementById('cpLabel').textContent = pct + '%';

  // Update calendar cell
  renderCalendar();
}

// ── Task CRUD ─────────────────────────────────────────────────
function toggleTask(dateKey, taskId) {
  const tasks = state.tasks[dateKey] || [];
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  task.completed = !task.completed;

  // Animate checkbox
  const checkEl = document.querySelector(`.task-checkbox[data-id="${taskId}"]`);
  if (checkEl) {
    checkEl.classList.toggle('checked', task.completed);
    checkEl.closest('.task-item').classList.toggle('completed', task.completed);
  }

  // Ripple effect
  if (task.completed) spawnCompletionParticles(checkEl);

  saveState();
  updateProgress(dateKey);
  updateStreaks();
}

function spawnCompletionParticles(anchor) {
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const colors = ['#6c63ff','#ff6b9d','#43e0b5','#ff9f43'];
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.style.cssText = `
      position:fixed;
      left:${rect.left + rect.width/2}px;
      top:${rect.top + rect.height/2}px;
      width:6px;height:6px;
      border-radius:50%;
      background:${colors[i % colors.length]};
      pointer-events:none;
      z-index:9999;
      transition:transform 0.5s ease,opacity 0.5s ease;
    `;
    document.body.appendChild(p);
    const angle = (i / 8) * Math.PI * 2;
    const dist = 28 + Math.random() * 20;
    requestAnimationFrame(() => {
      p.style.transform = `translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist}px)`;
      p.style.opacity = '0';
    });
    setTimeout(() => p.remove(), 550);
  }
}

function deleteTask(dateKey, taskId, el) {
  el.classList.add('removing');
  setTimeout(() => {
    state.tasks[dateKey] = (state.tasks[dateKey] || []).filter(t => t.id !== taskId);
    saveState();
    renderDayPanel();
    updateStreaks();
  }, 300);
}

// ── Modal ─────────────────────────────────────────────────────
const modalOverlay = document.getElementById('modalOverlay');

function openAddModal() {
  if (!state.selectedDate) return;
  state.editingTaskId = null;
  state.moveDayOpen = false;
  document.getElementById('modalTitle').textContent = 'New Task';
  document.getElementById('taskName').value = '';
  document.getElementById('taskTimeStart').value = '08:00';
  document.getElementById('taskTimeEnd').value = '09:00';
  document.getElementById('taskNotes').value = '';
  document.getElementById('moveDayGroup').style.display = 'none';
  document.getElementById('moveTaskBtn').style.display = 'none';

  selectCategoryBtn('study');
  modalOverlay.classList.add('open');
  setTimeout(() => document.getElementById('taskName').focus(), 200);
}

function openEditModal(dateKey, taskId) {
  const task = (state.tasks[dateKey] || []).find(t => t.id === taskId);
  if (!task) return;
  state.editingTaskId = taskId;
  state.moveDayOpen = false;

  document.getElementById('modalTitle').textContent = 'Edit Task';
  document.getElementById('taskName').value = task.name;
  document.getElementById('taskTimeStart').value = task.timeStart;
  document.getElementById('taskTimeEnd').value = task.timeEnd || '';
  document.getElementById('taskNotes').value = task.notes || '';
  document.getElementById('moveDayGroup').style.display = 'none';
  document.getElementById('moveTaskBtn').style.display = 'flex';
  document.getElementById('moveToDate').value = dateKey;

  selectCategoryBtn(task.category);
  modalOverlay.classList.add('open');
  setTimeout(() => document.getElementById('taskName').focus(), 200);
}

function closeModal() {
  modalOverlay.classList.remove('open');
  state.editingTaskId = null;
  state.moveDayOpen = false;
}

function selectCategoryBtn(cat) {
  state.selectedCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.cat-btn[data-cat="${cat}"]`)?.classList.add('active');
}

function saveTask() {
  const name = document.getElementById('taskName').value.trim();
  if (!name) {
    document.getElementById('taskName').focus();
    document.getElementById('taskName').style.borderColor = '#ff6b6b';
    setTimeout(() => document.getElementById('taskName').style.borderColor = '', 1000);
    return;
  }

  const timeStart = document.getElementById('taskTimeStart').value || '00:00';
  const timeEnd = document.getElementById('taskTimeEnd').value || '';
  const notes = document.getElementById('taskNotes').value.trim();
  const category = state.selectedCategory;

  if (state.editingTaskId) {
    // Check if moving day
    const moveDate = document.getElementById('moveToDate').value;
    let sourceKey = state.selectedDate;

    if (state.moveDayOpen && moveDate && moveDate !== sourceKey) {
      // Move to new date
      const srcTasks = state.tasks[sourceKey] || [];
      const taskIdx = srcTasks.findIndex(t => t.id === state.editingTaskId);
      if (taskIdx > -1) {
        const [task] = srcTasks.splice(taskIdx, 1);
        task.name = name; task.timeStart = timeStart; task.timeEnd = timeEnd;
        task.notes = notes; task.category = category;
        if (!state.tasks[moveDate]) state.tasks[moveDate] = [];
        state.tasks[moveDate].push(task);
        state.selectedDate = moveDate;
        // Update month/year if needed
        const nd = parseKey(moveDate);
        state.currentYear = nd.getFullYear();
        state.currentMonth = nd.getMonth();
      }
    } else {
      const tasks = state.tasks[state.selectedDate] || [];
      const task = tasks.find(t => t.id === state.editingTaskId);
      if (task) {
        task.name = name; task.timeStart = timeStart; task.timeEnd = timeEnd;
        task.notes = notes; task.category = category;
      }
    }
  } else {
    const key = state.selectedDate;
    if (!state.tasks[key]) state.tasks[key] = [];
    state.tasks[key].push({ id: uid(), name, timeStart, timeEnd, notes, category, completed: false });
  }

  saveState();
  closeModal();
  renderCalendar();
  renderDayPanel();
  updateStreaks();
}

// ── Streaks ───────────────────────────────────────────────────
function updateStreaks() {
  const cats = ['study','fitness','streaming','personal'];
  const today = new Date(); today.setHours(0,0,0,0);

  cats.forEach(cat => {
    let streak = 0;
    let checking = new Date(today);
    for (let i = 0; i < 365; i++) {
      const k = keyFromDate(checking);
      const tasks = state.tasks[k] || [];
      const catTasks = tasks.filter(t => t.category === cat);
      const done = catTasks.filter(t => t.completed);
      if (catTasks.length > 0 && done.length > 0) {
        streak++;
      } else if (i > 0) {
        break; // streak broken
      }
      checking.setDate(checking.getDate() - 1);
    }
    state.streaks[cat] = streak;
    const el = document.getElementById(`streak${cat.charAt(0).toUpperCase()+cat.slice(1)}`);
    if (el) {
      animateCount(el, parseInt(el.textContent || '0'), streak);
    }
  });

  saveState();
}

function animateCount(el, from, to) {
  if (from === to) return;
  const diff = to - from;
  const steps = 20;
  let step = 0;
  const iv = setInterval(() => {
    step++;
    el.textContent = Math.round(from + (diff * step / steps));
    if (step >= steps) { el.textContent = to; clearInterval(iv); }
  }, 25);
}

// ── Drag & Drop ───────────────────────────────────────────────
let dragSrcId = null;
let dragOverId = null;

function initDragDrop(dateKey) {
  const items = document.querySelectorAll('.task-item');
  items.forEach(item => {
    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragover', onDragOver);
    item.addEventListener('dragleave', onDragLeave);
    item.addEventListener('drop', e => onDrop(e, dateKey));
    item.addEventListener('dragend', onDragEnd);
  });
}

function onDragStart(e) {
  dragSrcId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcId);

  // Ghost
  const ghost = document.getElementById('dragGhost');
  ghost.style.display = 'block';
  ghost.style.width = e.currentTarget.offsetWidth + 'px';
  ghost.innerHTML = e.currentTarget.innerHTML;
  ghost.className = 'drag-ghost ' + e.currentTarget.className.replace(' dragging','');
  ghost.style.background = 'var(--bg-card)';
  ghost.style.border = '1px solid var(--border-strong)';
  ghost.style.padding = '14px 16px';
  ghost.style.borderRadius = '10px';
  ghost.style.color = 'var(--text-primary)';
  ghost.style.pointerEvents = 'none';
  ghost.style.position = 'fixed';
  ghost.style.top = '-200px';
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 20, 20);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const tgt = e.currentTarget;
  if (tgt.dataset.id !== dragSrcId) {
    document.querySelectorAll('.task-item').forEach(i => i.classList.remove('drag-over'));
    tgt.classList.add('drag-over');
    dragOverId = tgt.dataset.id;
  }
}
function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function onDrop(e, dateKey) {
  e.preventDefault();
  if (!dragSrcId || !dragOverId || dragSrcId === dragOverId) return;

  const tasks = state.tasks[dateKey] || [];
  const srcIdx = tasks.findIndex(t => t.id === dragSrcId);
  const tgtIdx = tasks.findIndex(t => t.id === dragOverId);
  if (srcIdx < 0 || tgtIdx < 0) return;

  const [moved] = tasks.splice(srcIdx, 1);
  tasks.splice(tgtIdx, 0, moved);
  state.tasks[dateKey] = tasks;
  saveState();
  renderDayPanel();
}
function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.task-item').forEach(i => i.classList.remove('drag-over'));
  document.getElementById('dragGhost').style.display = 'none';
  dragSrcId = null; dragOverId = null;
}

// ── Theme ─────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('dayflow_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn(saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('dayflow_theme', next);
  updateThemeBtn(next);
}
function updateThemeBtn(theme) {
  document.getElementById('themeIcon').className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  document.getElementById('themeLabel').textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
}

// ── Sidebar mobile ────────────────────────────────────────────
function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.add('open');
  getOrCreateOverlay().style.display = 'block';
}
function closeSidebarFn() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.remove('open');
  getOrCreateOverlay().style.display = 'none';
}
function getOrCreateOverlay() {
  let ov = document.querySelector('.sidebar-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'sidebar-overlay';
    document.body.appendChild(ov);
    ov.addEventListener('click', closeSidebarFn);
  }
  return ov;
}

// ── Seed demo tasks ───────────────────────────────────────────
function seedDemoTasks() {
  const key = todayKey();
  if (state.tasks[key] && state.tasks[key].length > 0) return;

  state.tasks[key] = [
    { id: uid(), name: 'Wake up & Morning routine', timeStart: '06:00', timeEnd: '06:30', category: 'personal', notes: 'Brush, shower, hydrate', completed: true },
    { id: uid(), name: 'Workout – Push Day', timeStart: '06:30', timeEnd: '07:30', category: 'fitness', notes: 'Chest, shoulders, triceps', completed: true },
    { id: uid(), name: 'Study Physics', timeStart: '08:00', timeEnd: '10:00', category: 'study', notes: 'Chapter 7 — Electromagnetism', completed: false },
    { id: uid(), name: 'Study Math – Problem Sets', timeStart: '10:30', timeEnd: '12:30', category: 'study', notes: '', completed: false },
    { id: uid(), name: 'Live Stream Session', timeStart: '20:00', timeEnd: '22:00', category: 'streaming', notes: 'Gaming + Q&A', completed: false },
    { id: uid(), name: 'Evening walk', timeStart: '18:30', timeEnd: '19:00', category: 'fitness', notes: '', completed: false },
    { id: uid(), name: 'Call girlfriend', timeStart: '22:30', timeEnd: '23:00', category: 'personal', notes: '💕', completed: false },
  ];
  saveState();
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  loadState();
  injectGradient();
  initTheme();

  const now = new Date();
  state.currentYear = now.getFullYear();
  state.currentMonth = now.getMonth();
  state.selectedDate = todayKey();

  seedDemoTasks();
  renderCalendar();
  renderDayPanel();
  updateStreaks();

  // Navigation
  document.getElementById('prevMonth').addEventListener('click', () => {
    state.currentMonth--;
    if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
    renderCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    state.currentMonth++;
    if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
    renderCalendar();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    const n = new Date();
    state.currentYear = n.getFullYear();
    state.currentMonth = n.getMonth();
    state.selectedDate = todayKey();
    renderCalendar();
    renderDayPanel();
  });

  // Sidebar
  document.getElementById('menuBtn').addEventListener('click', openSidebar);
  document.getElementById('sidebarClose').addEventListener('click', closeSidebarFn);

  // Theme
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Add task
  document.getElementById('addTaskBtn').addEventListener('click', openAddModal);

  // Modal controls
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveTaskBtn').addEventListener('click', saveTask);

  // Category buttons
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => selectCategoryBtn(btn.dataset.cat));
  });

  // Move task
  document.getElementById('moveTaskBtn').addEventListener('click', () => {
    state.moveDayOpen = !state.moveDayOpen;
    const grp = document.getElementById('moveDayGroup');
    grp.style.display = state.moveDayOpen ? 'flex' : 'none';
  });

  // Modal overlay click to close
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Enter key in task name
  document.getElementById('taskName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveTask();
    if (e.key === 'Escape') closeModal();
  });

  // Keyboard shortcut: N to add task
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'n' || e.key === 'N') openAddModal();
    if (e.key === 'Escape') closeModal();
  });
}

document.addEventListener('DOMContentLoaded', init);
