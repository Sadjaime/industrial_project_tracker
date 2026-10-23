"use strict";

const API_ROOT = "/api";

const PROJECT_STATUS_LABELS = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

const TASK_STATUS_LABELS = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
};

const PRIORITY_LABELS = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
};

const state = {
  projects: [],
  tasks: [],
  detailTasks: [],
  selectedProjectId: null,
  filters: { status: "", priority: "" },
  hasLoaded: false,
  loading: { global: false, detail: false },
  refreshToken: 0,
  detailToken: 0,
};

const dom = {};
let confirmResolver = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
  Object.assign(dom, {
    projectCount: document.getElementById("project-count"),
    openTaskCount: document.getElementById("open-task-count"),
    completedTaskCount: document.getElementById("completed-task-count"),
    refreshButton: document.getElementById("refresh-button"),
    globalAlert: document.getElementById("global-alert"),
    globalAlertMessage: document.getElementById("global-alert-message"),
    globalAlertDismiss: document.getElementById("global-alert-dismiss"),
    projectsPanel: document.getElementById("projects-panel"),
    projectsLoading: document.getElementById("projects-loading"),
    projectsEmpty: document.getElementById("projects-empty"),
    projectList: document.getElementById("project-list"),
    newProjectButton: document.getElementById("new-project-button"),
    noProjectState: document.getElementById("no-project-state"),
    noProjectTitle: document.getElementById("no-project-title"),
    noProjectMessage: document.getElementById("no-project-message"),
    projectView: document.getElementById("project-view"),
    projectDetailName: document.getElementById("project-detail-name"),
    projectDetailStatus: document.getElementById("project-detail-status"),
    projectDetailDescription: document.getElementById("project-detail-description"),
    projectDetailCreated: document.getElementById("project-detail-created"),
    projectDetailSummary: document.getElementById("project-detail-summary"),
    editProjectButton: document.getElementById("edit-project-button"),
    deleteProjectButton: document.getElementById("delete-project-button"),
    taskCount: document.getElementById("task-count"),
    newTaskButton: document.getElementById("new-task-button"),
    taskFilters: document.getElementById("task-filters"),
    filterStatus: document.getElementById("filter-status"),
    filterPriority: document.getElementById("filter-priority"),
    clearFiltersButton: document.getElementById("clear-filters-button"),
    detailAlert: document.getElementById("detail-alert"),
    detailAlertMessage: document.getElementById("detail-alert-message"),
    tasksLoading: document.getElementById("tasks-loading"),
    tasksEmpty: document.getElementById("tasks-empty"),
    taskList: document.getElementById("task-list"),
    projectDialog: document.getElementById("project-dialog"),
    projectDialogTitle: document.getElementById("project-dialog-title"),
    projectForm: document.getElementById("project-form"),
    projectFormAlert: document.getElementById("project-form-alert"),
    projectId: document.getElementById("project-id"),
    projectName: document.getElementById("project-name"),
    projectDescription: document.getElementById("project-description"),
    projectStatus: document.getElementById("project-status"),
    projectSubmitButton: document.getElementById("project-submit-button"),
    taskDialog: document.getElementById("task-dialog"),
    taskDialogTitle: document.getElementById("task-dialog-title"),
    taskDialogProject: document.getElementById("task-dialog-project"),
    taskForm: document.getElementById("task-form"),
    taskFormAlert: document.getElementById("task-form-alert"),
    taskId: document.getElementById("task-id"),
    taskTitle: document.getElementById("task-title"),
    taskDescription: document.getElementById("task-description"),
    taskStatus: document.getElementById("task-status"),
    taskPriority: document.getElementById("task-priority"),
    taskDueDate: document.getElementById("task-due-date"),
    taskSubmitButton: document.getElementById("task-submit-button"),
    confirmDialog: document.getElementById("confirm-dialog"),
    confirmTitle: document.getElementById("confirm-title"),
    confirmMessage: document.getElementById("confirm-message"),
    confirmCancelButton: document.getElementById("confirm-cancel-button"),
    confirmAcceptButton: document.getElementById("confirm-accept-button"),
    toastRegion: document.getElementById("toast-region"),
  });

  dom.refreshButton.addEventListener("click", () => refreshAll());
  dom.globalAlertDismiss.addEventListener("click", clearGlobalAlert);
  dom.newProjectButton.addEventListener("click", () => openProjectDialog());
  dom.editProjectButton.addEventListener("click", () => {
    const project = getSelectedProject();
    if (project) openProjectDialog(project);
  });
  dom.deleteProjectButton.addEventListener("click", deleteSelectedProject);
  dom.newTaskButton.addEventListener("click", () => openTaskDialog());

  dom.taskFilters.addEventListener("submit", (event) => event.preventDefault());
  dom.filterStatus.addEventListener("change", handleFilterChange);
  dom.filterPriority.addEventListener("change", handleFilterChange);
  dom.clearFiltersButton.addEventListener("click", clearTaskFilters);

  dom.projectForm.addEventListener("submit", handleProjectSubmit);
  dom.taskForm.addEventListener("submit", handleTaskSubmit);
  dom.projectName.addEventListener("input", () => markInvalid(dom.projectName, false));
  dom.taskTitle.addEventListener("input", () => markInvalid(dom.taskTitle, false));

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialog = button.closest("dialog");
      if (dialog) dialog.close();
    });
  });

  for (const dialog of [dom.projectDialog, dom.taskDialog, dom.confirmDialog]) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  dom.projectDialog.addEventListener("close", () => clearFormAlert(dom.projectFormAlert));
  dom.taskDialog.addEventListener("close", () => clearFormAlert(dom.taskFormAlert));

  dom.confirmCancelButton.addEventListener("click", () => settleConfirmation(false));
  dom.confirmAcceptButton.addEventListener("click", () => settleConfirmation(true));
  dom.confirmDialog.addEventListener("close", () => {
    if (confirmResolver) {
      const resolve = confirmResolver;
      confirmResolver = null;
      resolve(false);
    }
  });

  syncFilterControls();
  refreshAll();
}

