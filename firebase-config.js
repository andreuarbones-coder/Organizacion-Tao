// Importamos las funciones necesarias (Versión 9.22.0 compatible con data-service.js)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// === TU CONFIGURACIÓN DE FIREBASE (Credenciales Reales) ===
const firebaseConfig = {
    apiKey: "AIzaSyBzPiBCgiHoHSp24U7739fj9-htyTA8KiU",
    authDomain: "app-jardin-v4.firebaseapp.com",
    databaseURL: "https://app-jardin-v4-default-rtdb.firebaseio.com",
    projectId: "app-jardin-v4",
    storageBucket: "app-jardin-v4.firebasestorage.app",
    messagingSenderId: "413324369604",
    appId: "1:413324369604:web:f78e3f459725dd824e3391"
};

// 1. Inicializamos la App
const app = initializeApp(firebaseConfig);

// 2. Inicializamos y EXPORTAMOS los servicios para que los use el resto de la app
export const db = getFirestore(app);
export const auth = getAuth(app);

console.log("Firebase inicializado correctamente: app-jardin-v4");
