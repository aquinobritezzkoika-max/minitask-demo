import { 
  supabase, 
  isSupabaseConfigured, 
  getOrCreateAnonymousSession, 
  resetAnonymousSession 
} from './supabase.js';

// Estado de la aplicación
const state = {
  user: null,
  tasks: [],
  currentFilter: 'all', // 'all' | 'pending' | 'completed'
  isLoading: true,
  taskToDelete: null
};

// Elementos del DOM
const elements = {
  sessionUid: document.getElementById('session-uid'),
  btnSwitchUser: document.getElementById('btn-switch-user'),
  taskForm: document.getElementById('task-form'),
  taskInput: document.getElementById('task-input'),
  btnAdd: document.getElementById('btn-add-task'),
  taskList: document.getElementById('task-list'),
  loadingState: document.getElementById('loading-state'),
  emptyState: document.getElementById('empty-state'),
  emptyTitle: document.getElementById('empty-title'),
  emptyDesc: document.getElementById('empty-desc'),
  alertBox: document.getElementById('alert-box'),
  filterButtons: document.querySelectorAll('.filter-btn'),
  countAll: document.getElementById('count-all'),
  countPending: document.getElementById('count-pending'),
  countCompleted: document.getElementById('count-completed'),
  pendingCountText: document.getElementById('pending-count-text'),
  deleteModal: document.getElementById('delete-modal'),
  modalTaskText: document.getElementById('modal-task-text'),
  btnCancelDelete: document.getElementById('btn-cancel-delete'),
  btnConfirmDelete: document.getElementById('btn-confirm-delete'),
  toastContainer: document.getElementById('toast-container')
};

// ==============================================================================
// Utilidades de Interfaz (Toasts, Alertas, Formato de Fecha)
// ==============================================================================

function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function showAlert(message, type = 'error') {
  if (!message) {
    elements.alertBox.className = 'alert-box hidden';
    elements.alertBox.textContent = '';
    return;
  }
  elements.alertBox.className = `alert-box alert-${type}`;
  elements.alertBox.innerHTML = message;
}

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ==============================================================================
// Operaciones con Supabase (CRUD)
// ==============================================================================

/**
 * Carga las tareas del usuario actual desde Supabase.
 * Gracias a las políticas RLS, la consulta solo devolverá las tareas de su user_id.
 */
async function fetchTasks() {
  if (!isSupabaseConfigured) {
    state.isLoading = false;
    updateUI();
    return;
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    state.tasks = data || [];
  } catch (err) {
    console.error('Error al cargar tareas:', err);
    showAlert(`Error al sincronizar con Supabase: ${err.message || 'Error de red'}`);
    showToast('No se pudieron cargar las tareas', 'error');
  } finally {
    state.isLoading = false;
    updateUI();
  }
}

/**
 * Crea una nueva tarea en Supabase
 */
async function createTask(title) {
  if (!state.user && isSupabaseConfigured) {
    showToast('Sesión no disponible', 'error');
    return;
  }

  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  // Si Supabase no está configurado, modo demo en memoria
  if (!isSupabaseConfigured) {
    const demoTask = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      completed: false,
      created_at: new Date().toISOString(),
      user_id: 'demo-local-user'
    };
    state.tasks.unshift(demoTask);
    showToast('Tarea creada (modo demo local)', 'info');
    updateUI();
    return;
  }

  try {
    elements.btnAdd.disabled = true;
    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          title: cleanTitle,
          user_id: state.user.id,
          completed: false
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Agregar la tarea creada localmente
    state.tasks.unshift(data);
    showToast('Tarea guardada en Supabase', 'success');
    updateUI();
  } catch (err) {
    console.error('Error al crear tarea:', err);
    showAlert(`Error al guardar en Supabase: ${err.message}`);
    showToast('Error al crear la tarea', 'error');
  } finally {
    elements.btnAdd.disabled = false;
  }
}

/**
 * Alterna el estado completado/pendiente de una tarea
 */
