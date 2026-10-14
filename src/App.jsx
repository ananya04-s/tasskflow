import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "taskflow-pro-v2";
const THEME_KEY = "taskflow-pro-theme";
const API_URL = "https://jsonplaceholder.typicode.com/todos?_limit=8";

const seedTasks = [
  { id: "t1", title: "Complete frontend interview preparation", description: "Review HTML, CSS, JavaScript, React and REST APIs.", category: "Career", priority: "High", due: "2026-10-15", status: "in-progress", createdAt: "2026-10-12T09:00:00.000Z" },
  { id: "t2", title: "Build a responsive portfolio homepage", description: "Create a polished portfolio landing page for job applications.", category: "Development", priority: "High", due: "2026-10-16", status: "todo", createdAt: "2026-10-12T10:00:00.000Z" },
  { id: "t3", title: "Practise JavaScript array methods", description: "Work through map, filter, reduce, find and some/every.", category: "Learning", priority: "Medium", due: "2026-10-15", status: "done", createdAt: "2026-10-11T10:00:00.000Z" },
  { id: "t4", title: "Review React hooks and components", description: "Explain useState, useEffect, props and component composition.", category: "Learning", priority: "Medium", due: "2026-10-17", status: "in-progress", createdAt: "2026-10-13T10:00:00.000Z" },
  { id: "t5", title: "Update project documentation", description: "Write setup instructions and describe the project architecture.", category: "Career", priority: "Low", due: "2026-10-19", status: "todo", createdAt: "2026-10-13T11:00:00.000Z" },
];

const filters = ["All tasks", "To do", "In progress", "Completed", "High priority"];
const columns = [
  { id: "todo", title: "To do", hint: "Ready when you are" },
  { id: "in-progress", title: "In progress", hint: "Work in motion" },
  { id: "done", title: "Done", hint: "Look at you go" },
];
const blankForm = { title: "", description: "", category: "Development", priority: "Medium", due: "", status: "todo" };

function safeReadTasks() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return seedTasks;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : seedTasks;
  } catch {
    return seedTasks;
  }
}

