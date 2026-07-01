/**
 * script3.js — Tablero de Cocina - Integrado con Supabase
 * Arquitectura real: pedidos (cabecera) + pedido_detalle (ítems) + platos (datos)
 */

let pedidosCocina = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('filtroEstado').addEventListener('change', renderizarTickets);
    document.getElementById('filtroPrioridad').addEventListener('change', renderizarTickets);

    cargarPedidosCocina();

    // ponytail: realtime replaces 15s polling — debounced to batch rapid-fire events
    let _rt = null;
    const recargar = () => { clearTimeout(_rt); _rt = setTimeout(cargarPedidosCocina, 300); };
    window.clienteSupabase
        .channel('cocina-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido_detalle' }, recargar)
        .subscribe();
});

/* ==========================================
   1. CARGAR DATOS DESDE SUPABASE (con join)
   ========================================== */
async function cargarPedidosCocina() {
    const { data, error } = await window.clienteSupabase
        .from('pedidos')
        .select(`
            *,
            pedido_detalle (
                id,
                cantidad,
                precio_unitario,
                subtotal,
                observacion,
                plato:plato_id ( id, codigo, nombre, tiempo_preparacion, alergenos )
            )
        `)
        .in('estado', ['Enviado a cocina', 'En preparación', 'Listo para servir']);

    if (error) {
        console.error("Error al cargar la cocina:", error);
        return;
    }

    pedidosCocina = (data || []).sort((a, b) => {
        const prio = { 'Urgente': 3, 'Alta': 2, 'Normal': 1 };
        if ((prio[b.prioridad] || 0) !== (prio[a.prioridad] || 0))
            return (prio[b.prioridad] || 0) - (prio[a.prioridad] || 0);
        return new Date(a.fecha_hora || a.fecha) - new Date(b.fecha_hora || b.fecha);
    });

    renderizarTickets();
}

/* ==========================================
   2. RENDERIZAR INTERFAZ
   ========================================== */
function renderizarTickets() {
    const contenedor = document.getElementById('contenedor-tickets');
    const noOrders = document.getElementById('noOrders');

    const fEstado = document.getElementById('filtroEstado').value;
    const fPrioridad = document.getElementById('filtroPrioridad').value;

    const pedidosFiltrados = pedidosCocina.filter(p => {
        const pasaEstado = (fEstado === 'todos') ? true : p.estado === fEstado;
        const pasaPrioridad = (!fPrioridad) ? true : (p.prioridad || '').toLowerCase() === fPrioridad.toLowerCase();
        return pasaEstado && pasaPrioridad;
    });

    if (!pedidosFiltrados.length) {
        contenedor.innerHTML = '';
        noOrders.classList.remove('oculto');
        return;
    }

    noOrders.classList.add('oculto');

    let html = '';
    pedidosFiltrados.forEach(pedido => {
        const esUrgente = pedido.prioridad === 'Urgente';
        const claseUrgente = esUrgente ? 'prioridad-urgente' : '';
        const justificacionHtml = esUrgente && pedido.justificacion_prioridad
            ? `<div class="urgente-alerta">⚠ URGENTE: ${escapeHtml(pedido.justificacion_prioridad)}</div>`
            : (esUrgente ? '<div class="urgente-alerta">⚠ URGENTE</div>' : '');

        const detalles = pedido.pedido_detalle || [];

        // Tiempo estimado: máximo de los platos
        let tiempoEstimado = 0;
        detalles.forEach(d => {
            const t = d.plato?.tiempo_preparacion || 0;
            if (t > tiempoEstimado) tiempoEstimado = t;
        });

        let estadoParaMostrar = pedido.estado === 'Enviado a cocina' ? 'Pendiente' : pedido.estado;

        // Lista de platos del pedido
        let platosHtml = '<ul class="platos-lista">';
        detalles.forEach((d, indexDetalle) => {
            const nombre = d.plato ? d.plato.nombre : 'Plato desconocido';
            const alergenos = d.plato?.alergenos || [];
            const alergStr = Array.isArray(alergenos) ? alergenos.join(', ') : '';
            const obsHtml = d.observacion ? `<div class="plato-obs">🗣 Nota: ${escapeHtml(d.observacion)}</div>` : '';
            const alergenosHtml = alergStr ? `<div class="plato-alergenos"><span>☣ Alérgenos:</span> ${escapeHtml(alergStr)}</div>` : '';
            const estadoPlato = d.estado_cocina || 'Pendiente';

            platosHtml += `
                <li class="plato-item">
                    <div class="plato-header">
                        <span>${escapeHtml(nombre)}</span>
                        <span class="plato-cant">x${d.cantidad}</span>
                    </div>
                    <div class="plato-control-estado">
                        <select class="select-plato-estado ${estadoPlato.replace(/ /g, '-').toLowerCase()}"
                                onchange="cambiarEstadoDetalle('${escapeHtml(pedido.codigo)}', '${escapeHtml(d.id)}', this.value)">
                            <option value="Pendiente" ${estadoPlato === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                            <option value="En preparación" ${estadoPlato === 'En preparación' ? 'selected' : ''}>🔥 En preparación</option>
                            <option value="Listo" ${estadoPlato === 'Listo' ? 'selected' : ''}>✅ Listo</option>
                        </select>
                    </div>
                    ${obsHtml}
                    ${alergenosHtml}
                </li>`;
        });
        platosHtml += '</ul>';

        let botonesHtml = '';
        let claseBadge = '';
        const fechaAgradable = new Date(pedido.fecha_hora || pedido.fecha).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });

        if (pedido.estado === 'Enviado a cocina') {
            claseBadge = 'estado-enviado';
            botonesHtml = `<button class="btn-accion btn-preparar" onclick="cambiarEstadoPedido('${escapeHtml(pedido.codigo)}', 'En preparación')">Confirmar Inicio de Cocina</button>`;
        } else if (pedido.estado === 'En preparación') {
            claseBadge = 'estado-preparacion';
            const todosListos = detalles.every(d => d.estado_cocina === 'Listo');
            if (!todosListos) {
                botonesHtml = `<button class="btn-accion" style="background-color:#ccc;cursor:not-allowed;" disabled>Faltan platos por terminar</button>`;
            } else {
                botonesHtml = `<button class="btn-accion btn-listo" onclick="cambiarEstadoPedido('${escapeHtml(pedido.codigo)}', 'Listo para servir')">✓ Todo listo para Servir</button>`;
            }
        } else if (pedido.estado === 'Listo para servir') {
            claseBadge = 'estado-listo';
            botonesHtml = `<div style="text-align:center;color:var(--color-verde-oscuro);font-weight:bold;padding:.8rem;background:#f0fdf4;border-radius:6px;">¡Esperando recojo del mozo!</div>`;
        }

        html += `
            <div class="ticket ${claseUrgente}">
                ${justificacionHtml}
                <div class="ticket-header">
                    <h3>${escapeHtml(pedido.codigo)}</h3>
                    <div class="mesa-badge">Mesa ${pedido.mesa}</div>
                </div>
                <div class="ticket-info">
                    <div>🧑‍🍳 Mozo: <strong>${escapeHtml(pedido.mozo_nombre || 'N/A')}</strong></div>
                    <div>⏱ Tiempo aprox: <strong>${tiempoEstimado} min</strong></div>
                    <div>🚩 Prioridad: <strong>${escapeHtml(pedido.prioridad)}</strong></div>
                    <div style="grid-column:span 2;">📅 ${fechaAgradable}</div>
                </div>
                <div class="ticket-body">${platosHtml}</div>
                <div class="ticket-footer">
                    <div class="badge-estado ${claseBadge}">Estado: ${estadoParaMostrar}</div>
                    ${botonesHtml}
                </div>
            </div>`;
    });
    contenedor.innerHTML = html;
}