async function toggleTaskStatus(taskId, currentStatus) {
  const newStatus = !currentStatus;

  // Actualización optimista en la interfaz
  const taskIndex = state.tasks.findIndex(t => t.id === taskId);
  if (taskIndex !== -1) {
    state.tasks[taskIndex].completed = newStatus;
    updateUI();
  }

  if (!isSupabaseConfigured) {
    showToast(newStatus ? 'Tarea completada' : 'Tarea pendiente', 'info');
    return;
  }

  try {
    const { error } = await supabase
      .from('tasks')
      .update({ completed: newStatus })
      .eq('id', taskId);

    if (error) throw error;
    showToast(newStatus ? 'Tarea completada' : 'Tarea pendiente', 'success');
  } catch (err) {
    console.error('Error al actualizar tarea:', err);
    // Revertir estado optimista
    if (taskIndex !== -1) {
      state.tasks[taskIndex].completed = currentStatus;
      updateUI();
    }
    showAlert(`No se pudo actualizar el estado: ${err.message}`);
    showToast('Error al actualizar tarea', 'error');
  }
}

/**
 * Elimina una tarea confirmada de Supabase
 */
async function deleteTask(taskId) {
  const taskIndex = state.tasks.findIndex(t => t.id === taskId);
  const deletedTask = state.tasks[taskIndex];

  // Optimista
  if (taskIndex !== -1) {
    state.tasks.splice(taskIndex, 1);
    updateUI();
  }

  if (!isSupabaseConfigured) {
    showToast('Tarea eliminada (modo demo)', 'info');
    return;
  }

  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
    showToast('Tarea eliminada de Supabase', 'success');
  } catch (err) {
    console.error('Error al eliminar tarea:', err);
    // Restaurar si falló
    if (deletedTask) {
      state.tasks.splice(taskIndex, 0, deletedTask);
      updateUI();
    }
    showAlert(`No se pudo eliminar la tarea: ${err.message}`);
    showToast('Error al eliminar tarea', 'error');
  }
}

// ==============================================================================
// Renderizado y Gestión de la Interfaz de Usuario (UI)
// ==============================================================================

function updateUI() {
  // 1. Contador y resumen de pendientes
  const totalCount = state.tasks.length;
  const pendingCount = state.tasks.filter(t => !t.completed).length;
  const completedCount = state.tasks.filter(t => t.completed).length;

  elements.countAll.textContent = totalCount;
  elements.countPending.textContent = pendingCount;
  elements.countCompleted.textContent = completedCount;

  elements.pendingCountText.textContent = pendingCount === 1 
    ? '1 tarea pendiente' 
    : `${pendingCount} tareas pendientes`;

  // 2. Control de estado de carga
  if (state.isLoading) {
    elements.loadingState.classList.remove('hidden');
    elements.taskList.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
    return;
  }
  elements.loadingState.classList.add('hidden');

  // 3. Filtrar tareas para renderizar
  let filteredTasks = state.tasks;
  if (state.currentFilter === 'pending') {
    filteredTasks = state.tasks.filter(t => !t.completed);
  } else if (state.currentFilter === 'completed') {
    filteredTasks = state.tasks.filter(t => t.completed);
  }

  // 4. Mostrar estado vacío o lista
  if (filteredTasks.length === 0) {
    elements.taskList.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');

    if (totalCount === 0) {
      elements.emptyTitle.textContent = 'No tienes tareas pendientes';
      elements.emptyDesc.textContent = 'Escribe tu primera tarea arriba y pulsa Añadir.';
    } else if (state.currentFilter === 'pending') {
      elements.emptyTitle.textContent = '¡Todo al día!';
      elements.emptyDesc.textContent = 'No hay tareas pendientes por completar.';
    } else {
      elements.emptyTitle.textContent = 'Sin tareas completadas';
      elements.emptyDesc.textContent = 'Completa alguna tarea para verla en esta sección.';
    }
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.taskList.classList.remove('hidden');

  // 5. Renderizar lista de elementos HTML
  elements.taskList.innerHTML = filteredTasks.map(task => `
    <li class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
      <div class="task-left">
        <button 
          class="custom-checkbox" 
          role="checkbox" 
          aria-checked="${task.completed}" 
          title="${task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}"
          data-action="toggle"
          data-id="${task.id}"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <div class="task-content">
          <span class="task-title">${escapeHTML(task.title)}</span>
          <span class="task-date">${formatDate(task.created_at)}</span>
        </div>
      </div>
      <div class="task-actions">
        <button 
          class="btn-icon btn-delete-task" 
          title="Eliminar tarea" 
          aria-label="Eliminar tarea"
          data-action="delete"
          data-id="${task.id}"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>
    </li>
  `).join('');
}

function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

// ==============================================================================
// Modal de Confirmación para Eliminar Tareas
// ==============================================================================

function openDeleteModal(task) {
  state.taskToDelete = task;
  elements.modalTaskText.textContent = `"${task.title}"`;
  elements.deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
  state.taskToDelete = null;
  elements.deleteModal.classList.add('hidden');
}

// ==============================================================================
// Inicialización y Listeners de Eventos
// ==============================================================================

async function init() {
  // Manejo de variables de entorno no configuradas
  if (!isSupabaseConfigured) {
    showAlert(
      `<strong>Modo Demostración Local:</strong> Las variables <code>VITE_SUPABASE_URL</code> o <code>VITE_SUPABASE_ANON_KEY</code> no están configuradas en el archivo <code>.env</code>. La aplicación funcionará temporalmente con estado en memoria.`,
      'info'
    );
    elements.sessionUid.textContent = 'demo-offline';
    state.isLoading = false;
    updateUI();
    return;
  }

  try {
    // 1. Obtener o crear sesión anónima
    const user = await getOrCreateAnonymousSession();
    state.user = user;
    elements.sessionUid.textContent = user.id ? `${user.id.slice(0, 8)}...` : 'Autenticado';
    elements.sessionUid.title = `ID de usuario Supabase Auth: ${user.id}`;
    
    // 2. Cargar tareas
    await fetchTasks();
  } catch (err) {
    console.error('Error al inicializar sesión:', err);
    showAlert(`Error al autenticar sesión anónima: ${err.message}`);
    state.isLoading = false;
    updateUI();
  }
}

// Envío del formulario para crear tarea
elements.taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = elements.taskInput.value;
  if (!title.trim()) return;
  
  elements.taskInput.value = '';
  await createTask(title);
  elements.taskInput.focus();
});

