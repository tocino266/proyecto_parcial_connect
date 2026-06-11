/**
 * script.js — Lógica base del Home de San Choclito
 * Los datos del sistema (platos, pedidos, facturas) se almacenan
 * exclusivamente en Supabase. No se usa localStorage para datos del sistema.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Sistema San Choclito inicializado.");
    resaltarPestanaActiva();
    await mostrarBienvenida();
});

/**
 * Muestra el nombre y rol del usuario autenticado en la sección de bienvenida del Home.
 * Los datos se obtienen directamente desde la sesión de Supabase Auth (sin localStorage).
 */
async function mostrarBienvenida() {
    const usuario = await window.obtenerUsuarioActual();
    if (!usuario) return;

    const banner = document.getElementById('bienvenida-banner');
    const nombreEl = document.getElementById('usuario-nombre');
    const rolEl = document.getElementById('usuario-rol');

    if (nombreEl) nombreEl.textContent = usuario.nombre;
    if (rolEl) rolEl.textContent = usuario.rol;
    if (banner) banner.style.display = 'block';

    // Mostrar botón de admin si el rol es administrador
    if (usuario.rol === 'admin' || usuario.rol === 'Administrador' || usuario.rol === 'administrador') {
        const adminActions = document.getElementById('admin-actions');
        if (adminActions) adminActions.style.display = 'block';
    }
}

/**
 * Añade clase visual 'activa' al enlace de navegación de la página actual.
 */
function resaltarPestanaActiva() {
    const enlaces = document.querySelectorAll('.nav-btn');
    const urlActual = window.location.pathname;

    enlaces.forEach(enlace => {
        if (urlActual.includes(enlace.getAttribute('href'))) {
            enlace.style.backgroundColor = 'var(--color-verde-oscuro)';
            enlace.style.color = 'var(--color-blanco)';
        }
    });
}

/**
 * Borra TODOS los datos del sistema de las tablas: facturas, pedido_detalle, pedidos y platos.
 * Esta acción es exclusiva para administradores.
 */
async function borrarTodoSistema() {
    const confirmacion1 = confirm("⚠️ ADVERTENCIA ⚠️\n\n¿Estás SEGURO de que deseas borrar ABSOLUTAMENTE TODOS los platos, pedidos y facturas del sistema?");
    if (!confirmacion1) return;

    const confirmacion2 = confirm("ESTA ACCIÓN ES IRREVERSIBLE.\n\nEl sistema quedará completamente en blanco.\n¿Realmente deseas continuar?");
    if (!confirmacion2) return;

    const btn = document.getElementById('btn-borrar-todo');
    const btnText = btn.textContent;
    btn.textContent = "Borrando sistema... Por favor espera...";
    btn.disabled = true;

    try {
        // Orden de borrado para respetar las llaves foráneas:
        // 1. facturas (depende de pedidos)
        // 2. pedido_detalle (depende de pedidos y platos)
        // 3. pedidos 
        // 4. platos

        // Borrar facturas
        await window.clienteSupabase.from('facturas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        // Borrar pedido_detalle
        await window.clienteSupabase.from('pedido_detalle').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // Borrar pedidos
        await window.clienteSupabase.from('pedidos').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // Borrar platos
        await window.clienteSupabase.from('platos').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        alert("✅ SISTEMA BORRADO EXITOSAMENTE.\n\nTodas las tablas de operación han sido vaciadas.\n(Las cuentas de usuario y perfiles se mantienen).");
        window.location.reload();

    } catch (error) {
        console.error("Error al borrar el sistema:", error);
        alert("Hubo un error al intentar vaciar la base de datos. Revisa la consola para más detalles.");
        btn.textContent = btnText;
        btn.disabled = false;
    }
}