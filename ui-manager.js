const UIManager = {
    // Almacén temporal para los datos cargados
    lastProcedures: [],

    init: () => {
        UIManager.setupEventListeners();
        // Inicializar vista por defecto
        UIManager.switchTab('stock');
    },

    setupEventListeners: () => {
        // Navegación
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                UIManager.switchTab(tabId);
            });
        });

        // FAB Menu
        const mainFab = document.getElementById('main-fab');
        if (mainFab) {
            mainFab.addEventListener('click', UIManager.toggleFab);
        }

        // Modales
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.fixed');
                UIManager.hideModal(modal.id);
            });
        });

        // Cerrar modal al hacer click fuera
        window.onclick = (event) => {
            if (event.target.classList.contains('bg-black')) {
                UIManager.hideModal(event.target.parentElement.id);
            }
        };
    },

    switchTab: (tabId) => {
        // Actualizar botones de navegación
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('text-blue-600');
                btn.classList.remove('text-gray-500');
            } else {
                btn.classList.remove('text-blue-600');
                btn.classList.add('text-gray-500');
            }
        });

        // Mostrar sección correspondiente
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById(tabId).classList.remove('hidden');

        // Cargar datos según la pestaña
        switch(tabId) {
            case 'stock':
                DataService.loadStock();
                break;
            case 'procedures':
                DataService.loadProcedures();
                break;
            case 'history':
                DataService.loadHistory();
                break;
        }
    },

    renderStock: (stockData) => {
        const container = document.getElementById('stock-list');
        if (!container) return;
        
        if (stockData.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500">No hay items en el stock</div>';
            return;
        }

        const html = stockData.map(item => `
            <div class="bg-white p-4 rounded-lg shadow mb-3 flex justify-between items-center stock-item border-l-4 ${item.quantity <= item.minQuantity ? 'border-red-500' : 'border-green-500'}">
                <div>
                    <h3 class="font-bold text-gray-800">${item.name}</h3>
                    <p class="text-sm text-gray-600">${item.category || 'General'}</p>
                </div>
                <div class="text-right">
                    <span class="block text-2xl font-bold ${item.quantity <= item.minQuantity ? 'text-red-600' : 'text-gray-800'}">${item.quantity}</span>
                    <span class="text-xs text-gray-500">Min: ${item.minQuantity}</span>
                </div>
            </div>
        `).join('');

        // Espaciador para scroll
        container.innerHTML = html + '<div class="h-32 w-full"></div>';
    },

    renderProcedures: (procedures) => {
        const container = document.getElementById('procedures-list');
        if (!container) return;

        // Guardamos referencia local para poder editar después
        UIManager.lastProcedures = procedures;

        if (procedures.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500">No hay procedimientos registrados</div>';
            return;
        }

        const html = procedures.map(proc => `
            <div class="bg-white p-4 rounded-lg shadow mb-3 border-l-4 border-blue-500 relative">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-gray-800 text-lg">${proc.title}</h3>
                    
                    <!-- Botones de Acción -->
                    <div class="flex gap-2">
                        <button onclick="UIManager.editProcedure('${proc.id}')" class="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors" title="Editar">
                            <i class='bx bx-edit-alt text-xl'></i>
                        </button>
                        <button onclick="UIManager.deleteProcedure('${proc.id}')" class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors" title="Eliminar">
                            <i class='bx bx-trash text-xl'></i>
                        </button>
                    </div>
                </div>

                <p class="text-gray-600 text-sm mb-2">${proc.description}</p>
                
                <div class="flex flex-wrap gap-2 mt-2">
                    ${proc.steps ? proc.steps.map((step, index) => 
                        `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center">
                            <span class="font-bold mr-1">${index + 1}.</span> ${step}
                        </span>`
                    ).join('') : ''}
                </div>
            </div>
        `).join('');

        // Espaciador para scroll
        container.innerHTML = html + '<div class="h-32 w-full"></div>';
    },

    // --- NUEVAS FUNCIONES DE ACCIÓN ---

    deleteProcedure: (id) => {
        if (confirm('¿Estás seguro de que deseas eliminar este procedimiento? Esta acción no se puede deshacer.')) {
            DataService.deleteProcedure(id);
        }
    },

    editProcedure: (id) => {
        const proc = UIManager.lastProcedures.find(p => p.id === id);
        if (!proc) return;

        // Edición rápida usando Prompts
        const newTitle = prompt("Editar Título del Procedimiento:", proc.title);
        if (newTitle === null) return; // Cancelado por el usuario

        const newDesc = prompt("Editar Descripción:", proc.description);
        if (newDesc === null) return; // Cancelado

        // Solo enviamos actualización si hubo cambios y los datos son válidos
        if (newTitle.trim() !== "" && (newTitle !== proc.title || newDesc !== proc.description)) {
            DataService.updateProcedure(id, {
                title: newTitle.trim(),
                description: newDesc.trim()
            });
        }
    },

    // ----------------------------------

    renderHistory: (history) => {
        const container = document.getElementById('history-list');
        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500">No hay movimientos registrados</div>';
            return;
        }

        const html = history.map(item => {
            const date = item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleString() : 'Fecha desconocida';
            const isEntry = item.type === 'entry';
            const colorClass = isEntry ? 'text-green-600' : 'text-red-600';
            const icon = isEntry ? 'bx-down-arrow-alt' : 'bx-up-arrow-alt';
            
            return `
            <div class="bg-white p-3 rounded-lg shadow mb-2 flex justify-between items-center text-sm">
                <div class="flex items-center gap-3">
                    <div class="rounded-full p-2 ${isEntry ? 'bg-green-100' : 'bg-red-100'}">
                        <i class='bx ${icon} ${colorClass} text-xl'></i>
                    </div>
                    <div>
                        <p class="font-bold text-gray-800">${item.itemName}</p>
                        <p class="text-xs text-gray-500">${date}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="font-bold block ${colorClass}">${isEntry ? '+' : '-'}${item.quantity}</span>
                    <span class="text-xs text-gray-400">${item.user || 'Anónimo'}</span>
                </div>
            </div>
            `;
        }).join('');

        // Espaciador para scroll
        container.innerHTML = html + '<div class="h-32 w-full"></div>';
    },

    showModal: (modalId) => {
        document.getElementById(modalId).classList.remove('hidden');
        UIManager.toggleFab(); // Cerrar FAB si está abierto
    },

    hideModal: (modalId) => {
        document.getElementById(modalId).classList.add('hidden');
    },

    toggleFab: () => {
        const menu = document.getElementById('fab-menu');
        const icon = document.querySelector('#main-fab i');
        
        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            icon.classList.remove('bx-plus');
            icon.classList.add('bx-x');
        } else {
            menu.classList.add('hidden');
            icon.classList.remove('bx-x');
            icon.classList.add('bx-plus');
        }
    },

    showNotification: (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 p-4 rounded shadow-lg text-white z-50 transition-opacity duration-500 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
};

// Exportar para uso global
window.UIManager = UIManager;