// Delegación de eventos en la lista de tareas (Checkbox y Botón Eliminar)
elements.taskList.addEventListener('click', (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const taskId = button.dataset.id;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (action === 'toggle') {
    toggleTaskStatus(taskId, task.completed);
  } else if (action === 'delete') {
    openDeleteModal(task);
  }
});

// Modal de confirmación
elements.btnCancelDelete.addEventListener('click', closeDeleteModal);
elements.deleteModal.addEventListener('click', (e) => {
  if (e.target === elements.deleteModal) closeDeleteModal();
});

elements.btnConfirmDelete.addEventListener('click', async () => {
  if (state.taskToDelete) {
    const id = state.taskToDelete.id;
    closeDeleteModal();
    await deleteTask(id);
  }
});

// Filtros de estado (Todas, Pendientes, Completadas)
elements.filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    elements.filterButtons.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    state.currentFilter = btn.dataset.filter;
    updateUI();
  });
});

// Simulación de nuevo usuario anónimo (para probar RLS en demostraciones)
elements.btnSwitchUser.addEventListener('click', async () => {
  if (!isSupabaseConfigured) {
    showToast('Modo demostración sin Supabase configurado', 'info');
    return;
  }

  const confirmSwitch = confirm('¿Deseas simular una nueva sesión anónima? Esto generará un nuevo UID y verificará que las tareas del usuario anterior no sean visibles gracias a RLS.');
  if (!confirmSwitch) return;

  try {
    state.isLoading = true;
    updateUI();
    const newUser = await resetAnonymousSession();
    state.user = newUser;
    elements.sessionUid.textContent = newUser.id ? `${newUser.id.slice(0, 8)}...` : 'Nuevo UID';
    showToast('Nueva sesión anónima generada', 'info');
    await fetchTasks();
  } catch (err) {
    console.error('Error al cambiar de sesión:', err);
    showAlert(`Error al cambiar de usuario: ${err.message}`);
  }
});

// Iniciar aplicación al cargar el DOM
init();
