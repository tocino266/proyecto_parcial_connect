/**
 * Lógica del Módulo 3: Tablero de Cocina
 * Lee de localStorage, filtra los pedidos pertinentes y permite cambiar estados.
 */

const KEY_PEDIDOS = 'sc_pedidos';
let pedidosCocina = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log("Módulo de Cocina Inicializado");
    
    // Asignar eventos a los filtros
    document.getElementById('filtroEstado').addEventListener('change', renderizarTickets);
    document.getElementById('filtroPrioridad').addEventListener('change', renderizarTickets);
    
    // Carga inicial
    cargarPedidosCocina();
    // Actualizar la vista automáticamente cada 15 segundos por si entran nuevos pedidos
    setInterval(cargarPedidosCocina, 15000); 
});

// Cargar pedidos desde el LocalStorage
// Cargar pedidos desde el LocalStorage
function cargarPedidosCocina() {
    const todosLosPedidos = JSON.parse(localStorage.getItem(KEY_PEDIDOS) || '[]');
    
    // REGLA ACTUALIZADA: Ahora permitimos ver los que están listos para servir
    pedidosCocina = todosLosPedidos.filter(p => 
        p.estado === 'Enviado a cocina' || 
        p.estado === 'En preparación' ||
        p.estado === 'Listo para servir'
    );
    
    // Ordenar: Los urgentes primero, luego por fecha (los más antiguos primero)
    pedidosCocina.sort((a, b) => {
        if (a.prioridad === 'Urgente' && b.prioridad !== 'Urgente') return -1;
        if (b.prioridad === 'Urgente' && a.prioridad !== 'Urgente') return 1;
        return new Date(a.fecha) - new Date(b.fecha); 
    });

    renderizarTickets();
}

