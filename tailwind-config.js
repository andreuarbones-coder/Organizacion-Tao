/**
 * Configuración para Tailwind CSS (CDN Version)
 * Define colores personalizados, fuentes y animaciones.
 */
window.tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif']
            },
            colors: {
                theme: {
                    // Colores personalizados del Vivero
                    
                    // SUCURSAL CENTRO (Verdes)
                    centro: '#064e3b',       // Emerald 900
                    centroLight: '#34d399',  // Emerald 400
                    
                    // SUCURSAL EJEMPLARES (Naranjas/Terracota) - ACTUALIZADO
                    ejemplares: '#9a3412',   // Orange 800
                    ejemplaresLight: '#f97316', // Orange 500
                    
                    // UTILIDADES
                    warning: '#f59e0b',
                    danger: '#ef4444'
                }
            },
            animation: {
                'slide-in': 'slideIn 0.3s ease-out forwards',
                'fade-in': 'fadeIn 0.2s ease-out forwards',
            },
            keyframes: {
                slideIn: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(0)' }
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                }
            }
        }
    }
};
