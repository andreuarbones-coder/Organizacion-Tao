import { DataService, AuthService } from './data-service.js';

// === ESTADO GLOBAL ===
const State = {
    user: null,
    username: localStorage.getItem('jardin_username') || '',
    branch: localStorage.getItem('tao_branch') || 'centro',
    view: 'delivery', 
    proceduresTab: 'protocols',
    wakeLock: null,
    listeners: {},
    stockList: [],
    pasteTarget: null 
};

// === UI MANAGER ===
export const UI = {
    init() {
        console.log("Iniciando Jardín OS v11.4..."); // Versión actualizada
        
        try {
            this.setBranch(State.branch);
            this.nav('delivery'); 
            
            const dateEl = document.getElementById('currentDate');
            if(dateEl) dateEl.innerText = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
            
            if (!State.username) {
                setTimeout(() => document.getElementById('modal-username')?.classList.remove('hidden'), 500);
            }

            this.setupEventListeners();

            AuthService.init((user) => {
                const ind = document.getElementById('connectionStatus');
                const loader = document.getElementById('loadingIndicator');
                
                if (user) {
                    State.user = user;
                    if(ind) ind.innerText = "Conectado";
                    if(loader) loader.classList.remove('hidden');
                    
                    this.startDataListeners();
                    this.loadStock(); 
                    
                    setTimeout(() => { if(loader) loader.classList.add('hidden'); }, 1000);
                } else {
                    if(ind) ind.innerText = "Desconectado";
                    AuthService.signIn(); 
                }
            });

        } catch (error) {
            console.error("Init Error:", error);
            document.getElementById('loadingIndicator')?.classList.add('hidden');
            this.toast("Error al iniciar", "error");
        }
    },

    setupEventListeners() {
        const bindClick = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };

        bindClick('branchToggleBtn', () => this.toggleBranch());
        
        document.querySelectorAll('.modal-close').forEach(b => b.onclick = () => this.closeModal());
        
        // CORRECCIÓN: Lógica mejorada para el cierre de modales
        const overlay = document.getElementById('modalOverlay');
        if(overlay) {
            let clickStartTarget = null;
            
            // Detectamos dónde EMPIEZA el click (al bajar el botón del mouse)
            overlay.onmousedown = (e) => {
                clickStartTarget = e.target;
            };

            // Solo cerramos si el click EMPEZÓ y TERMINÓ en el overlay (fondo oscuro)
            // Esto evita cerrar el modal si estás seleccionando texto y sueltas el mouse afuera
            overlay.onclick = (e) => { 
                if(e.target === overlay && clickStartTarget === overlay) {
                    this.closeModal(); 
                }
            };
        }

        bindClick('mainFab', () => this.handleFab());
        bindClick('wakeLockBtn', () => this.toggleWakeLock());

        bindClick('saveUsernameBtn', () => {
            const name = document.getElementById('usernameInput').value.trim();
            if(name) {
                localStorage.setItem('jardin_username', name);
                State.username = name;
                document.getElementById('modal-username').classList.add('hidden');
                this.toast(`Bienvenido, ${name}`);
            }
        });

        const orderTypeSelect = document.getElementById('orderType');
        if(orderTypeSelect) {
            orderTypeSelect.onchange = (e) => {
                const distInput = document.getElementById('orderDistributorName');
                if(distInput) e.target.value === 'distributor' ? distInput.classList.remove('hidden') : distInput.classList.add('hidden');
            };
        }

        const fileInput = document.getElementById('delTicketFile');
        if(fileInput) {
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if(file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const preview = document.getElementById('delPhotoPreview');
                        const status = document.getElementById('delPhotoStatus');
                        preview.querySelector('img').src = evt.target.result;
                        preview.classList.remove('hidden');
                        status.innerText = "Foto seleccionada";
                        status.className = "text-xs text-emerald-600 font-bold";
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        // CRUD Actions
        bindClick('saveTaskBtn', () => this.saveTask());
        bindClick('deleteTaskBtn', () => { if(document.getElementById('taskId').value) window.delTask(document.getElementById('taskId').value); });
        bindClick('saveOrderBtn', () => this.saveOrder());
        bindClick('saveDelBtn', () => this.saveDelivery());
        bindClick('saveNoteBtn', () => this.saveNote());
        bindClick('saveProcBtn', () => this.saveProcedure());
        bindClick('saveScriptBtn', () => this.saveScript());
    },

    // --- SMART PASTE ---
    
    openPasteModal(targetContainerId) {
        State.pasteTarget = targetContainerId;
        document.getElementById('pasteContent').value = '';
        this.openModal('modal-paste');
        setTimeout(() => document.getElementById('pasteContent').focus(), 100);
    },

    processPaste() {
        const text = document.getElementById('pasteContent').value;
        const pasteModal = document.getElementById('modal-paste');
        const closePasteOnly = () => {
            pasteModal.classList.add('translate-y-full', 'sm:translate-y-full');
            setTimeout(() => pasteModal.classList.add('hidden'), 300);
        };

        if (!text || !State.pasteTarget) return closePasteOnly();

        const lines = text.split(/\r?\n/);
        let count = 0;

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            const match = line.match(/^(\d+)[\s\-\.xX]*(.+)/);
            let amount = '1';
            let name = line;
            if (match) { amount = match[1]; name = match[2]; }
            name = name.replace(/^[.\-xX]+/, '').trim(); 
            if(name) { window.addOrderRow(State.pasteTarget, name, amount); count++; }
        });

        this.toast(`Pegados ${count} items`);
        closePasteOnly();
    },

    // --- VISOR DE IMAGENES ---
    openImageViewer(url) {
        const modal = document.getElementById('modal-image-viewer');
        const img = document.getElementById('viewerImage');
        img.src = url;
        modal.classList.remove('hidden');
    },

    // --- GUARDADO ---

    async saveTask() {
        const id = document.getElementById('taskId').value;
        const text = document.getElementById('taskInput').value.trim();
        const assignee = document.getElementById('taskAssignee').value.trim();
        const priority = document.getElementById('taskPriority').value;
        const cycle = document.getElementById('taskCycle').value;

        if (!text) return this.toast("Falta descripción", "error");

        const data = { text, assignee: assignee || 'Equipo', priority, cycle, branch: State.branch };
        if (!id) { data.status = 'pending'; data.createdBy = State.username; }

        try {
            if (id) await DataService.update('tasks', id, data);
            else await DataService.add('tasks', data);
            this.toast(id ? "Actualizada" : "Creada");
            this.closeModal();
        } catch (e) { this.toast("Error", "error"); }
    },

    async saveOrder() {
        const requester = document.getElementById('orderRequester').value.trim();
        const type = document.getElementById('orderType')?.value || 'internal_to_center';
        const distributorName = document.getElementById('orderDistributorName')?.value.trim();
        const notes = document.getElementById('orderNotes').value.trim();
        
        const items = [];
        const container = document.getElementById('orderItemsContainer');
        if(container) {
            container.querySelectorAll('.order-row').forEach(row => {
                const name = row.querySelector('.order-item').value.trim();
                const amount = row.querySelector('.order-amount').value.trim();
                if(name) items.push({ name, amount });
            });
        }

        if (items.length === 0) return this.toast("Agrega productos", "error");
        if (!requester) return this.toast("Falta solicitante", "error");
        if (type === 'distributor' && !distributorName) return this.toast("Falta nombre distribuidor", "error");

        const data = { 
            requester, notes, items, type, 
            branch: State.branch, status: 'pending',
            distributorName: type === 'distributor' ? distributorName : null 
        };

        try {
            await DataService.add('orders', data);
            this.toast("Pedido enviado");
            this.closeModal();
        } catch (e) { this.toast("Error", "error"); }
    },

    async saveDelivery() {
        const btn = document.getElementById('saveDelBtn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Guardando...";

        try {
            const id = document.getElementById('delId').value;
            const client = document.getElementById('delClient').value.trim();
            const phone = document.getElementById('delPhone').value.trim();
            const when = document.getElementById('delWhen').value.trim();
            const where = document.getElementById('delWhere').value.trim();
            const notes = document.getElementById('delNotes').value.trim();
            const seller = document.getElementById('delSeller')?.value.trim() || '';
            const ticket = document.getElementById('delTicket')?.value.trim() || '';

            const items = [];
            const container = document.getElementById('delItemsContainer');
            if(container) {
                container.querySelectorAll('.order-row').forEach(row => {
                    const name = row.querySelector('.order-item').value.trim();
                    const amount = row.querySelector('.order-amount').value.trim();
                    if(name) items.push({ name, amount });
                });
            }

            if (!client || !where) throw new Error("Faltan datos obligatorios");

            // --- SUBIDA DE FOTO ---
            let ticketUrl = null;
            const fileInput = document.getElementById('delTicketFile');
            
            if(fileInput && fileInput.files.length > 0) {
                btn.innerText = "Subiendo foto...";
                ticketUrl = await DataService.uploadImage(fileInput.files[0]);
            }

            const data = { 
                client, phone, when, where, notes, items, seller, ticket,
                branch: State.branch
            };
            
            if(ticketUrl) data.ticketImg = ticketUrl;

            if(!id) data.status = 'pending';

            if (id) await DataService.update('deliveries', id, data);
            else await DataService.add('deliveries', data);

            this.toast("Reparto agendado");
            this.closeModal();

        } catch (e) { 
            console.error("Error en saveDelivery:", e);
            this.toast(e.message || "Error al guardar", "error"); 
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    },

    async saveNote() {
        const type = document.getElementById('noteType').value;
        const content = document.getElementById('noteContent').value.trim();
        if(!content) return;
        try {
            await DataService.add('notes', { type, content, branch: State.branch });
            this.toast("Nota pegada");
            this.closeModal();
        } catch (e) { this.toast("Error", "error"); }
    },

    async saveProcedure() {
        const title = document.getElementById('procTitle').value.trim();
        const steps = document.getElementById('procSteps').value.trim();
        const color = document.querySelector('input[name="procColor"]:checked')?.value || 'blue';
        if(!title) return;
        try {
            await DataService.add('procedures', { title, steps, color });
            this.toast("Protocolo guardado");
            this.closeModal();
        } catch(e) { this.toast("Error", "error"); }
    },

    async saveScript() {
        const title = document.getElementById('scriptTitle').value.trim();
        const content = document.getElementById('scriptContent').value.trim();
        if(!title) return;
        try {
            await DataService.add('scripts', { title, content });
            this.toast("Guardado");
            this.closeModal();
        } catch(e) { this.toast("Error", "error"); }
    },

    // --- RENDER ---

    renderDeliveries(items) { 
        const list = document.getElementById('deliveryList');
        if(!list) return;
        list.innerHTML = '';
        if(items.length === 0) { list.innerHTML = this.emptyState('truck', 'Sin repartos'); return; }

        items.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        items.forEach(d => {
            const div = document.createElement('div');
            const isDone = d.status === 'delivered';
            const isIncomplete = d.status === 'incomplete';
            
            let borderClass = 'border-slate-200';
            if(isDone) borderClass = 'border-emerald-200 bg-emerald-50/50';
            if(isIncomplete) borderClass = 'border-orange-200 bg-orange-50/50';

            // Items
            let itemsHtml = '';
            if(d.items && d.items.length > 0) {
                itemsHtml = `<div class="mt-3 space-y-2">`;
                d.items.forEach(item => {
                    itemsHtml += `
                        <div class="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-sm border border-slate-100">
                            <span class="font-medium text-slate-700 truncate pr-2">${item.name}</span>
                            <span class="flex-none bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full border border-indigo-200">x${item.amount}</span>
                        </div>`;
                });
                itemsHtml += `</div>`;
            } else {
                itemsHtml = `<div class="mt-2 text-xs text-slate-400 italic">Sin items detallados</div>`;
            }

            // FOTO TICKET
            let photoHtml = '';
            if(d.ticketImg) {
                photoHtml = `
                    <div class="mt-3 bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer active:bg-slate-100 transition-colors" onclick="UI.openImageViewer('${d.ticketImg}')">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-lg bg-cover bg-center shadow-sm border border-slate-300" style="background-image: url('${d.ticketImg}')"></div>
                            <div class="flex flex-col">
                                <span class="text-xs font-bold text-slate-700">Foto del Ticket</span>
                                <span class="text-[10px] text-slate-400">Toca para ampliar</span>
                            </div>
                        </div>
                        <i class="fas fa-expand text-slate-400 mr-2"></i>
                    </div>
                `;
            }

            div.className = `bg-white rounded-xl p-4 shadow-sm border ${borderClass} mb-4 relative transition-all`;
            div.innerHTML = `
                <div class="flex items-start justify-between mb-2">
                    <div>
                         <h3 class="font-bold text-slate-800 text-lg leading-tight">${d.client}</h3>
                         <div class="text-sm text-emerald-600 font-bold mt-1"><i class="fas fa-map-marker-alt"></i> ${d.where}</div>
                    </div>
                    <div class="flex gap-2">
                         <button onclick="window.editDelivery(null)" class="hidden text-slate-400"><i class="fas fa-pen"></i></button> 
                         <button onclick="window.delShared('deliveries', '${d.id}')" class="text-slate-300 hover:text-red-400 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>

                ${itemsHtml}
                
                <div class="flex flex-col gap-1 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-50">
                    <div class="flex items-center justify-between">
                         ${d.when ? `<span class="font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded"><i class="far fa-clock text-slate-400"></i> ${d.when}</span>` : '<span></span>'}
                         ${d.phone ? `<button onclick="UI.openContactSheet('${d.phone}')" class="text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 border border-blue-100"><i class="fas fa-phone-alt"></i> Contactar</button>` : ''}
                    </div>
                    <div class="flex gap-2 mt-2">
                        ${d.seller ? `<span class="text-slate-400"><i class="fas fa-tag"></i> Venta: ${d.seller}</span>` : ''}
                        ${d.ticket ? `<span class="text-slate-500 font-bold ml-auto"><i class="fas fa-receipt"></i> TKT: ${d.ticket}</span>` : ''}
                    </div>
                </div>
                
                ${d.notes ? `<div class="mt-3 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100"><i class="fas fa-sticky-note mr-1 opacity-50"></i> ${d.notes}</div>` : ''}
                
                ${photoHtml}

                <div class="flex gap-1 mt-3 pt-2">
                    <button onclick="window.updateDeliveryStatus('${d.id}', 'pending')" class="flex-1 py-2 text-[10px] font-bold rounded-lg transition-colors ${d.status === 'pending' || !d.status ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-50'}">PENDIENTE</button>
                    <button onclick="window.updateDeliveryStatus('${d.id}', 'delivered')" class="flex-1 py-2 text-[10px] font-bold rounded-lg transition-colors ${isDone ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}">ENTREGADO</button>
                    <button onclick="window.updateDeliveryStatus('${d.id}', 'incomplete')" class="flex-1 py-2 text-[10px] font-bold rounded-lg transition-colors ${isIncomplete ? 'bg-orange-400 text-white shadow-md' : 'text-slate-400 hover:bg-orange-50 hover:text-orange-600'}">INCOMPLETO</button>
                </div>
            `;
            
            const editBtn = div.querySelector('button.hidden');
            if(editBtn) { editBtn.classList.remove('hidden'); editBtn.onclick = () => window.editDelivery(d); }
            
            list.appendChild(div);
        });
    },

    openContactSheet(phone) {
        const sheet = document.getElementById('sheet-contact');
        const cleanPhone = phone.replace(/[^0-9]/g, ''); 
        
        document.getElementById('btnCall').href = `tel:${cleanPhone}`;
        let waPhone = cleanPhone;
        if(!waPhone.startsWith('54') && waPhone.length >= 10) waPhone = '549' + waPhone;
        document.getElementById('btnWhatsapp').href = `https://wa.me/${waPhone}`;
        
        document.getElementById('contactSheetTitle').innerText = `Contactar: ${phone}`;
        sheet.classList.remove('hidden');
    },

    // --- GENERICOS (Render) ---
    renderTasks(tasks) { /* Sin cambios */ 
        const list = document.getElementById('taskList');
        if(!list) return;
        list.innerHTML = '';
        if(tasks.length === 0) { list.innerHTML = this.emptyState('relax', 'Todo listo'); return; }
        const prioColor = { critical: 'border-l-red-500', high: 'border-l-orange-500', medium: 'border-l-blue-500', low: 'border-l-emerald-500' };
        const prioText = { critical: 'URGENTE', high: 'ALTA', medium: 'MEDIA', low: 'BAJA' };
        const today = new Date().toDateString();
        tasks.forEach(t => {
            let isDone = false;
            if (t.cycle && t.cycle !== 'none') {
                if (t.lastDone) { const doneDate = new Date(t.lastDone.seconds * 1000).toDateString(); isDone = (doneDate === today); }
            } else { isDone = t.status === 'done'; }
            
            const div = document.createElement('div');
            div.className = `bg-white rounded-xl p-4 shadow-sm border-l-4 ${prioColor[t.priority] || 'border-l-slate-300'} flex gap-3 ${isDone ? 'opacity-50' : ''}`;
            div.innerHTML = `
                <div class="flex flex-col gap-2 pt-1 border-l border-slate-100 pl-3 order-2">
                    ${!isDone ? `<button onclick="window.updateTaskStatus('${t.id}', 'done', '${t.cycle}')" class="w-8 h-8 rounded-full bg-slate-100 text-slate-300 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"><i class="fas fa-check"></i></button>` : `<button onclick="window.updateTaskStatus('${t.id}', 'pending', '${t.cycle}')" class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md active:scale-90"><i class="fas fa-undo"></i></button>`}
                </div>
                <div class="flex-grow order-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${prioText[t.priority] || 'NORMAL'}</span>
                        ${t.cycle !== 'none' ? `<span class="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold"><i class="fas fa-sync-alt"></i> ${t.cycle}</span>` : ''}
                    </div>
                    <h3 class="text-slate-800 font-medium leading-tight ${isDone ? 'line-through text-slate-400' : ''}">${t.text}</h3>
                    <div class="flex items-center justify-between mt-2">
                        <span class="text-xs text-slate-400"><i class="fas fa-user-circle"></i> ${t.assignee || 'Equipo'}</span>
                        <button onclick="window.delTask('${t.id}')" class="text-slate-300 hover:text-red-400 px-2"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    },

    renderOrders(orders) {
        const list = document.getElementById('ordersList');
        if(!list) return;
        list.innerHTML = '';
        if(orders.length === 0) { list.innerHTML = this.emptyState('shopping-basket', 'Sin pedidos'); return; }
        
        orders.forEach(o => {
           const div = document.createElement('div');
           div.className = "bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-3 relative";
           
           let typeLabel = '';
           if(o.type === 'internal_to_center') typeLabel = '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">EJEMPLARES <i class="fas fa-arrow-right"></i> CENTRO</span>';
           else if(o.type === 'internal_to_branch') typeLabel = '<span class="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">CENTRO <i class="fas fa-arrow-right"></i> EJEMPLARES</span>';
           else if(o.type === 'distributor') typeLabel = `<span class="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold"><i class="fas fa-truck"></i> ${o.distributorName || 'PROVEEDOR'}</span>`;

           let itemsHtml = '';
           let textForCopy = `*PEDIDO: ${o.requester}*\n`;
           if(o.type === 'distributor') textForCopy += `Proveedor: ${o.distributorName || 'N/A'}\n`;
           if(o.notes) textForCopy += `Notas: ${o.notes}\n`;
           textForCopy += `\n`;

           if(o.items) {
                itemsHtml = `<div class="mt-3 space-y-1">`;
                o.items.forEach(i => {
                     textForCopy += `${i.amount} ${i.name}\n`;
                     itemsHtml += `
                        <div class="flex justify-between items-center bg-slate-50 p-1.5 rounded text-xs border border-slate-100">
                            <span class="font-medium text-slate-700">${i.name}</span>
                            <span class="bg-blue-100 text-blue-700 px-2 rounded-full font-bold">x${i.amount}</span>
                        </div>`;
                });
                itemsHtml += `</div>`;
           }
           
           const encodedCopy = encodeURIComponent(textForCopy);

           div.innerHTML = `
                <div class="flex justify-between items-start mb-1">
                    <div>
                        ${typeLabel}
                        <div class="font-bold text-slate-800 mt-2 text-sm">${o.requester} <span class="font-normal text-slate-400">solicita:</span></div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.copyOrderList('${encodedCopy}')" class="text-slate-300 hover:text-indigo-500 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50"><i class="far fa-copy"></i></button>
                        <button onclick="window.delShared('orders', '${o.id}')" class="text-slate-300 hover:text-red-400 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                ${itemsHtml}
                ${o.notes ? `<div class="text-xs text-slate-500 italic mt-3 bg-slate-50 p-2 rounded">"${o.notes}"</div>` : ''}
                
                <div class="mt-3 pt-2 border-t border-slate-50 text-[10px] text-slate-300 text-right">
                    ${o.createdAt ? new Date(o.createdAt.seconds*1000).toLocaleDateString() : ''}
                </div>
           `; 
           list.appendChild(div);
        });
    },

    renderNotes(notes) { /* Sin cambios */
        const list = document.getElementById('notesList');
        if(!list) return;
        list.innerHTML = '';
        if(notes.length === 0) { list.innerHTML = this.emptyState('sticky-note', 'Sin notas'); return; }
        notes.forEach(n => {
            const isCart = n.type === 'cart';
            const div = document.createElement('div');
            div.className = `p-4 rounded-xl shadow-sm border relative ${isCart ? 'bg-white border-blue-200 border-l-4 border-l-blue-500' : 'bg-yellow-50 border-yellow-200'}`;
            if (isCart) div.innerHTML += `<span class="absolute -top-2 left-4 bg-blue-500 text-white text-[10px] px-2 rounded font-bold shadow-sm"><i class="fas fa-shopping-cart"></i> COMPRAR</span>`;
            div.innerHTML += `
                <p class="whitespace-pre-wrap leading-relaxed font-sans ${isCart ? 'text-slate-700' : 'text-slate-800'}">${n.content}</p>
                <button onclick="window.delItem('notes', '${n.id}')" class="absolute top-2 right-2 text-slate-400 hover:text-red-500 w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center"><i class="fas fa-trash-alt"></i></button>
            `;
            list.appendChild(div);
        });
    },

    renderProcedures(items) { /* Sin cambios */
         const list = document.getElementById('proceduresList');
         if(!list) return;
         list.innerHTML = '';
         if(items.length === 0) { list.innerHTML = this.emptyState('book', 'Sin protocolos'); return; }
         const colors = { blue: 'bg-blue-50 border-blue-200 text-blue-800', green: 'bg-emerald-50 border-emerald-200 text-emerald-800', red: 'bg-red-50 border-red-200 text-red-800', purple: 'bg-purple-50 border-purple-200 text-purple-800', pink: 'bg-pink-50 border-pink-200 text-pink-800', teal: 'bg-teal-50 border-teal-200 text-teal-800', slate: 'bg-slate-50 border-slate-200 text-slate-800' };
         items.forEach(p => {
             const div = document.createElement('div');
             div.className = `p-4 rounded-xl border ${colors[p.color || 'blue']} mb-3 shadow-sm`;
             div.innerHTML = `<h3 class="font-bold mb-2 text-lg">${p.title}</h3><div class="whitespace-pre-wrap text-sm opacity-90">${p.steps}</div>`;
             list.appendChild(div);
         });
    },

    renderScripts(items) { /* Sin cambios */
         const list = document.getElementById('scriptsList');
         if(!list) return;
         list.innerHTML = '';
         if(items.length === 0) { list.innerHTML = this.emptyState('comment-dots', 'Sin speechs'); return; }
         items.forEach(s => {
             const div = document.createElement('div');
             div.className = "p-4 bg-white rounded-xl shadow-sm border border-slate-100 mb-3";
             div.innerHTML = `<div class="flex justify-between items-center mb-2"><h3 class="font-bold text-slate-700">${s.title}</h3><button onclick="window.copyScript(this.getAttribute('data-content'))" data-content="${s.content}" class="text-purple-600 text-xs font-bold bg-purple-50 px-2 py-1 rounded hover:bg-purple-100">COPIAR</button></div><div class="text-sm text-slate-500 font-mono bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">${s.content}</div>`;
             list.appendChild(div);
         });
    },

    // --- UTILS ---

    setBranch(branch) {
        State.branch = branch;
        localStorage.setItem('tao_branch', branch);
        const body = document.getElementById('appBody');
        const label = document.getElementById('settingsBranchName');
        if(branch === 'centro') { if(body) body.className = 'branch-centro transition-colors duration-500 font-sans text-slate-800'; if(label) label.innerText = 'Centro Tao'; }
        else { if(body) body.className = 'branch-ejemplares transition-colors duration-500 font-sans text-slate-800'; if(label) label.innerText = 'Ejemplares Tao'; }
        if(State.user) this.startDataListeners();
    },
    toggleBranch() { this.setBranch(State.branch === 'centro' ? 'ejemplares' : 'centro'); },
    
    async toggleWakeLock() {
        const btn = document.getElementById('wakeLockBtn');
        try {
            if (State.wakeLock) { await State.wakeLock.release(); State.wakeLock = null; btn.innerHTML = '<i class="far fa-moon"></i> <span>Pantalla: Automática</span>'; btn.classList.replace('bg-emerald-100','bg-slate-100'); btn.classList.replace('text-emerald-700','text-slate-500'); }
            else { State.wakeLock = await navigator.wakeLock.request('screen'); btn.innerHTML = '<i class="fas fa-sun"></i> <span>Mantener Pantalla: ON</span>'; btn.classList.replace('bg-slate-100','bg-emerald-100'); btn.classList.replace('text-slate-500','text-emerald-700'); }
        } catch(e) { this.toast("No soportado", "error"); }
    },

    nav(view) {
        State.view = view;
        document.querySelectorAll('.nav-btn, .nav-btn-center').forEach(el => el.classList.remove('active'));
        document.getElementById(`nav-${view}`)?.classList.add('active');
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById(`view-${view}`)?.classList.remove('hidden');
        const titles = { tasks: 'Mis Tareas', orders: 'Pedidos', delivery: 'Repartos', notes: 'Notas', procedures: 'Procedimientos' };
        if(document.getElementById('pageTitle')) document.getElementById('pageTitle').innerText = titles[view] || 'Jardín OS';
    },

    switchProceduresTab(tab) {
        State.proceduresTab = tab;
        const pBtn = document.getElementById('tab-protocols'), sBtn = document.getElementById('tab-speech');
        const pDiv = document.getElementById('proceduresContainer'), sDiv = document.getElementById('scriptsContainer');
        if(tab === 'protocols') {
            pBtn.classList.add('bg-white','shadow-sm','text-slate-600'); pBtn.classList.remove('text-slate-500');
            sBtn.classList.remove('bg-white','shadow-sm','text-slate-600'); sBtn.classList.add('text-slate-500');
            pDiv.classList.remove('hidden'); sDiv.classList.add('hidden');
        } else {
            sBtn.classList.add('bg-white','shadow-sm','text-slate-600'); sBtn.classList.remove('text-slate-500');
            pBtn.classList.remove('bg-white','shadow-sm','text-slate-600'); pBtn.classList.add('text-slate-500');
            sDiv.classList.remove('hidden'); pDiv.classList.add('hidden');
        }
    },

    startDataListeners() {
        Object.values(State.listeners).forEach(u => u && u());
        ['tasks','notes','orders','deliveries','procedures','scripts'].forEach(col => {
            State.listeners[col] = DataService.subscribeToCollection(col, (items) => {
                const filtered = (col === 'tasks' || col === 'notes' || col === 'orders' || col === 'deliveries') ? items.filter(i => i.branch === State.branch) : items;
                if(col === 'tasks') this.renderTasks(filtered.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)));
                if(col === 'notes') this.renderNotes(filtered);
                if(col === 'orders') this.renderOrders(filtered);
                if(col === 'deliveries') this.renderDeliveries(filtered);
                if(col === 'procedures') this.renderProcedures(filtered);
                if(col === 'scripts') this.renderScripts(filtered);
            });
        });
    },

    async loadStock() {
        try { State.stockList = await DataService.fetchStockList(); this.updateAutocomplete(); } 
        catch (e) { console.error(e); }
    },
    
    updateAutocomplete() {
        const dl = document.getElementById('stockItemsList');
        if(dl) { dl.innerHTML = ''; State.stockList.slice(0,2000).forEach(i => { const o=document.createElement('option'); o.value=i; dl.appendChild(o); }); }
    },

    openModal(id, data = null) {
        const m = document.getElementById(id); const o = document.getElementById('modalOverlay');
        if(!m || !o) return;
        o.classList.remove('hidden'); m.classList.remove('hidden', 'translate-y-full', 'sm:translate-y-full');
        
        // Reset/Fill Logic
        if(id === 'modal-tasks') {
            document.getElementById('taskId').value = data?.id || '';
            document.getElementById('taskInput').value = data?.text || '';
            document.getElementById('taskAssignee').value = data?.assignee || State.username || '';
            document.getElementById('taskPriority').value = data?.priority || 'medium';
            document.getElementById('taskCycle').value = data?.cycle || 'none';
            document.getElementById('deleteTaskBtn').classList.toggle('hidden', !data);
        }
        if(id === 'modal-delivery') {
            document.getElementById('delItemsContainer').innerHTML = '';
            document.getElementById('delId').value = data?.id || '';
            document.getElementById('delClient').value = data?.client || '';
            document.getElementById('delPhone').value = data?.phone || '';
            document.getElementById('delWhen').value = data?.when || '';
            document.getElementById('delWhere').value = data?.where || '';
            document.getElementById('delNotes').value = data?.notes || '';
            if(document.getElementById('delSeller')) document.getElementById('delSeller').value = data?.seller || '';
            if(document.getElementById('delTicket')) document.getElementById('delTicket').value = data?.ticket || '';
            
            // Foto reset
            window.clearDelPhoto();
            if(data && data.ticketImg) {
                document.getElementById('delPhotoStatus').innerText = "Foto ya guardada (subir otra reemplaza)";
            }

            if(data && data.items) data.items.forEach(i => window.addOrderRow('delItemsContainer', i.name, i.amount));
            else window.addOrderRow('delItemsContainer');
        }
        if(id === 'modal-orders') {
            document.getElementById('orderItemsContainer').innerHTML = '';
            window.addOrderRow('orderItemsContainer');
            document.getElementById('orderRequester').value = State.username || '';
            document.getElementById('orderNotes').value = '';
            if(document.getElementById('orderDistributorName')) document.getElementById('orderDistributorName').classList.add('hidden');
        }
    },

    closeModal() {
        const o = document.getElementById('modalOverlay');
        const modals = document.querySelectorAll('#modalOverlay > div:not(.hidden)');
        modals.forEach(m => m.classList.add('translate-y-full', 'sm:translate-y-full'));
        setTimeout(() => { if(o) o.classList.add('hidden'); modals.forEach(m => m.classList.add('hidden')); }, 300);
    },

    handleFab() {
        const map = { tasks: 'modal-tasks', orders: 'modal-orders', delivery: 'modal-delivery', notes: 'modal-notes', procedures: State.proceduresTab === 'protocols' ? 'modal-procedures' : 'modal-scripts' };
        if(map[State.view]) this.openModal(map[State.view]);
    },

    toast(msg, type='info') {
        const c = document.getElementById('toast-container');
        if(!c) return;
        const div = document.createElement('div');
        const icon = type === 'error' ? 'fa-exclamation-circle text-red-400' : 'fa-check-circle text-emerald-400';
        div.className = 'toast';
        div.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
        c.appendChild(div);
        setTimeout(() => { div.style.opacity='0'; div.style.transform='translateY(-10px)'; setTimeout(()=>div.remove(),300); }, 3000);
    },
    
    emptyState(icon, text) { return `<div class="flex flex-col items-center justify-center py-10 opacity-40 gap-3"><i class="fas fa-${icon} text-4xl"></i><p>${text}</p></div>`; }
};

// GLOBAL EXPORTS
window.UI = UI;
window.updateTaskStatus = async (id, s, c) => { const d={status:s}; if(s==='done'&&c&&c!=='none') d.lastDone=new Date(); await DataService.update('tasks',id,d); };
window.updateDeliveryStatus = async (id, s) => { await DataService.update('deliveries',id,{status:s}); UI.toast("Estado actualizado"); };
window.editTask = (t) => UI.openModal('modal-tasks', t);
window.editDelivery = (d) => UI.openModal('modal-delivery', d);
window.delTask = async (id) => { if(confirm('¿Eliminar?')) { UI.closeModal(); await DataService.delete('tasks', id); UI.toast("Eliminado"); } };
window.delItem = async (c, id) => { if(confirm('¿Eliminar?')) await DataService.delete(c, id); };
window.delShared = async (c, id) => { if(confirm('¿Eliminar Global?')) await DataService.delete(c, id); };
window.copyScript = (t) => { navigator.clipboard.writeText(t).then(()=>UI.toast("Copiado")); };
window.copyOrderList = (encoded) => { const text = decodeURIComponent(encoded); navigator.clipboard.writeText(text).then(()=>UI.toast("Lista copiada")); };
window.downloadBackup = async () => { const d=await DataService.generateBackupJSON(); const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); };