// Renderizar las tarjetas (Tickets) en el HTML
function renderizarTickets() {
    const contenedor = document.getElementById('contenedor-tickets');
    const noOrders = document.getElementById('noOrders');
    
    const fEstado = document.getElementById('filtroEstado').value;
    const fPrioridad = document.getElementById('filtroPrioridad').value;

    // Aplicar filtros visuales
    // 1. Borra el bloque viejo y pega este nuevo:
    const pedidosFiltrados = pedidosCocina.filter(p => {
        // Filtro de Estado
        let pasaEstado = (fEstado === 'todos') ? true : p.estado === fEstado;
        
        // Filtro de Prioridad (Ajustado a tu HTML con value="")
        const valorFiltroP = fPrioridad.toLowerCase();
        const valorPedidoP = (p.prioridad || "").toLowerCase();
        
        // Si fPrioridad es "" (valor de "Todas" en tu HTML), deja pasar todo
        let pasaPrioridad = (fPrioridad === "") ? true : valorPedidoP === valorFiltroP;
        
        return pasaEstado && pasaPrioridad;
    });

    // 2. Esto se queda igual que antes:
    if (pedidosFiltrados.length === 0) {
        contenedor.innerHTML = '';
        noOrders.classList.remove('oculto');
        return;
    }

    noOrders.classList.add('oculto');
    

    // Construir el HTML de cada Ticket
    let html = '';
    pedidosFiltrados.forEach(pedido => {
        
        const esUrgente = pedido.prioridad === 'Urgente';
        const claseUrgente = esUrgente ? 'prioridad-urgente' : '';
        const justificacionHtml = esUrgente ? `<div class="urgente-alerta">⚠ URGENTE: ${pedido.justificacion}</div>` : '';
        
        // Calcular tiempo estimado total del pedido (el mayor tiempo de los platos)
        let tiempoEstimado = 0;
        if(pedido.platos && pedido.platos.length > 0) {
           tiempoEstimado = Math.max(...pedido.platos.map(plato => plato.tiempo || 0));
        }

        // Esto toma lo que envió tu compañero y lo "traduce" para que el Profe vea "Pendiente"
        let estadoParaMostrar = pedido.estado === 'Enviado a cocina' ? 'Pendiente' : pedido.estado;
        // Construir la lista de platos del ticket
        // Construir la lista de platos del ticket
        let platosHtml = '<ul class="platos-lista">';
        pedido.platos.forEach((plato, indexPlato) => { // Agregamos indexPlato
            
            const obsHtml = plato.obs ? `<div class="plato-obs">🗣 Nota: ${plato.obs}</div>` : '';
            
            let alergenosHtml = '';
            if (plato.alergenos && plato.alergenos.length > 0) {
                alergenosHtml = `<div class="plato-alergenos">
                    <span>☣ Alérgenos:</span> ${plato.alergenos.join(', ')}
                </div>`;
            }

            // --- MEJORA: Selector de estado por plato ---
            // Si el plato no tiene estado, por defecto es 'Pendiente'
            const estadoPlato = plato.estado || 'Pendiente';
            
            platosHtml += `
                <li class="plato-item">
                    <div class="plato-header">
                        <span>${plato.nombre}</span>
                        <span class="plato-cant">x${plato.cantidad}</span>
                    </div>
                    <div class="plato-control-estado">
                        <select class="select-plato-estado ${estadoPlato.replace(/ /g, '-').toLowerCase()}" 
                                onchange="cambiarEstadoPlato('${pedido.codigo}', ${indexPlato}, this.value)">
                            <option value="Pendiente" ${estadoPlato === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                            <option value="En preparación" ${estadoPlato === 'En preparación' ? 'selected' : ''}>🔥 En preparación</option>
                            <option value="Listo" ${estadoPlato === 'Listo' ? 'selected' : ''}>✅ Listo</option>
                        </select>
                    </div>
                    ${obsHtml}
                    ${alergenosHtml}
                </li>
            `;
        });
        platosHtml += '</ul>';

        // Lógica de los botones según estado actual (REGLA: transiciones de estado)
        let botonesHtml = '';
        let claseBadge = '';
        let textoParaMostrar = pedido.estado === 'Enviado a cocina' ? 'Pendiente' : pedido.estado;

        if (pedido.estado === 'Enviado a cocina') {
            claseBadge = 'estado-enviado';
            // Verificamos si ya pusiste los platos en preparación arriba
            const listosParaEmpezar = pedido.platos.every(plato => plato.estado === 'En preparation');
            
            botonesHtml = `<button class="btn-accion btn-preparar" 
                onclick="cambiarEstadoPedido('${pedido.codigo}', 'En preparación')">
                Confirmar Inicio de Cocina
            </button>`;
        } else if (pedido.estado === 'En preparación') {
            claseBadge = 'estado-preparacion';
            
            // Verificamos si todos los platos están listos para decidir qué botón mostrar
            const faltanPlatos = pedido.platos.some(plato => plato.estado !== 'Listo');
            
            if (faltanPlatos) {
                // Botón bloqueado visualmente
                botonesHtml = `<button class="btn-accion" style="background-color: #ccc; cursor: not-allowed;" onclick="alert('Debes terminar todos los platos primero')">Faltan platos por terminar</button>`;
            } else {
                // Botón activo
                botonesHtml = `<button class="btn-accion btn-listo" onclick="cambiarEstadoPedido('${pedido.codigo}', 'Listo para servir')">✓ Todo listo para Servir</button>`;
            }
        } else if (pedido.estado === 'Listo para servir') {
            claseBadge = 'estado-listo';
            botonesHtml = `<div style="text-align: center; color: var(--color-verde-oscuro); font-weight: bold; padding: 0.8rem; background-color: #f0fdf4; border-radius: 6px;">¡Esperando recojo del mozo!</div>`;
        }

        // Ensamblar el ticket
        html += `
            <div class="ticket ${claseUrgente}">
                ${justificacionHtml}
                <div class="ticket-header">
                    <h3>${pedido.codigo}</h3>
                    <div class="mesa-badge">Mesa ${pedido.mesa}</div>
                </div>
                <div class="ticket-info">
                    <div>🧑‍🍳 Mozo: <strong>${pedido.mozo}</strong></div>
                    <div>⏱ Tiempo aprox: <strong>${tiempoEstimado} min</strong></div>
                    <div>🚩 Prioridad: <strong>${pedido.prioridad}</strong></div>
                    <div style="grid-column: span 2;">📅 ${pedido.fecha}</div>
                </div>
                <div class="ticket-body">
                    ${platosHtml}
                </div>
                <div class="ticket-footer">
                    <div class="badge-estado ${claseBadge}">Estado: ${textoParaMostrar}</div>
                    ${botonesHtml}
                </div>
            </div>
        `;
    });

    contenedor.innerHTML = html;
}

