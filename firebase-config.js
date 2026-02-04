// Importamos las funciones desde la CDN (igual que en data-service.js)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- PEGA AQUÍ TUS CREDENCIALES DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBzPiBCgiHoHSp24U7739fj9-htyTA8KiU",
  authDomain: "app-jardin-v4.firebaseapp.com",
  databaseURL: "https://app-jardin-v4-default-rtdb.firebaseio.com",
  projectId: "app-jardin-v4",
  storageBucket: "app-jardin-v4.firebasestorage.app",
  messagingSenderId: "413324369604",
  appId: "1:413324369604:web:f78e3f459725dd824e3391"
};
// ----------------------------------------------

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Iniciar sesión anónima automáticamente (necesario para las nuevas reglas de seguridad)
signInAnonymously(auth)
  .then(() => {
    console.log("Autenticación anónima exitosa");
  })
  .catch((error) => {
    console.error("Error en autenticación anónima:", error);
  });

// Exportamos 'db' para que data-service.js pueda usarlo
export { app, db, auth };
```

2.  **Actualiza tu `index.html` (CRÍTICO):**
    Como ahora estamos usando `import` y `export`, el navegador necesita saber que estos archivos son módulos. Ve a tu `index.html` y busca las líneas donde cargas los scripts. Cámbialas para que tengan `type="module"`.

    Debería verse así (al final del body):
    ```html
    <!-- ... resto del html ... -->
    
    <!-- NOTA EL: type="module" -->
    <script type="module" src="firebase-config.js"></script>
    <script type="module" src="data-service.js"></script>
    <script type="module" src="ui-manager.js"></script>
    
    <script>
        // Pequeño script para iniciar todo una vez cargados los módulos
        window.addEventListener('load', () => {
            // Esperamos un poco para asegurar que los módulos exportaron sus funciones globales
            setTimeout(() => {
                if (window.UIManager) {
                    window.UIManager.init();
                }
            }, 500);
        });
    </script>
    </body>
    </html>
