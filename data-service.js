// Importamos la base de datos y autenticación ya inicializadas desde tu config
import { db, auth } from './firebase-config.js';

// Importamos las herramientas de Firestore y Auth (Versión 9.22.0, IGUAL que en config)
import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    query, 
    orderBy, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { 
    signInAnonymously, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// === UTILIDAD: LIMPIEZA DE DATOS ===
// Firestore falla si le envías un campo con valor 'undefined'. Esta función lo evita.
const sanitize = (data) => {
    const cleanData = {};
    Object.keys(data).forEach(key => {
        const val = data[key];
        // Si es undefined, no lo incluimos. Si es null o válido, sí.
        if (val !== undefined) {
            cleanData[key] = val;
        }
    });
    return cleanData;
};

// === SERVICIO DE AUTENTICACIÓN ===
export const AuthService = {
    init(callback) {
        onAuthStateChanged(auth, (user) => {
            callback(user);
        });
    },

    async signIn() {
        try {
            console.log("Intentando login anónimo...");
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Error crítico en Auth:", error);
            alert("Error de conexión con la base de datos. Verifica tu internet.");
        }
    }
};

// === SERVICIO DE DATOS (CRUD) ===
export const DataService = {
    
    // Escuchar cambios en tiempo real
    subscribeToCollection(collName, callback) {
        // Ordenamos por fecha de creación (createdAt) descendente
        const q = query(collection(db, collName), orderBy('createdAt', 'desc'));
        
        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(items);
        }, (error) => {
            console.error(`Error de permiso o conexión en ${collName}:`, error);
            // No bloqueamos la app, solo logueamos el error
        });
    },

    // Agregar documento
    async add(collName, data) {
        try {
            // Limpiamos los datos antes de enviar para evitar errores de "Invalid Data"
            const safeData = sanitize({
                ...data,
                createdAt: new Date() // Timestamp automático
            });

            const docRef = await addDoc(collection(db, collName), safeData);
            console.log(`Documento creado en ${collName} con ID: ${docRef.id}`);
            return docRef.id;
        } catch (error) {
            console.error(`Error GUARDANDO en ${collName}:`, error);
            throw error; // Lanzamos el error para que UI Manager muestre el toast rojo
        }
    },

    // Actualizar documento
    async update(collName, id, data) {
        try {
            const docRef = doc(db, collName, id);
            const safeData = sanitize({
                ...data,
                updatedAt: new Date()
            });
            await updateDoc(docRef, safeData);
        } catch (error) {
            console.error(`Error ACTUALIZANDO ${id} en ${collName}:`, error);
            throw error;
        }
    },

    // Eliminar documento
    async delete(collName, id) {
        try {
            await deleteDoc(doc(db, collName, id));
        } catch (error) {
            console.error(`Error ELIMINANDO ${id} de ${collName}:`, error);
            throw error;
        }
    },

    // === UTILIDADES EXTRA ===

    // Obtener lista de Stock
    async fetchStockList() {
        try {
            const response = await fetch('./stock.json');
            if (response.ok) {
                const data = await response.json();
                return data.items || [];
            }
        } catch (e) {
            // Es normal si no existe el archivo todavía
            console.log("No hay archivo stock.json local.");
        }
        return [];
    },

    // Generar Backup JSON
    async generateBackupJSON() {
        const collections = ['tasks', 'notes', 'orders', 'deliveries', 'procedures', 'scripts'];
        const backup = {};

        for (const col of collections) {
            try {
                const snapshot = await getDocs(collection(db, col));
                backup[col] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) {
                console.error(`No se pudo respaldar ${col}`, e);
                backup[col] = [];
            }
        }
        return backup;
    }
};
