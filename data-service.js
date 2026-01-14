import { db, auth, storage } from './firebase-config.js';

// === IMPORTACIONES FIREBASE (v9.22.0) ===
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

import { 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// === UTILIDAD: LIMPIEZA DE DATOS ===
const sanitize = (data) => {
    const cleanData = {};
    Object.keys(data).forEach(key => {
        const val = data[key];
        if (val !== undefined) cleanData[key] = val;
    });
    return cleanData;
};

// === SERVICIO DE AUTENTICACIÓN ===
export const AuthService = {
    init(callback) {
        onAuthStateChanged(auth, (user) => callback(user));
    },

    async signIn() {
        try {
            console.log("Iniciando sesión anónima...");
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Error Auth:", error);
            alert("Verifica tu conexión a internet.");
        }
    }
};

// === SERVICIO DE DATOS (CRUD + STORAGE) ===
export const DataService = {
    
    // --- NUEVO: SUBIDA DE IMÁGENES ---
    async uploadImage(file, folder = 'tickets') {
        try {
            // Generamos nombre único: TIMESTAMP_NombreOriginal
            // Ej: 162509283_foto.jpg
            const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
            const fileName = `${Date.now()}_${cleanName}`;
            const storageRef = ref(storage, `${folder}/${fileName}`);
            
            console.log(`Subiendo imagen: ${fileName}...`);
            const snapshot = await uploadBytes(storageRef, file);
            
            const url = await getDownloadURL(snapshot.ref);
            console.log("Imagen subida. URL:", url);
            return url;
        } catch (error) {
            console.error("Error subiendo imagen:", error);
            throw error;
        }
    },

    // --- BASE DE DATOS ---

    subscribeToCollection(collName, callback) {
        const q = query(collection(db, collName), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(items);
        }, (error) => console.error(`Error escuchando ${collName}:`, error));
    },

    async add(collName, data) {
        try {
            const safeData = sanitize({ ...data, createdAt: new Date() });
            const docRef = await addDoc(collection(db, collName), safeData);
            return docRef.id;
        } catch (error) {
            console.error(`Error agregando a ${collName}:`, error);
            throw error;
        }
    },

    async update(collName, id, data) {
        try {
            const docRef = doc(db, collName, id);
            const safeData = sanitize({ ...data, updatedAt: new Date() });
            await updateDoc(docRef, safeData);
        } catch (error) {
            console.error(`Error actualizando ${id}:`, error);
            throw error;
        }
    },

    async delete(collName, id) {
        try {
            await deleteDoc(doc(db, collName, id));
        } catch (error) {
            console.error(`Error eliminando ${id}:`, error);
            throw error;
        }
    },

    // --- UTILIDADES ---

    async fetchStockList() {
        try {
            const response = await fetch('./stock.json');
            if (response.ok) {
                const data = await response.json();
                return data.items || [];
            }
        } catch (e) {
            console.log("Usando lista vacía (stock.json no encontrado).");
        }
        return [];
    },

    async generateBackupJSON() {
        const collections = ['tasks', 'notes', 'orders', 'deliveries', 'procedures', 'scripts'];
        const backup = {};
        for (const col of collections) {
            try {
                const snapshot = await getDocs(collection(db, col));
                backup[col] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) { backup[col] = []; }
        }
        return backup;
    }
};