class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function api(path, options = {}) {
  const config = {
    method: options.method || "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  };

  if (options.body !== undefined) {
    config.headers["Content-Type"] = "application/json";
    config.body = options.body;
  }

  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, config);
  } catch {
    throw new ApiError(
      "Unable to reach the server. Check your connection and try again."
    );
  }

  if (response.status === 204) return null;

  const rawBody = await response.text();
  let payload = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      if (response.ok) {
        throw new ApiError(
          "The server returned an unreadable response. Please try again.",
          response.status
        );
      }
    }
  }

  if (!response.ok) {
    throw new ApiError(
      formatApiError(payload, response.status),
      response.status,
      payload
    );
  }

  return payload;
}

function formatApiError(payload, status) {
  if (payload && typeof payload.detail === "string") {
    return payload.detail;
  }

  if (payload && Array.isArray(payload.detail)) {
    const messages = payload.detail.map((item) => {
      const location = Array.isArray(item.loc)
        ? item.loc.filter((part) => part !== "body" && part !== "query").join(".")
        : "";
      const message = item.msg || "Invalid value";
      if (!location) return message;
      return `${humanizeField(location)}: ${message}`;
    });

    if (messages.length > 0) return messages.join(" ");
  }

  if (status === 404) return "The requested item could not be found.";
  if (status === 422) return "Some of the submitted values are not valid.";
  if (status >= 500) return "The server could not complete the request. Please try again.";
  return `Request failed (HTTP ${status}). Please try again.`;
}

