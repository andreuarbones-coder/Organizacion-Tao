import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    updateDoc, 
    doc, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const DataService = {
    // --- STOCK ---
    loadStock: async () => {
        try {
            const q = query(collection(db, "stock"), orderBy("name"));
            const querySnapshot = await getDocs(q);
            const stockData = [];
            querySnapshot.forEach((doc) => {
                stockData.push({ id: doc.id, ...doc.data() });
            });
            UIManager.renderStock(stockData);
        } catch (error) {
            console.error("Error al cargar stock:", error);
            UIManager.showNotification("Error al cargar el stock", "error");
        }
    },

    // --- PROCEDIMIENTOS ---
    loadProcedures: async () => {
        try {
            const q = query(collection(db, "procedures"), orderBy("title"));
            const querySnapshot = await getDocs(q);
            const procedures = [];
            querySnapshot.forEach((doc) => {
                // IMPORTANTE: Incluimos el ID del documento para poder editar/borrar
                procedures.push({ id: doc.id, ...doc.data() });
            });
            UIManager.renderProcedures(procedures);
        } catch (error) {
            console.error("Error al cargar procedimientos:", error);
            UIManager.showNotification("Error al cargar procedimientos", "error");
        }
    },

    addProcedure: async (procedureData) => {
        try {
            await addDoc(collection(db, "procedures"), {
                ...procedureData,
                createdAt: serverTimestamp()
            });
            UIManager.showNotification("Procedimiento agregado", "success");
            DataService.loadProcedures(); // Recargar lista
        } catch (error) {
            console.error("Error al agregar procedimiento:", error);
            UIManager.showNotification("Error al guardar", "error");
        }
    },

    // NUEVO: Eliminar procedimiento
    deleteProcedure: async (id) => {
        try {
            await deleteDoc(doc(db, "procedures", id));
            UIManager.showNotification("Procedimiento eliminado", "success");
            DataService.loadProcedures(); // Recargar lista
        } catch (error) {
            console.error("Error al eliminar procedimiento:", error);
            UIManager.showNotification("Error al eliminar", "error");
        }
    },

    // NUEVO: Actualizar procedimiento
    updateProcedure: async (id, updatedData) => {
        try {
            const procedureRef = doc(db, "procedures", id);
            await updateDoc(procedureRef, updatedData);
            UIManager.showNotification("Procedimiento actualizado", "success");
            DataService.loadProcedures(); // Recargar lista
        } catch (error) {
            console.error("Error al actualizar procedimiento:", error);
            UIManager.showNotification("Error al actualizar", "error");
        }
    },

    // --- HISTORIAL ---
    loadHistory: async () => {
        try {
            const q = query(collection(db, "history"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            const history = [];
            querySnapshot.forEach((doc) => {
                history.push({ id: doc.id, ...doc.data() });
            });
            UIManager.renderHistory(history);
        } catch (error) {
            console.error("Error al cargar historial:", error);
            UIManager.showNotification("Error al cargar historial", "error");
        }
    },

    addHistoryEntry: async (entry) => {
        try {
            await addDoc(collection(db, "history"), {
                ...entry,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Error al registrar historial:", error);
        }
    }
};

// Exportar para uso global
window.DataService = DataService;
export default DataService;
