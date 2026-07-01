// supabase-config.js — San Choclito
// Configuración y funciones globales de Supabase

const supabaseUrl = 'https://ercqnkfvjaqlxevzfaok.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyY3Fua2Z2amFxbHhldnpmYW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDc2OTAsImV4cCI6MjA5NjYyMzY5MH0.SLE60lpRyqJiegjCrZzn510epKCkNILgefWBloyQYBk';

window.clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

// ponytail: XSS prevention — escape user data before innerHTML insertion
window.escapeHtml = function(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
};

// =========================================================
// FUNCIONES DE UTILIDAD DE SESIÓN (sin localStorage)
// =========================================================

/**
 * Obtiene el rol del usuario autenticado directamente desde la sesión de Supabase.
 * No usa localStorage.
 */
window.obtenerRolActual = async function() {
    const { data: { session } } = await window.clienteSupabase.auth.getSession();
    if (!session) return null;
    return session.user.user_metadata?.rol || null;
};

/**
 * Obtiene los datos del usuario autenticado directamente desde la sesión de Supabase.
 * No usa localStorage.
 */
window.obtenerUsuarioActual = async function() {
    const { data: { session } } = await window.clienteSupabase.auth.getSession();
    if (!session) return null;
    return {
        id: session.user.id,
        email: session.user.email,
        nombre: session.user.user_metadata?.nombre || session.user.email,
        rol: session.user.user_metadata?.rol || null
    };
};

// =========================================================
// VERIFICACIÓN DE SESIÓN Y PROTECCIÓN DE RUTAS
// =========================================================
async function verificarSesion() {
    const { data: { session } } = await window.clienteSupabase.auth.getSession();

    let paginaActual = window.location.pathname.split("/").pop() || "index.html";
    paginaActual = paginaActual.split('?')[0].split('#')[0];

    if (!session && paginaActual !== 'auth.html') {
        window.location.href = 'auth.html';
        return;
    }

    if (session) {
        // El rol siempre se lee desde los metadatos de la sesión, NUNCA desde localStorage
        const rol = session.user.user_metadata?.rol;

        if (!rol) {
            alert("Tu cuenta no tiene un rol asignado. Por favor, regístrate de nuevo.");
            await window.cerrarSesion();
            return;
        }

        if (paginaActual === 'auth.html') {
            window.location.href = 'index.html';
            return;
        }

        // Aplicar restricciones de ruta y ocultamiento visual
        validarPermisosRuta(rol, paginaActual);
        forzarOcultamiento(rol);
    }
}

// =========================================================
// 1. BLOQUEO DE RUTAS (Si intentan escribir la URL)
// =========================================================
function validarPermisosRuta(rol, pagina) {
    if (rol === 'Administrador' || pagina === 'index.html' || pagina === '') return;

    // Regla MOZO
    if (rol === 'Mozo' && (pagina === 'cocina.html' || pagina === 'facturacion.html')) {
        window.location.href = 'index.html';
    }
    // Regla COCINA
    if (rol === 'Cocina' && (pagina === 'platos.html' || pagina === 'pedidos.html' || pagina === 'facturacion.html')) {
        window.location.href = 'index.html';
    }
    // Regla CAJA
    if (rol === 'Caja' && (pagina === 'platos.html' || pagina === 'pedidos.html' || pagina === 'cocina.html')) {
        window.location.href = 'index.html';
    }
}

// =========================================================
// 2. INYECCIÓN CSS (Ocultar botones según el rol)
// =========================================================
function forzarOcultamiento(rol) {
    if (rol === 'Administrador') return;

    let reglasCSS = '';

    if (rol === 'Mozo') {
        reglasCSS = `
            a[href*="cocina.html"],
            a[href*="facturacion.html"] {
                display: none !important; visibility: hidden !important; width: 0 !important; pointer-events: none !important;
            }
        `;
    } else if (rol === 'Cocina') {
        reglasCSS = `
            a[href*="platos.html"],
            a[href*="pedidos.html"],
            a[href*="facturacion.html"] {
                display: none !important; visibility: hidden !important; width: 0 !important; pointer-events: none !important;
            }
        `;
    } else if (rol === 'Caja') {
        reglasCSS = `
            a[href*="platos.html"],
            a[href*="pedidos.html"],
            a[href*="cocina.html"] {
                display: none !important; visibility: hidden !important; width: 0 !important; pointer-events: none !important;
            }
        `;
    }

    if (reglasCSS !== '') {
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = reglasCSS;
        document.head.appendChild(styleSheet);

        document.querySelectorAll('.nav-links li a').forEach(link => {
            const href = link.getAttribute('href') || '';

            if (rol === 'Mozo' && (href.includes('cocina.html') || href.includes('facturacion.html'))) {
                if (link.parentElement) link.parentElement.style.display = 'none';
            }
            if (rol === 'Cocina' && (href.includes('platos.html') || href.includes('pedidos.html') || href.includes('facturacion.html'))) {
                if (link.parentElement) link.parentElement.style.display = 'none';
            }
            if (rol === 'Caja' && (href.includes('platos.html') || href.includes('pedidos.html') || href.includes('cocina.html'))) {
                if (link.parentElement) link.parentElement.style.display = 'none';
            }
        });
    }
}

// =========================================================
// 3. CERRAR SESIÓN
// =========================================================
window.cerrarSesion = async function() {
    // No se usa localStorage para datos del sistema — solo limpiamos la sesión de Auth
    await window.clienteSupabase.auth.signOut();
    window.location.href = 'auth.html';
};

verificarSesion();