/* ==========================================
   3. ACTUALIZACIONES A SUPABASE
   ========================================== */
async function cambiarEstadoPedido(codigoPedido, nuevoEstado) {
    const pedido = pedidosCocina.find(p => p.codigo === codigoPedido);
    if (!pedido) return;

    const detalles = pedido.pedido_detalle || [];

    if (nuevoEstado === 'Listo para servir' && pedido.estado === 'En preparación') {
        const todosListos = detalles.every(d => d.estado_cocina === 'Listo');
        if (!todosListos) {
            alert("❌ Faltan platos por terminar. Todos deben estar en 'Listo'.");
            return;
        }
    }

    const { error } = await window.clienteSupabase
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('codigo', codigoPedido);

    if (error) {
        console.error("Error al actualizar estado:", error);
        alert("Hubo un error de conexión al actualizar el pedido.");
    } else {
        await cargarPedidosCocina();
    }
}

async function cambiarEstadoDetalle(codigoPedido, detalleId, nuevoEstado) {
    const pedido = pedidosCocina.find(p => p.codigo === codigoPedido);
    if (!pedido) return;

    const detalle = (pedido.pedido_detalle || []).find(d => d.id === detalleId);
    if (!detalle) return;

    const estadoAnterior = detalle.estado_cocina || 'Pendiente';
    if (nuevoEstado === 'Listo' && estadoAnterior === 'Pendiente') {
        alert("❌ El plato debe pasar primero por 'En preparación'.");
        renderizarTickets();
        return;
    }

    // Actualizar estado_cocina en pedido_detalle
    const { error } = await window.clienteSupabase
        .from('pedido_detalle')
        .update({ estado_cocina: nuevoEstado })
        .eq('id', detalleId);

    if (error) {
        // Si la columna estado_cocina no existe, actualizar solo en memoria para la UI
        console.warn("Columna estado_cocina no disponible, actualizando en memoria:", error.message);
        detalle.estado_cocina = nuevoEstado;
        renderizarTickets();
    } else {
        await cargarPedidosCocina();
    }
}