function humanizeField(field) {
  const text = String(field).replaceAll("_", " ").replaceAll(".", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

async function refreshAll() {
  const token = ++state.refreshToken;
  state.loading.global = true;
  clearGlobalAlert();
  setGlobalLoading(true);

  try {
    const [projects, tasks] = await Promise.all([
      api("/projects"),
      api("/tasks"),
    ]);

    if (token !== state.refreshToken) return;

    state.projects = projects;
    state.tasks = tasks;
    state.hasLoaded = true;

    if (!state.projects.some((project) => project.id === state.selectedProjectId)) {
      state.selectedProjectId = null;
    }
    if (state.selectedProjectId === null && state.projects.length > 0) {
      state.selectedProjectId = state.projects[0].id;
    }

    renderStats();
    renderProjectList();

    if (state.selectedProjectId !== null) {
      await loadProjectDetail();
    } else {
      renderNoProject();
    }
  } catch (error) {
    if (token !== state.refreshToken) return;
    showGlobalAlert(error.message);

    if (!state.hasLoaded) {
      dom.projectList.replaceChildren();
      dom.projectsEmpty.textContent =
        "Projects could not be loaded. Use Refresh data to try again.";
      dom.projectsEmpty.hidden = false;
      renderNoProject();
      dom.noProjectTitle.textContent = "Project data unavailable";
      dom.noProjectMessage.textContent =
        "The backend could not be reached. Use Refresh data to try again.";
    }
  } finally {
    if (token === state.refreshToken) {
      state.loading.global = false;
      setGlobalLoading(false);
    }
  }
}

function setGlobalLoading(loading) {
  dom.refreshButton.disabled = loading;
  dom.refreshButton.textContent = loading ? "Refreshing…" : "Refresh data";
  dom.projectsLoading.hidden = !loading;
  dom.projectsPanel.setAttribute("aria-busy", String(loading));

  if (loading) {
    dom.projectsEmpty.hidden = true;
    dom.projectList.hidden = true;
  } else {
    dom.projectList.hidden = false;
  }
}

function renderStats() {
  if (!state.hasLoaded) {
    dom.projectCount.textContent = "—";
    dom.openTaskCount.textContent = "—";
    dom.completedTaskCount.textContent = "—";
    return;
  }

  const openTasks = state.tasks.filter((task) => task.status !== "completed").length;
  const completedTasks = state.tasks.filter((task) => task.status === "completed").length;

  dom.projectCount.textContent = String(state.projects.length);
  dom.openTaskCount.textContent = String(openTasks);
  dom.completedTaskCount.textContent = String(completedTasks);
}

function renderProjectList() {
  dom.projectList.replaceChildren();

  if (state.projects.length === 0) {
    dom.projectsEmpty.textContent =
      "No projects yet. Create your first project to begin.";
    dom.projectsEmpty.hidden = false;
    return;
  }

  dom.projectsEmpty.hidden = true;

  for (const project of state.projects) {
    const item = document.createElement("li");
    item.className = "project-card";
    if (project.id === state.selectedProjectId) {
      item.classList.add("is-selected");
    }

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "project-card__select";
    selectButton.setAttribute(
      "aria-pressed",
      project.id === state.selectedProjectId ? "true" : "false"
    );
    selectButton.addEventListener("click", () => selectProject(project.id));

    const heading = document.createElement("span");
    heading.className = "project-card__heading";

    const name = document.createElement("span");
    name.className = "project-card__name";
    name.textContent = project.name;

    heading.append(
      name,
      makeBadge(
        PROJECT_STATUS_LABELS[project.status] || project.status,
        statusModifier(project.status)
      )
    );
    selectButton.append(heading);

    if (project.description) {
      const description = document.createElement("span");
      description.className = "project-card__description";
      description.textContent = project.description;
      selectButton.append(description);
    }

    const projectTasks = state.tasks.filter(
      (task) => task.project_id === project.id
    );
    const openTasks = projectTasks.filter(
      (task) => task.status !== "completed"
    ).length;

    const meta = document.createElement("span");
    meta.className = "project-card__meta";
    meta.append(
      createTextSpan(formatCount(projectTasks.length, "task")),
      createTextSpan(`${openTasks} open`)
    );
    selectButton.append(meta);

    const actions = document.createElement("div");
    actions.className = "project-card__actions";

    const editButton = createSmallButton("Edit", `Edit project: ${project.name}`);
    editButton.addEventListener("click", () => openProjectDialog(project));

    const deleteButton = createSmallButton(
      "Delete",
      `Delete project: ${project.name}`,
      "btn--danger-ghost"
    );
    deleteButton.addEventListener("click", () => deleteProject(project));

    actions.append(editButton, deleteButton);
    item.append(selectButton, actions);
    dom.projectList.append(item);
  }
}

function selectProject(projectId) {
  if (state.selectedProjectId === projectId) return;
  state.selectedProjectId = projectId;
  renderProjectList();
  loadProjectDetail();
}

function getSelectedProject() {
  return (
    state.projects.find((project) => project.id === state.selectedProjectId) ||
    null
  );
}

async function loadProjectDetail() {
  const project = getSelectedProject();
  if (!project) {
    renderNoProject();
    return;
  }

  renderProjectHeader(project);
  clearDetailAlert();

  const token = ++state.detailToken;
  setDetailLoading(true);

  try {
    const params = new URLSearchParams({ project_id: String(project.id) });
    if (state.filters.status) params.set("status", state.filters.status);
    if (state.filters.priority) params.set("priority", state.filters.priority);

    const tasks = await api(`/tasks?${params.toString()}`);
    if (token !== state.detailToken) return;

    state.detailTasks = tasks;
    renderTaskList();
  } catch (error) {
    if (token !== state.detailToken) return;

    state.detailTasks = [];
    dom.taskList.replaceChildren();
    dom.taskList.hidden = true;
    dom.tasksEmpty.hidden = true;
    dom.taskCount.textContent = "";
    showDetailAlert(error.message);
  } finally {
    if (token === state.detailToken) {
      state.loading.detail = false;
      dom.tasksLoading.hidden = true;
      dom.projectView.setAttribute("aria-busy", "false");
    }
  }
}

function setDetailLoading(loading) {
  state.loading.detail = loading;
  dom.projectView.setAttribute("aria-busy", String(loading));
  dom.tasksLoading.hidden = !loading;
  dom.tasksEmpty.hidden = true;
  dom.taskList.hidden = true;
  dom.taskCount.textContent = loading ? "Loading…" : "";
}

function renderProjectHeader(project) {
  dom.noProjectState.hidden = true;
  dom.projectView.hidden = false;

  dom.projectDetailName.textContent = project.name;
  dom.projectDetailStatus.textContent =
    PROJECT_STATUS_LABELS[project.status] || project.status;
  dom.projectDetailStatus.className = `badge badge--${statusModifier(project.status)}`;
  dom.projectDetailDescription.textContent =
    project.description || "No description provided.";

  if (project.created_at) {
    dom.projectDetailCreated.dateTime = project.created_at;
    dom.projectDetailCreated.textContent = formatDateTime(project.created_at);
  } else {
    dom.projectDetailCreated.removeAttribute("datetime");
    dom.projectDetailCreated.textContent = "Unknown";
  }

  const projectTasks = state.tasks.filter(
    (task) => task.project_id === project.id
  );
  const openTasks = projectTasks.filter(
    (task) => task.status !== "completed"
  ).length;
  dom.projectDetailSummary.textContent = `${formatCount(
    projectTasks.length,
    "task"
  )} · ${openTasks} open`;

  document.title = `${project.name} · Industrial Project Tracker`;
}

function renderNoProject() {
  state.detailToken += 1;
  state.detailTasks = [];
  state.loading.detail = false;

  dom.projectView.hidden = true;
  dom.noProjectState.hidden = false;
  dom.taskList.replaceChildren();
  dom.tasksLoading.hidden = true;
  dom.tasksEmpty.hidden = true;
  clearDetailAlert();
  document.title = "Industrial Project Tracker";

  if (!state.hasLoaded) {
    dom.noProjectTitle.textContent = "Loading project data";
    dom.noProjectMessage.textContent =
      "Your project portfolio and tasks will appear here.";
  } else if (state.projects.length === 0) {
    dom.noProjectTitle.textContent = "No projects yet";
    dom.noProjectMessage.textContent =
      "Create a project to begin tracking engineering work and tasks.";
  } else {
    dom.noProjectTitle.textContent = "Select a project";
    dom.noProjectMessage.textContent =
      "Choose a project from the list to review its details and tasks.";
  }
}

function renderTaskList() {
  dom.taskList.replaceChildren();

  const hasFilters = Boolean(state.filters.status || state.filters.priority);
  const tasks = state.detailTasks;

  dom.taskCount.textContent = `${formatCount(tasks.length, "task")}${
    hasFilters ? " shown" : ""
  }`;

  if (tasks.length === 0) {
    dom.taskList.hidden = true;
    dom.tasksEmpty.hidden = false;
    dom.tasksEmpty.textContent = hasFilters
      ? "No tasks match the selected filters."
      : "No tasks yet. Create the first task for this project.";
    return;
  }

  dom.tasksEmpty.hidden = true;
  dom.taskList.hidden = false;

  for (const task of tasks) {
    const item = document.createElement("li");
    item.className = `task-card task-card--${statusModifier(task.status)}`;

    const main = document.createElement("div");
    main.className = "task-card__main";

    const header = document.createElement("div");
    header.className = "task-card__header";

    const title = document.createElement("h3");
    title.className = "task-card__title";
    title.textContent = task.title;

    header.append(
      title,
      makeBadge(
        TASK_STATUS_LABELS[task.status] || task.status,
        statusModifier(task.status)
      ),
      makeBadge(
        PRIORITY_LABELS[task.priority] || task.priority,
        statusModifier(task.priority)
      )
    );
    main.append(header);

    if (task.description) {
      const description = document.createElement("p");
      description.className = "task-card__description";
      description.textContent = task.description;
      main.append(description);
    }

    const meta = document.createElement("div");
    meta.className = "task-card__meta";

    if (task.due_date) {
      const due = document.createElement("time");
      due.dateTime = task.due_date;
      due.textContent = `Due ${formatDateOnly(task.due_date)}`;
      meta.append(due);

      if (isOverdue(task)) {
        const overdue = document.createElement("span");
        overdue.className = "overdue-label";
        overdue.textContent = "Overdue";
        meta.append(overdue);
      }
    } else {
      meta.append(createTextSpan("No due date"));
    }

    main.append(meta);

    const actions = document.createElement("div");
    actions.className = "task-card__actions";

    const editButton = createSmallButton("Edit", `Edit task: ${task.title}`);
    editButton.addEventListener("click", () => openTaskDialog(task));

    const deleteButton = createSmallButton(
      "Delete",
      `Delete task: ${task.title}`,
      "btn--danger-ghost"
    );
    deleteButton.addEventListener("click", () => deleteTask(task));

    actions.append(editButton, deleteButton);
    item.append(main, actions);
    dom.taskList.append(item);
  }
}

function handleFilterChange() {
  state.filters.status = dom.filterStatus.value;
  state.filters.priority = dom.filterPriority.value;
  syncFilterControls();
  if (state.selectedProjectId !== null) loadProjectDetail();
}

function clearTaskFilters() {
  state.filters.status = "";
  state.filters.priority = "";
  syncFilterControls();
  if (state.selectedProjectId !== null) loadProjectDetail();
}

function syncFilterControls() {
  dom.filterStatus.value = state.filters.status;
  dom.filterPriority.value = state.filters.priority;
  dom.clearFiltersButton.disabled = !(
    state.filters.status || state.filters.priority
  );
}

function openProjectDialog(project = null) {
  clearFormAlert(dom.projectFormAlert);
  dom.projectForm.reset();
  markInvalid(dom.projectName, false);

  dom.projectId.value = project ? String(project.id) : "";
  dom.projectName.value = project ? project.name : "";
  dom.projectDescription.value = project?.description || "";
  dom.projectStatus.value = project?.status || "active";
  dom.projectDialogTitle.textContent = project ? "Edit project" : "New project";
  dom.projectSubmitButton.textContent = project
    ? "Save changes"
    : "Create project";

  if (!dom.projectDialog.open) dom.projectDialog.showModal();
  dom.projectName.focus();
}

async function handleProjectSubmit(event) {
  event.preventDefault();
  if (dom.projectSubmitButton.disabled) return;

  const projectId = dom.projectId.value;
  const name = dom.projectName.value.trim();
  const description = dom.projectDescription.value.trim();

  clearFormAlert(dom.projectFormAlert);

  if (!name) {
    markInvalid(dom.projectName, true);
    showFormAlert(dom.projectFormAlert, "Enter a project name.");
    dom.projectName.focus();
    return;
  }

  const payload = {
    name,
    description: description || null,
    status: dom.projectStatus.value,
  };

  setButtonBusy(
    dom.projectSubmitButton,
    true,
    projectId ? "Saving…" : "Creating…"
  );

  try {
    const saved = await api(projectId ? `/projects/${projectId}` : "/projects", {
      method: projectId ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });

    dom.projectDialog.close();
    state.selectedProjectId = saved.id;
    showToast(projectId ? "Project updated." : "Project created.");
    await refreshAll();
  } catch (error) {
    showFormAlert(dom.projectFormAlert, error.message);
  } finally {
    setButtonBusy(dom.projectSubmitButton, false);
  }
}

function openTaskDialog(task = null) {
  const project = getSelectedProject();
  if (!project) return;

  clearFormAlert(dom.taskFormAlert);
  dom.taskForm.reset();
  markInvalid(dom.taskTitle, false);

  dom.taskId.value = task ? String(task.id) : "";
  dom.taskTitle.value = task ? task.title : "";
  dom.taskDescription.value = task?.description || "";
  dom.taskStatus.value = task?.status || "planned";
  dom.taskPriority.value = task?.priority || "medium";
  dom.taskDueDate.value = task?.due_date || "";
  dom.taskDialogProject.textContent = `Project: ${project.name}`;
  dom.taskDialogTitle.textContent = task ? "Edit task" : "New task";
  dom.taskSubmitButton.textContent = task ? "Save changes" : "Create task";

  if (!dom.taskDialog.open) dom.taskDialog.showModal();
  dom.taskTitle.focus();
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  if (dom.taskSubmitButton.disabled) return;

  const project = getSelectedProject();
  if (!project) {
    showFormAlert(dom.taskFormAlert, "Select a project before creating a task.");
    return;
  }

  const taskId = dom.taskId.value;
  const title = dom.taskTitle.value.trim();
  const description = dom.taskDescription.value.trim();

  clearFormAlert(dom.taskFormAlert);

  if (!title) {
    markInvalid(dom.taskTitle, true);
    showFormAlert(dom.taskFormAlert, "Enter a task title.");
    dom.taskTitle.focus();
    return;
  }

  const payload = {
    title,
    description: description || null,
    status: dom.taskStatus.value,
    priority: dom.taskPriority.value,
    due_date: dom.taskDueDate.value || null,
  };

  setButtonBusy(dom.taskSubmitButton, true, taskId ? "Saving…" : "Creating…");

  try {
    await api(
      taskId
        ? `/tasks/${taskId}`
        : `/projects/${project.id}/tasks`,
      {
        method: taskId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      }
    );

    dom.taskDialog.close();
    showToast(taskId ? "Task updated." : "Task created.");
    await refreshAll();
  } catch (error) {
    showFormAlert(dom.taskFormAlert, error.message);
  } finally {
    setButtonBusy(dom.taskSubmitButton, false);
  }
}

async function deleteSelectedProject() {
  const project = getSelectedProject();
  if (project) await deleteProject(project);
}

async function deleteProject(project) {
  const confirmed = await requestConfirmation({
    title: "Delete project?",
    message: `Delete “${project.name}” and all of its tasks? This action cannot be undone.`,
    confirmLabel: "Delete project",
  });
  if (!confirmed) return;

  try {
    await api(`/projects/${project.id}`, { method: "DELETE" });
    if (state.selectedProjectId === project.id) {
      state.selectedProjectId = null;
    }
    showToast("Project deleted. Its tasks were removed.");
    await refreshAll();
  } catch (error) {
    showGlobalAlert(error.message);
  }
}

async function deleteTask(task) {
  const confirmed = await requestConfirmation({
    title: "Delete task?",
    message: `Delete “${task.title}”? This action cannot be undone.`,
    confirmLabel: "Delete task",
  });
  if (!confirmed) return;

  try {
    await api(`/tasks/${task.id}`, { method: "DELETE" });
    showToast("Task deleted.");
    await refreshAll();
  } catch (error) {
    showGlobalAlert(error.message);
  }
}

function requestConfirmation({ title, message, confirmLabel }) {
  if (dom.confirmDialog.open) dom.confirmDialog.close();

  dom.confirmTitle.textContent = title;
  dom.confirmMessage.textContent = message;
  dom.confirmAcceptButton.textContent = confirmLabel;

  return new Promise((resolve) => {
    confirmResolver = resolve;
    dom.confirmDialog.showModal();
    dom.confirmCancelButton.focus();
  });
}

function settleConfirmation(confirmed) {
  const resolve = confirmResolver;
  confirmResolver = null;
  dom.confirmDialog.close();
  if (resolve) resolve(confirmed);
}

function setButtonBusy(button, busy, busyLabel = "Working…") {
  if (busy) {
    if (!button.dataset.idleLabel) {
      button.dataset.idleLabel = button.textContent;
    }
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.idleLabel || button.textContent;
    delete button.dataset.idleLabel;
    button.disabled = false;
  }
}

function showGlobalAlert(message) {
  dom.globalAlertMessage.textContent = message;
  dom.globalAlert.hidden = false;
}

function clearGlobalAlert() {
  dom.globalAlert.hidden = true;
  dom.globalAlertMessage.textContent = "";
}

function showDetailAlert(message) {
  dom.detailAlertMessage.textContent = message;
  dom.detailAlert.hidden = false;
}

function clearDetailAlert() {
  dom.detailAlert.hidden = true;
  dom.detailAlertMessage.textContent = "";
}

function showFormAlert(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function clearFormAlert(element) {
  element.hidden = true;
  element.textContent = "";
}

function showToast(message) {
  while (dom.toastRegion.children.length >= 3) {
    dom.toastRegion.firstElementChild.remove();
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  dom.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 5000);
}

function makeBadge(label, modifier) {
  const badge = document.createElement("span");
  badge.className = `badge badge--${modifier}`;
  badge.textContent = label;
  return badge;
}

function createSmallButton(label, ariaLabel, extraClass = "btn--secondary") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn btn--small ${extraClass}`;
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  return button;
}

function createTextSpan(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

function statusModifier(value) {
  return String(value).replaceAll("_", "-");
}

function markInvalid(input, invalid) {
  if (invalid) {
    input.setAttribute("aria-invalid", "true");
  } else {
    input.removeAttribute("aria-invalid");
  }
}

function formatCount(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function isOverdue(task) {
  if (task.status === "completed" || !task.due_date) return false;

  const dueDate = parseDateOnly(task.due_date);
  if (!dueDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}
