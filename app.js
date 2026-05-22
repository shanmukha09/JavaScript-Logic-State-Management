/**
 * State-driven To-Do List with CRUD, filtering, and localStorage persistence.
 */

const STORAGE_KEY = "todo-app-tasks";

/** @type {{ id: string, text: string, completed: boolean }[]} */
let tasks = [];

/** @type {'all' | 'active' | 'completed'} */
let currentFilter = "all";

/** @type {string | null} */
let editingTaskId = null;

// DOM references
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const clearCompletedBtn = document.getElementById("clear-completed");
const filtersContainer = document.querySelector(".filters");
const itemTemplate = document.getElementById("task-item-template");

// --- Persistence (Read / auto-save on every state change) ---

function loadTasks() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t) =>
        t &&
        typeof t.id === "string" &&
        typeof t.text === "string" &&
        typeof t.completed === "boolean"
    );
  } catch {
    return [];
  }
}

function saveTasks() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// --- CRUD operations ---

function createTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const task = {
    id: crypto.randomUUID(),
    text: trimmed,
    completed: false,
  };
  tasks.push(task);
  persistAndRender();
  return task;
}

function updateTask(id, updates) {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;

  tasks[index] = { ...tasks[index], ...updates };
  persistAndRender();
  return true;
}

function deleteTask(id) {
  const before = tasks.length;
  tasks = tasks.filter((t) => t.id !== id);
  if (tasks.length === before) return false;
  if (editingTaskId === id) editingTaskId = null;
  persistAndRender();
  return true;
}

function clearCompletedTasks() {
  const hadCompleted = tasks.some((t) => t.completed);
  tasks = tasks.filter((t) => !t.completed);
  if (hadCompleted) persistAndRender();
}

// --- Filtering ---

function getFilteredTasks() {
  switch (currentFilter) {
    case "active":
      return tasks.filter((t) => !t.completed);
    case "completed":
      return tasks.filter((t) => t.completed);
    default:
      return tasks;
  }
}

function setFilter(filter) {
  currentFilter = filter;
  updateFilterButtons();
  renderTaskList();
}

function updateFilterButtons() {
  filtersContainer.querySelectorAll(".filters__btn").forEach((btn) => {
    const isActive = btn.dataset.filter === currentFilter;
    btn.classList.toggle("filters__btn--active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });
}

// --- Rendering (dynamic DOM) ---

function persistAndRender() {
  saveTasks();
  render();
}

function render() {
  renderTaskList();
  renderFooter();
  renderClearButton();
}

function renderTaskList() {
  const filtered = getFilteredTasks();
  taskList.replaceChildren();

  const showEmptyMessage =
    tasks.length > 0 && filtered.length === 0;
  taskList.classList.toggle(
    "task-list--filtered-empty",
    showEmptyMessage
  );

  const fragment = document.createDocumentFragment();

  for (const task of filtered) {
    fragment.appendChild(buildTaskElement(task));
  }

  taskList.appendChild(fragment);
}

function buildTaskElement(task) {
  const clone = itemTemplate.content.cloneNode(true);
  const li = clone.querySelector(".task-item");
  const checkbox = clone.querySelector(".task-item__checkbox");
  const textEl = clone.querySelector(".task-item__text");
  const editInput = clone.querySelector(".task-item__edit");

  li.dataset.id = task.id;
  li.classList.toggle("task-item--completed", task.completed);
  li.classList.toggle("task-item--editing", editingTaskId === task.id);

  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `Mark "${task.text}" as ${task.completed ? "incomplete" : "complete"}`);

  textEl.textContent = task.text;
  editInput.value = task.text;

  return li;
}

function renderFooter() {
  const activeCount = tasks.filter((t) => !t.completed).length;
  const label = activeCount === 1 ? "item" : "items";
  taskCount.textContent = `${activeCount} ${label} left`;
}

function renderClearButton() {
  const hasCompleted = tasks.some((t) => t.completed);
  clearCompletedBtn.hidden = !hasCompleted;
}

// --- Edit mode ---

function startEditing(id) {
  editingTaskId = id;
  renderTaskList();
  const editInput = taskList.querySelector(
    `.task-item[data-id="${id}"] .task-item__edit`
  );
  if (editInput) {
    editInput.hidden = false;
    editInput.focus();
    editInput.select();
  }
}

function commitEdit(id, newText) {
  const trimmed = newText.trim();
  if (!trimmed) {
    deleteTask(id);
  } else {
    updateTask(id, { text: trimmed });
  }
  editingTaskId = null;
}

function cancelEdit() {
  editingTaskId = null;
  renderTaskList();
}

// --- Delegated event listeners ---

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  createTask(taskInput.value);
  taskInput.value = "";
  taskInput.focus();
});

filtersContainer.addEventListener("click", (e) => {
  const btn = e.target.closest(".filters__btn");
  if (!btn) return;
  setFilter(btn.dataset.filter);
});

clearCompletedBtn.addEventListener("click", clearCompletedTasks);

taskList.addEventListener("click", (e) => {
  const li = e.target.closest(".task-item");
  if (!li) return;
  const id = li.dataset.id;

  if (e.target.closest(".task-item__btn--delete")) {
    deleteTask(id);
    return;
  }

  if (e.target.closest(".task-item__btn--edit")) {
    startEditing(id);
    return;
  }

  if (e.target.closest(".task-item__check")) {
    const task = tasks.find((t) => t.id === id);
    if (task) updateTask(id, { completed: !task.completed });
    return;
  }

  if (
    e.target.classList.contains("task-item__text") &&
    editingTaskId !== id
  ) {
    startEditing(id);
  }
});

taskList.addEventListener("change", (e) => {
  if (!e.target.classList.contains("task-item__checkbox")) return;
  const li = e.target.closest(".task-item");
  if (!li) return;
  updateTask(li.dataset.id, { completed: e.target.checked });
});

taskList.addEventListener("keydown", (e) => {
  const editInput = e.target.closest(".task-item__edit");
  if (!editInput) {
    if (
      e.target.classList.contains("task-item__text") &&
      (e.key === "Enter" || e.key === " ")
    ) {
      e.preventDefault();
      const li = e.target.closest(".task-item");
      if (li) startEditing(li.dataset.id);
    }
    return;
  }

  const li = editInput.closest(".task-item");
  const id = li?.dataset.id;
  if (!id) return;

  if (e.key === "Enter") {
    e.preventDefault();
    commitEdit(id, editInput.value);
  } else if (e.key === "Escape") {
    e.preventDefault();
    cancelEdit();
  }
});

taskList.addEventListener("focusout", (e) => {
  const editInput = e.target.closest(".task-item__edit");
  if (!editInput) return;
  const li = editInput.closest(".task-item");
  if (!li || li.dataset.id !== editingTaskId) return;
  commitEdit(li.dataset.id, editInput.value);
});

// --- Initialize ---

function init() {
  tasks = loadTasks();
  updateFilterButtons();
  render();
  taskInput.focus();
}

init();
