/**
 * Lógica del Módulo 3: Tablero de Cocina - Integrado con Supabase
 */

let pedidosCocina = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('filtroEstado').addEventListener('change', renderizarTickets);
    document.getElementById('filtroPrioridad').addEventListener('change', renderizarTickets);
    
    cargarPedidosCocina();
    // Actualizar la vista automáticamente cada 15 segundos para buscar nuevos pedidos
    setInterval(cargarPedidosCocina, 15000); 
});

/* ==========================================
   1. CARGAR DATOS DESDE SUPABASE
   ========================================== */
async function cargarPedidosCocina() {
    // Usamos clienteSupabase y filtramos los estados que le interesan a cocina
    const { data, error } = await clienteSupabase
        .from('pedidos')
        .select('*')
        .in('estado', ['Enviado a cocina', 'En preparación', 'Listo para servir']);
    
    if (error) {
        console.error("Error al cargar la cocina:", error);
        return;
    }

    pedidosCocina = data.map(p => ({
        ...p,
        platos: typeof p.platos === 'string' ? JSON.parse(p.platos) : p.platos,
        historial: typeof p.historial === 'string' ? JSON.parse(p.historial) : p.historial
    }));
    
    pedidosCocina.sort((a, b) => {
        if (a.prioridad === 'Urgente' && b.prioridad !== 'Urgente') return -1;
        if (b.prioridad === 'Urgente' && a.prioridad !== 'Urgente') return 1;
        return new Date(a.fecha) - new Date(b.fecha); 
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
        let pasaEstado = (fEstado === 'todos') ? true : p.estado === fEstado;
        const valorFiltroP = fPrioridad.toLowerCase();
        const valorPedidoP = (p.prioridad || "").toLowerCase();
        let pasaPrioridad = (fPrioridad === "") ? true : valorPedidoP === valorFiltroP;
        
        return pasaEstado && pasaPrioridad;
    });

    if (pedidosFiltrados.length === 0) {
        contenedor.innerHTML = '';
        noOrders.classList.remove('oculto');
        return;
    }

    noOrders.classList.add('oculto');
    
    let html = '';
    pedidosFiltrados.forEach(pedido => {
        const esUrgente = pedido.prioridad === 'Urgente';
        const claseUrgente = esUrgente ? 'prioridad-urgente' : '';
        const justificacionHtml = esUrgente ? `<div class="urgente-alerta">⚠ URGENTE: ${pedido.justificacion}</div>` : '';
        
        let tiempoEstimado = 0;
        if(pedido.platos && pedido.platos.length > 0) {
           tiempoEstimado = Math.max(...pedido.platos.map(plato => plato.tiempo || 0));
        }

        let estadoParaMostrar = pedido.estado === 'Enviado a cocina' ? 'Pendiente' : pedido.estado;
        
        let platosHtml = '<ul class="platos-lista">';
        pedido.platos.forEach((plato, indexPlato) => {
            const obsHtml = plato.obs ? `<div class="plato-obs">🗣 Nota: ${plato.obs}</div>` : '';
            let alergenosHtml = '';
            if (plato.alergenos && plato.alergenos.length > 0) {
                alergenosHtml = `<div class="plato-alergenos"><span>☣ Alérgenos:</span> ${plato.alergenos.join(', ')}</div>`;
            }
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

        let botonesHtml = '';
        let claseBadge = '';

        if (pedido.estado === 'Enviado a cocina') {
            claseBadge = 'estado-enviado';
            botonesHtml = `<button class="btn-accion btn-preparar" onclick="cambiarEstadoPedido('${pedido.codigo}', 'En preparación')">Confirmar Inicio de Cocina</button>`;
        } else if (pedido.estado === 'En preparación') {
            claseBadge = 'estado-preparacion';
            const faltanPlatos = pedido.platos.some(plato => plato.estado !== 'Listo');
            if (faltanPlatos) {
                botonesHtml = `<button class="btn-accion" style="background-color: #ccc; cursor: not-allowed;" onclick="alert('Debes terminar todos los platos primero')">Faltan platos por terminar</button>`;
            } else {
                botonesHtml = `<button class="btn-accion btn-listo" onclick="cambiarEstadoPedido('${pedido.codigo}', 'Listo para servir')">✓ Todo listo para Servir</button>`;
            }
        } else if (pedido.estado === 'Listo para servir') {
            claseBadge = 'estado-listo';
            botonesHtml = `<div style="text-align: center; color: var(--color-verde-oscuro); font-weight: bold; padding: 0.8rem; background-color: #f0fdf4; border-radius: 6px;">¡Esperando recojo del mozo!</div>`;
        }

        const fechaAgradable = new Date(pedido.fecha).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });

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
                    <div style="grid-column: span 2;">📅 ${fechaAgradable}</div>
                </div>
                <div class="ticket-body">
                    ${platosHtml}
                </div>
                <div class="ticket-footer">
                    <div class="badge-estado ${claseBadge}">Estado: ${estadoParaMostrar}</div>
                    ${botonesHtml}
                </div>
            </div>
        `;
    });
    contenedor.innerHTML = html;
}

/* ==========================================
   3. ACTUALIZACIONES A SUPABASE
   ========================================== */
async function cambiarEstadoPedido(codigoPedido, nuevoEstado) {
    const pedido = pedidosCocina.find(p => p.codigo === codigoPedido);
    if (!pedido) return;

    if (nuevoEstado === 'En preparación') {
        const hayPlatosPendientes = pedido.platos.some(plato => (plato.estado || 'Pendiente') === 'Pendiente');
        if (hayPlatosPendientes) {
            alert("❌ ¡Espera! Primero debes poner TODOS los platos en 'En preparación' individualmente arriba.");
            return; 
        }
    }

    if (nuevoEstado === 'Listo para servir') {
        if (pedido.estado !== 'En preparación') {
            alert("❌ No se puede marcar como listo un pedido que no está en preparación.");
            return;
        }
        const todosListos = pedido.platos.every(plato => plato.estado === 'Listo');
        if (!todosListos) {
            alert("❌ Faltan platos por terminar.");
            return;
        }
    }

    const fechaISO = new Date().toISOString();
    const nuevoHistorial = [...pedido.historial, { estado: nuevoEstado, fecha: fechaISO }];

    const { error } = await clienteSupabase
        .from('pedidos')
        .update({ estado: nuevoEstado, historial: nuevoHistorial })
        .eq('codigo', codigoPedido);

    if (error) alert("Hubo un error de conexión.");
    else await cargarPedidosCocina(); 
}

async function cambiarEstadoPlato(codigoPedido, indexPlato, nuevoEstado) {
    const pedido = pedidosCocina.find(p => p.codigo === codigoPedido);
    if (!pedido) return;

    const plato = pedido.platos[indexPlato];
    const estadoAnterior = plato.estado || 'Pendiente';

    if (nuevoEstado === 'Listo' && estadoAnterior === 'Pendiente') {
        alert("❌ El plato debe pasar primero por 'En preparación' antes de marcarlo como 'Listo'.");
        renderizarTickets(); 
        return;
    }

    pedido.platos[indexPlato].estado = nuevoEstado;

    const { error } = await clienteSupabase
        .from('pedidos')
        .update({ platos: pedido.platos })
        .eq('codigo', codigoPedido);

    if (error) alert("Hubo un error de conexión al actualizar el plato.");
    else await cargarPedidosCocina(); 
}