function formatDate(date) {
  if (!date) return "No due date";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(status) {
  return status === "done" ? "Completed" : status === "in-progress" ? "In progress" : "To do";
}

function App() {
  const [tasks, setTasks] = useState(safeReadTasks);
  const [page, setPage] = useState("Dashboard");
  const [filter, setFilter] = useState("All tasks");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [apiState, setApiState] = useState("idle");
  const [apiMessage, setApiMessage] = useState("");
  const [lastSaved, setLastSaved] = useState("Saved locally");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    setLastSaved("Saved locally");
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const completedCount = tasks.filter(t => t.status === "done").length;
  const pendingCount = tasks.length - completedCount;
  const progress = tasks.length ? Math.round(completedCount / tasks.length * 100) : 0;
  const highPriorityCount = tasks.filter(t => t.priority === "High" && t.status !== "done").length;

  const visibleTasks = useMemo(() => tasks.filter(task => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [task.title, task.description, task.category].some(value => (value || "").toLowerCase().includes(q));
    const matchesFilter =
      filter === "All tasks" ||
      (filter === "To do" && task.status === "todo") ||
      (filter === "In progress" && task.status === "in-progress") ||
      (filter === "Completed" && task.status === "done") ||
      (filter === "High priority" && task.priority === "High" && task.status !== "done");
    return matchesSearch && matchesFilter;
  }), [tasks, search, filter]);

  const weeklyStats = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      const count = tasks.filter(t => t.status === "done" && (t.completedAt || t.createdAt || "").slice(0, 10) === key).length;
      return { label: day.toLocaleDateString(undefined, { weekday: "short" }), count };
    });
  }, [tasks]);
  const maxWeekly = Math.max(1, ...weeklyStats.map(d => d.count));

  const notify = useCallback(message => setToast(message), []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...blankForm, due: new Date().toISOString().slice(0, 10) });
    setFormOpen(true);
  }

  function openEdit(task) {
    setEditingId(task.id);
    setForm({
      title: task.title || "",
      description: task.description || "",
      category: task.category || "Development",
      priority: task.priority || "Medium",
      due: task.due || "",
      status: task.status || "todo",
    });
    setFormOpen(true);
  }

  function saveTask(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      notify("Please add a task title.");
      return;
    }
    if (editingId) {
      setTasks(previous => previous.map(task => task.id === editingId
        ? { ...task, ...form, title: form.title.trim(), updatedAt: new Date().toISOString(), completedAt: form.status === "done" ? (task.completedAt || new Date().toISOString()) : "" }
        : task));
      notify("Task updated successfully.");
    } else {
      setTasks(previous => [{
        ...form,
        title: form.title.trim(),
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        createdAt: new Date().toISOString(),
        completedAt: form.status === "done" ? new Date().toISOString() : "",
      }, ...previous]);
      notify("Task created successfully.");
    }
    setFormOpen(false);
    setEditingId(null);
    setForm(blankForm);
  }

  function updateStatus(id, status) {
    setTasks(previous => previous.map(task => task.id === id
      ? { ...task, status, completedAt: status === "done" ? (task.completedAt || new Date().toISOString()) : "" }
      : task));
    notify(`Task moved to ${statusLabel(status).toLowerCase()}.`);
  }

  function deleteTask(id) {
    setTasks(previous => previous.filter(task => task.id !== id));
    setConfirmDelete(null);
    notify("Task deleted.");
  }

  async function importFromApi() {
    setApiState("loading");
    setApiMessage("");
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      const imported = data.map((item, index) => ({
        id: `api-${item.id}-${Date.now()}-${index}`,
        title: item.title.charAt(0).toUpperCase() + item.title.slice(1),
        description: "Imported from JSONPlaceholder demo REST API.",
        category: "API import",
        priority: item.id % 3 === 0 ? "High" : item.id % 2 === 0 ? "Medium" : "Low",
        due: "",
        status: item.completed ? "done" : "todo",
        createdAt: new Date().toISOString(),
        apiSourceId: item.id,
      }));
      setTasks(previous => [...imported, ...previous]);
      setApiState("success");
      setApiMessage(`Imported ${imported.length} sample tasks.`);
      notify("Sample tasks imported from the REST API.");
    } catch (error) {
      setApiState("error");
      setApiMessage(`Could not reach the API. ${error.message}. Check your internet connection and retry.`);
    }
  }

  async function syncToApi() {
    setApiState("loading");
    setApiMessage("");
    try {
      const response = await fetch("https://jsonplaceholder.typicode.com/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          title: "TaskFlow sync test",
          completed: completedCount === tasks.length && tasks.length > 0,
          userId: 1,
        }),
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const result = await response.json();
      setApiState("success");
      setApiMessage(`API accepted a demo POST (response ID: ${result.id}). JSONPlaceholder does not permanently store changes.`);
      notify("Demo API POST completed.");
    } catch (error) {
      setApiState("error");
      setApiMessage(`API request failed: ${error.message}. Your local tasks are still safe.`);
    }
  }

  function handleDrop(event, status) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/taskflow-id") || draggingId;
    if (id) updateStatus(id, status);
    setDraggingId(null);
  }

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      const typing = target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector("#task-search")?.focus();
      } else if (!typing && event.key.toLowerCase() === "n") {
        event.preventDefault();
        openCreate();
      } else if (!typing && event.key === "Escape") {
        setFormOpen(false);
        setConfirmDelete(null);
      } else if (!typing && event.key.toLowerCase() === "d") {
        setTheme(current => current === "light" ? "dark" : "light");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navItems = [
    { label: "Dashboard", icon: "◫" },
    { label: "My Tasks", icon: "☷" },
    { label: "Kanban", icon: "▥" },
    { label: "Calendar", icon: "▦" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={e => { e.preventDefault(); setPage("Dashboard"); }}>
          <span className="brand-mark">✳</span><span>taskflow<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-picker"><span className="workspace-avatar">A</span><span><strong>Personal space</strong><small>Free workspace</small></span><span className="picker-chevron">⌄</span></div>
        <p className="side-label">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(item => <button key={item.label} className={`nav-link ${page === item.label ? "active" : ""}`} onClick={() => setPage(item.label)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.label === "My Tasks" && <span className="nav-count">{tasks.length}</span>}</button>)}
        </nav>
        <p className="side-label">QUICK FILTERS</p>
        <div className="quick-filters">
          <button onClick={() => { setPage("My Tasks"); setFilter("High priority"); }}><i className="dot red" />High priority <span>{highPriorityCount}</span></button>
          <button onClick={() => { setPage("My Tasks"); setFilter("Completed"); }}><i className="dot green" />Completed <span>{completedCount}</span></button>
        </div>
        <div className="sidebar-bottom">
          <div className="keyboard-card"><div className="keyboard-symbol">⌘</div><strong>Work smarter</strong><p>Press <kbd>N</kbd> to create a task, <kbd>D</kbd> to switch theme.</p></div>
          <div className="sidebar-user"><div className="user-avatar">A</div><div><strong>Personal workspace</strong><small>Frontend learner</small></div><button title="Toggle theme" onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>•••</button></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <span>/</span> <strong>{page}</strong></div>
          <div className="top-actions"><span className="saved-indicator"><i />{lastSaved}</span><button className="theme-toggle" onClick={() => setTheme(t => t === "light" ? "dark" : "light")} aria-label="Toggle dark mode" title="Toggle dark mode">{theme === "light" ? "☾" : "☀"}<span>{theme === "light" ? "Dark mode" : "Light mode"}</span></button><button className="avatar-button" title="Workspace profile">A</button></div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div><div className="eyebrow"><i />YOUR PERSONAL WORKSPACE</div><h1>{page === "Dashboard" ? <>Make room for <span>great work.</span></> : page === "My Tasks" ? <>Your tasks, <span>your pace.</span></> : page === "Kanban" ? <>See work <span>in motion.</span></> : <>Plan your <span>next move.</span></>}</h1><p className="page-subtitle">{page === "Dashboard" ? "A little progress every day adds up to big results." : page === "My Tasks" ? "Search, edit and organize every task in one place." : page === "Kanban" ? "Drag tasks between columns to update their status." : "See your deadlines and plan the week ahead."}</p></div>
            <button className="primary-button" onClick={openCreate}><span>＋</span> New task <kbd>N</kbd></button>
          </section>

          {page === "Dashboard" && <>
            <section className="stats-grid">
              <article className="stat-card"><div className="stat-head">Total tasks <span className="stat-icon lavender">▦</span></div><div className="stat-number">{tasks.length}<small> tasks</small></div><div className="stat-foot"><i className="dot purple-dot" />Your complete workload</div></article>
              <article className="stat-card"><div className="stat-head">In progress <span className="stat-icon blue">◷</span></div><div className="stat-number">{tasks.filter(t => t.status === "in-progress").length + tasks.filter(t => t.status === "todo").length}<small> tasks</small></div><div className="stat-foot"><i className="dot blue-dot" />Keep the momentum going</div></article>
              <article className="stat-card"><div className="stat-head">Completed <span className="stat-icon green">✓</span></div><div className="stat-number">{completedCount}<small> tasks</small></div><div className="stat-foot"><i className="dot green-dot" />Every win counts</div></article>
              <article className="stat-card"><div className="stat-head">Overall progress <span className="stat-icon orange">↗</span></div><div className="stat-number">{progress}<small>%</small></div><div className="progress-track"><div style={{ width: `${progress}%` }} /></div><div className="stat-foot">Completion rate</div></article>
            </section>

            <section className="dashboard-grid">
              <article className="panel analytics-panel"><div className="panel-title-row"><div><h2>Weekly productivity</h2><p>Completed tasks over the last 7 days</p></div><span className="chart-chip">Last 7 days</span></div><div className="chart-area"><div className="chart-y-labels"><span>{maxWeekly}</span><span>{Math.ceil(maxWeekly / 2)}</span><span>0</span></div><div className="bar-chart">{weeklyStats.map(day => <div className="bar-column" key={day.label}><div className="bar-space"><div className="bar-tooltip">{day.count} completed</div><div className="chart-bar" style={{ height: `${Math.max(5, day.count / maxWeekly * 100)}%` }} /></div><span>{day.label}</span></div>)}</div></div></article>
              <article className="panel breakdown-panel"><div className="panel-title-row"><div><h2>Task breakdown</h2><p>Current status distribution</p></div><span className="donut-icon">◔</span></div><div className="donut-wrap"><div className="donut" style={{ "--done": `${progress}%` }}><div><strong>{tasks.length}</strong><span>Total tasks</span></div></div></div><div className="legend"><span><i className="dot green" />Completed <strong>{completedCount}</strong></span><span><i className="dot purple" />Pending <strong>{pendingCount}</strong></span></div></article>
            </section>
            <TaskPanel tasks={visibleTasks.slice(0, 5)} onEdit={openEdit} onDelete={setConfirmDelete} onStatus={updateStatus} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} compact onViewAll={() => setPage("My Tasks")} />
          </>}

          {page === "My Tasks" && <TaskPanel tasks={visibleTasks} onEdit={openEdit} onDelete={setConfirmDelete} onStatus={updateStatus} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} />}
          {page === "Kanban" && <section className="kanban-board">{columns.map(column => {
            const columnTasks = visibleTasks.filter(task => task.status === column.id);
            return <div className={`kanban-column column-${column.id}`} key={column.id} onDragOver={event => event.preventDefault()} onDrop={event => handleDrop(event, column.id)}><div className="kanban-column-head"><div><span className={`column-marker marker-${column.id}`} /><strong>{column.title}</strong><span className="column-count">{columnTasks.length}</span></div><small>{column.hint}</small></div><div className="kanban-cards">{columnTasks.map(task => <article key={task.id} className={`kanban-card ${draggingId === task.id ? "dragging" : ""}`} draggable onDragStart={event => { setDraggingId(task.id); event.dataTransfer.setData("text/taskflow-id", task.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDraggingId(null)}><div className="kanban-card-top"><span className={`priority-badge ${task.priority.toLowerCase()}`}>{task.priority}</span><button className="tiny-action" onClick={() => openEdit(task)} title="Edit task">···</button></div><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}<div className="kanban-card-meta"><span className="category-pill">{task.category}</span><span>{formatDate(task.due)}</span></div><div className="kanban-card-actions"><button onClick={() => openEdit(task)}>Edit</button><select aria-label={`Move ${task.title}`} value={task.status} onChange={event => updateStatus(task.id, event.target.value)}>{columns.map(c => <option key={c.id} value={c.id}>Move to {c.title}</option>)}</select></div></article>)}</div><button className="add-to-column" onClick={() => { setForm({ ...blankForm, status: column.id, due: "" }); setEditingId(null); setFormOpen(true); }}>＋ Add a task</button></div>;
          })}</section>}

          {page === "Calendar" && <CalendarView tasks={tasks} onEdit={openEdit} onCreate={date => { setForm({ ...blankForm, due: date }); setEditingId(null); setFormOpen(true); }} />}

          <footer className="page-footer"><span><b>✳ taskflow.</b> Built for focused work.</span><span>React · Vite · Local storage · REST API demo</span></footer>
        </div>
      </main>

      {formOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setFormOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title"><div className="modal-heading"><div><span className="modal-kicker">{editingId ? "TASK DETAILS" : "NEW TASK"}</span><h2 id="task-modal-title">{editingId ? "Edit task" : "Create a task"}</h2><p>Make the next step clear and actionable.</p></div><button className="close-modal" onClick={() => setFormOpen(false)} aria-label="Close">×</button></div><form onSubmit={saveTask} className="task-form"><label className="field full">Task title<input autoFocus required maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What needs to get done?" /></label><label className="field full">Description<textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Add context, notes or acceptance criteria..." /></label><label className="field">Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option>Development</option><option>Learning</option><option>Career</option><option>Personal</option><option>API import</option></select></label><label className="field">Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label><label className="field">Due date<input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} /></label><label className="field">Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel <kbd>Esc</kbd></button><button className="primary-button" type="submit">{editingId ? "Save changes" : "Create task"} ↗</button></div></form></section></div>}

      {confirmDelete && <div className="modal-backdrop"><section className="confirm-modal" role="alertdialog" aria-modal="true"><div className="confirm-icon">!</div><h2>Delete this task?</h2><p>This action removes the task from your local TaskFlow list. You can't undo it.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setConfirmDelete(null)}>Keep task</button><button className="danger-button" onClick={() => deleteTask(confirmDelete)}>Delete task</button></div></section></div>}

      <div className="api-dock"><div className="api-dock-copy"><span className={`api-status ${apiState}`} /><div><strong>REST API playground</strong><small>{apiMessage || "Try a GET import or POST request using JSONPlaceholder."}</small></div></div><div className="api-dock-actions"><button className="secondary-button" disabled={apiState === "loading"} onClick={importFromApi}>{apiState === "loading" ? "Loading…" : "GET import"}</button><button className="primary-button" disabled={apiState === "loading"} onClick={syncToApi}>POST test</button></div></div>

      {toast && <div className="toast" role="status"><span>✓</span>{toast}<button onClick={() => setToast("")} aria-label="Dismiss notification">×</button></div>}
    </div>
  );
}

function TaskPanel({ tasks, onEdit, onDelete, onStatus, search, setSearch, filter, setFilter, compact = false, onViewAll }) {
  return <section className="panel task-panel"><div className="panel-title-row"><div><h2>{compact ? "Your tasks" : "My tasks"} <span className="title-count">{tasks.length}</span></h2><p>{compact ? "A quick look at what's on your plate." : "Search, edit and update your tasks."}</p></div>{compact && <button className="secondary-button" onClick={onViewAll}>View all tasks ↗</button>}</div><div className="task-toolbar"><label className="search-box"><span>⌕</span><input id="task-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, category or notes..." /><kbd>Ctrl K</kbd></label><select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter tasks">{filters.map(item => <option key={item}>{item}</option>)}</select></div><div className="task-table-head"><span>TASK</span><span>PRIORITY</span><span>DUE DATE</span><span>STATUS</span><span>ACTIONS</span></div>{tasks.length ? <div>{tasks.map(task => <article className="task-row" key={task.id}><div className="task-main-cell"><span className={`task-category-icon ${task.category === "Career" ? "cat-career" : task.category === "Learning" ? "cat-learning" : "cat-dev"}`}>{task.category === "Career" ? "↗" : task.category === "Learning" ? "✧" : "⌘"}</span><div className="task-name-block"><strong className={task.status === "done" ? "done-text" : ""}>{task.title}</strong><small>{task.category}{task.description ? ` · ${task.description}` : ""}</small></div></div><div><span className={`priority-badge ${task.priority.toLowerCase()}`}><i />{task.priority}</span></div><div className="due-cell">{formatDate(task.due)}</div><div><select className={`status-select status-${task.status}`} value={task.status} onChange={e => onStatus(task.id, e.target.value)} aria-label={`Change status for ${task.title}`}><option value="todo">To do</option><option value="in-progress">In progress</option><option value="done">Completed</option></select></div><div className="row-actions"><button onClick={() => onEdit(task)} title="Edit task" aria-label={`Edit ${task.title}`}>✎</button><button onClick={() => onDelete(task.id)} title="Delete task" aria-label={`Delete ${task.title}`}>×</button></div></article>)}</div> : <div className="empty-state"><div>⌕</div><h3>No tasks found</h3><p>Try changing your search or filter, or create a task.</p></div>}<div className="table-footer"><span>Showing {tasks.length} task{tasks.length === 1 ? "" : "s"}</span><span><i className="dot green" /> Saved automatically in this browser</span></div></section>;
}

function CalendarView({ tasks, onEdit, onCreate }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = new Date();
  const dateKey = day => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return <section className="panel calendar-panel"><div className="calendar-toolbar"><div><h2>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><p>Select a day to add a task. Click a task to edit it.</p></div><div className="calendar-nav"><button className="secondary-button" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>←</button><button className="secondary-button" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button><button className="secondary-button" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>→</button></div></div><div className="calendar-grid">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}{cells.map((day, index) => { const key = day ? dateKey(day) : ""; const dayTasks = tasks.filter(task => task.due === key); const isToday = day && year === today.getFullYear() && monthIndex === today.getMonth() && day === today.getDate(); return <div key={`${key}-${index}`} className={`calendar-day ${day ? "" : "outside"} ${isToday ? "today" : ""}`} onDoubleClick={() => day && onCreate(key)}>{day && <button className="day-number" onClick={() => onCreate(key)} title="Add task on this day">{day}</button>}{dayTasks.map(task => <button key={task.id} className={`calendar-task ${task.status === "done" ? "calendar-done" : ""}`} onClick={() => onEdit(task)} title={`${task.title} — click to edit`}>{task.title}</button>)}</div>; })}</div><p className="calendar-tip">Tip: click a date number to create a task for that day.</p></section>;
}

export default App;
