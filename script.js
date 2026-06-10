/**
 * Lógica base para San Choclito
 * Inicializa la base de datos local y maneja interacciones visuales simples en el Home.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Sistema San Choclito inicializado.");
    
    // 1. Inicializar la base de datos requerida por el parcial
    inicializarBaseDatos();

    // 2. Resaltar la pestaña actual en la navegación (útil para cuando expandamos a las otras páginas)
    resaltarPestanaActiva();
});

/**
 * Crea las estructuras vacías en localStorage si no existen.
 * Esto asegura que los módulos de Platos, Pedidos, etc., no fallen al intentar leer datos.
 */
function inicializarBaseDatos() {
    const coleccionesRequeridas = ['platos', 'pedidos', 'facturas'];

    coleccionesRequeridas.forEach(coleccion => {
        if (!localStorage.getItem(coleccion)) {
            localStorage.setItem(coleccion, JSON.stringify([]));
            console.log(`Estructura JSON para '${coleccion}' creada en localStorage.`);
        }
    });
}

/**
 * Función auxiliar para añadir una clase 'activa' al enlace de navegación
 * dependiendo de la URL actual.
 */
function resaltarPestanaActiva() {
    const enlaces = document.querySelectorAll('.nav-btn');
    const urlActual = window.location.pathname;

    enlaces.forEach(enlace => {
        // Si el href del enlace está incluido en la URL actual, lo marcamos
        if (urlActual.includes(enlace.getAttribute('href'))) {
            enlace.style.backgroundColor = 'var(--color-verde-oscuro)';
            enlace.style.color = 'var(--color-blanco)';
        }
    });
}