function cambiarEstadoPedido(codigoPedido, nuevoEstado) {
    const todosLosPedidos = JSON.parse(localStorage.getItem(KEY_PEDIDOS) || '[]');
    const index = todosLosPedidos.findIndex(p => p.codigo === codigoPedido);
    if (index === -1) return;

    let pedido = todosLosPedidos[index];

    // --- VALIDACIÓN 1: Para pasar de PENDIENTE a PREPARACIÓN ---
    if (nuevoEstado === 'En preparación') {
        // Revisamos que NINGÚN plato esté en 'Pendiente'
        const hayPlatosPendientes = pedido.platos.some(plato => (plato.estado || 'Pendiente') === 'Pendiente');
        
        if (hayPlatosPendientes) {
            alert("❌ ¡Espera! Primero debes poner TODOS los platos en 'En preparación' individualmente arriba.");
            return; // Bloquea el botón de abajo
        }
    }

    // --- VALIDACIÓN 2: Para pasar de PREPARACIÓN a LISTO ---
    // Dentro de cambiarEstadoPedido
    if (nuevoEstado === 'Listo para servir') {
        // Regla: Debe haber pasado por cocina (estado actual debe ser 'En preparación')
        if (pedido.estado !== 'En preparación') {
            alert("❌ No se puede marcar como listo un pedido que no está en preparación.");
            return;
        }
        
        // Regla: Todos los platos deben estar listos individualmente
        const todosListos = pedido.platos.every(plato => plato.estado === 'Listo');
        if (!todosListos) {
            alert("❌ Faltan platos por terminar.");
            return;
        }
    }

    // Si pasó las validaciones, actualizamos el estado general
    pedido.estado = nuevoEstado;
    
    // Guardar historial
    const fechaHoraActual = new Date().toLocaleString('es-PE');
    if(!pedido.historial) pedido.historial = [];
    pedido.historial.push({ estado: nuevoEstado, fecha: fechaHoraActual });

    localStorage.setItem(KEY_PEDIDOS, JSON.stringify(todosLosPedidos));
    cargarPedidosCocina();
}

/**
 * REGLA OPCIONAL: Manejo de estados por plato individual
 */
function cambiarEstadoPlato(codigoPedido, indexPlato, nuevoEstado) {
    const todosLosPedidos = JSON.parse(localStorage.getItem(KEY_PEDIDOS) || '[]');
    const indexPedido = todosLosPedidos.findIndex(p => p.codigo === codigoPedido);
    
    if (indexPedido !== -1) {
        const pedido = todosLosPedidos[indexPedido];
        const plato = pedido.platos[indexPlato];
        const estadoAnterior = plato.estado || 'Pendiente';

        // VALIDACIÓN: No saltar de Pendiente a Listo directamente
        if (nuevoEstado === 'Listo' && estadoAnterior === 'Pendiente') {
            alert("❌ El plato debe pasar primero por 'En preparación' antes de marcarlo como 'Listo'.");
            cargarPedidosCocina(); // Refresca para devolver el select a su estado anterior
            return;
        }

        // Si pasa la validación, guardamos
        plato.estado = nuevoEstado;
        localStorage.setItem(KEY_PEDIDOS, JSON.stringify(todosLosPedidos));
        cargarPedidosCocina();
    }
}