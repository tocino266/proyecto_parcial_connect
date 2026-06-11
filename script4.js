/* =======================================================
   MÓDULO 4: FACTURACIÓN - INTEGRADO CON SUPABASE
   Estructura real de tabla facturas:
   id, codigo, pedido_id, mesa, subtotal, descuento,
   justificacion_descuento, total, metodo_pago,
   monto_recibido, vuelto, estado, fecha_pago
   ======================================================= */

let subtotalGeneral = 0;
const tasaIGV = 0.18;
let totalFinalCalculado = 0;
let estadoCuenta = 'Pendiente de pago';
let pedidosMesaActual = [];

const resumenConsumo = document.getElementById('resumen-consumo');
const tablaCuerpo = document.getElementById('tabla-pedidos-body');
const txtSubtotal = document.getElementById('txt-subtotal');
const txtIgv = document.getElementById('txt-igv');
const inputDescuento = document.getElementById('input-descuento');
const txtTotal = document.getElementById('txt-total');
const txtJustificacion = document.getElementById('txt-justificacion');
const selectMetodo = document.getElementById('select-metodo');
const inputMontoRecibido = document.getElementById('monto-recibido');
const btnConfirmar = document.getElementById('btn-confirmar-pago');
const listaFacturasContenedor = document.getElementById('lista-facturas');

document.addEventListener('DOMContentLoaded', () => {
    inputDescuento.addEventListener('input', calcularTotalFinal);
    document.getElementById('btn-buscar-pedidos').addEventListener('click', buscarPedidosMesa);
    selectMetodo.addEventListener('change', manejarMetodoPago);
    inputMontoRecibido.addEventListener('input', calcularVuelto);
    renderizarHistorial();
});

/* ==========================================
   1. BUSCAR PEDIDOS EN SUPABASE
   ========================================== */
async function buscarPedidosMesa() {
    const mesaABuscar = parseInt(document.getElementById('mesa-input').value);
    if (!mesaABuscar || mesaABuscar < 1) {
        alert("Ingrese un número de mesa válido.");
        return;
    }

    const { data, error } = await window.clienteSupabase
        .from('pedidos')
        .select(`
            *,
            pedido_detalle (
                id, cantidad, precio_unitario, subtotal, observacion,
                plato:plato_id ( id, codigo, nombre )
            )
        `)
        .eq('mesa', mesaABuscar)
        .neq('estado', 'Cancelado')
        .neq('estado', 'Facturado');

    if (error) {
        console.error("Error al buscar mesa:", error);
        alert("Error de conexión al buscar los pedidos de la mesa.");
        return;
    }

    if (!data || data.length === 0) {
        alert("No hay pedidos pendientes de pago para la Mesa " + mesaABuscar + ".");
        resumenConsumo.classList.add('hidden');
        return;
    }

    const aunEnCocina = data.some(p => p.estado === 'Enviado a cocina' || p.estado === 'En preparación');
    if (aunEnCocina) {
        alert("❌ No se puede facturar: Hay pedidos aún en Cocina. Espera a que estén listos.");
        resumenConsumo.classList.add('hidden');
        return;
    }

    pedidosMesaActual = data;

    // Construir lista de ítems desde pedido_detalle
    let listaParaTabla = [];
    pedidosMesaActual.forEach(p => {
        (p.pedido_detalle || []).forEach(d => {
            listaParaTabla.push({
                codigo: d.plato?.codigo || '-',
                nombre: d.plato?.nombre || 'Plato',
                cant: d.cantidad,
                precio: parseFloat(d.precio_unitario || 0),
                obs: d.observacion || '-',
                mozo: p.mozo_nombre || p.mozo_id?.substring(0, 8) || 'N/A'
            });
        });
    });

    estadoCuenta = 'Pendiente de pago';
    desbloquearEdicion();
    renderizarPedidos(listaParaTabla);
}


/* ==========================================
   2. RENDERIZAR TABLA DE CONSUMO
   ========================================== */
function renderizarPedidos(lista) {
    tablaCuerpo.innerHTML = '';
    subtotalGeneral = 0;
    lista.forEach(item => {
        const sub = item.cant * item.precio;
        subtotalGeneral += sub;
        tablaCuerpo.innerHTML += `<tr><td>${item.codigo}</td><td>${item.nombre}</td><td>${item.cant}</td><td>S/ ${parseFloat(item.precio).toFixed(2)}</td><td>S/ ${sub.toFixed(2)}</td><td>${item.obs}</td><td>${item.mozo}</td></tr>`;
    });
    resumenConsumo.classList.remove('hidden');
    calcularTotalFinal();
}

/* ==========================================
   3. CÁLCULOS
   ========================================== */
function calcularTotalFinal() {
    if (estadoCuenta === 'Pagada') return;

    let descuento = parseFloat(inputDescuento.value) || 0;
    if (descuento < 0) { inputDescuento.value = 0; descuento = 0; }
    if (descuento > subtotalGeneral) { inputDescuento.value = subtotalGeneral; descuento = subtotalGeneral; }

    document.getElementById('row-justificacion').classList.toggle('hidden', descuento <= 0);

    const montoIgv = subtotalGeneral * tasaIGV;
    totalFinalCalculado = (subtotalGeneral + montoIgv) - descuento;

    txtSubtotal.textContent = `S/ ${subtotalGeneral.toFixed(2)}`;
    txtIgv.textContent = `S/ ${montoIgv.toFixed(2)}`;
    txtTotal.textContent = `S/ ${totalFinalCalculado.toFixed(2)}`;
    calcularVuelto();
}

/* ==========================================
   4. CONFIRMAR PAGO (SUPABASE)
   ========================================== */
btnConfirmar.addEventListener('click', async () => {
    if (estadoCuenta === 'Pagada') return;

    const descuento = parseFloat(inputDescuento.value) || 0;
    const metodo = selectMetodo.value;
    const montoRecibido = parseFloat(inputMontoRecibido.value) || 0;

    if (!metodo) { alert("Seleccione el método de pago."); return; }
    if (descuento > 0 && txtJustificacion.value.trim().length < 10) {
        alert("La justificación del descuento debe tener al menos 10 caracteres.");
        return;
    }
    if (metodo === 'Efectivo' && montoRecibido < totalFinalCalculado) {
        alert("El monto recibido es insuficiente para cubrir el total de S/ " + totalFinalCalculado.toFixed(2));
        return;
    }

    // Verificar que ningún pedido esté cancelado (doble validación)
    const hayCancelados = pedidosMesaActual.some(p => p.estado === 'Cancelado');
    if (hayCancelados) {
        alert("❌ No se pueden facturar pedidos cancelados.");
        return;
    }

    btnConfirmar.textContent = "Procesando...";
    btnConfirmar.disabled = true;

    // Obtener usuario actual
    const usuario = await window.obtenerUsuarioActual();

    // Número correlativo de factura
    const nroFactura = "FAC-" + String(Date.now()).slice(-6);
    const vueltoCalculado = metodo === 'Efectivo' ? Math.max(0, montoRecibido - totalFinalCalculado) : 0;
    const mesaNum = parseInt(document.getElementById('mesa-input').value);

    // Usar el id del primer pedido como referencia principal (pedido_id)
    const primerPedidoId = pedidosMesaActual[0]?.id || null;

    // A. Guardar Factura en Supabase — usando los nombres reales de columnas
    const nuevaFactura = {
        codigo: nroFactura,
        pedido_id: primerPedidoId,
        mesa: mesaNum,
        subtotal: parseFloat(subtotalGeneral.toFixed(2)),
        descuento: descuento,
        justificacion_descuento: descuento > 0 ? txtJustificacion.value.trim() : null,
        total: parseFloat(totalFinalCalculado.toFixed(2)),
        metodo_pago: metodo,
        monto_recibido: metodo === 'Efectivo' ? montoRecibido : parseFloat(totalFinalCalculado.toFixed(2)),
        vuelto: metodo === 'Efectivo' ? vueltoCalculado : 0,
        estado: 'Pagada',
        fecha_pago: new Date().toISOString()
    };

    const { error: errFactura } = await window.clienteSupabase.from('facturas').insert([nuevaFactura]);

    if (errFactura) {
        console.error("Error al generar la factura:", errFactura);
        alert("Error al generar la factura en la base de datos.\nDetalle: " + errFactura.message);
        btnConfirmar.textContent = "Confirmar Pago";
        btnConfirmar.disabled = false;
        return;
    }

    // B. Actualizar todos los pedidos de la mesa a "Facturado"
    let errorActualizacion = false;
    for (let actual of pedidosMesaActual) {

        const { error: errUpdate } = await window.clienteSupabase
            .from('pedidos')
            .update({ estado: 'Facturado' })
            .eq('codigo', actual.codigo);

        if (errUpdate) {
            console.error("Error al actualizar pedido:", actual.codigo, errUpdate);
            errorActualizacion = true;
        }
    }

    if (errorActualizacion) {
        alert("⚠ La factura se generó pero hubo un error al actualizar el estado de algunos pedidos.");
    } else {
        alert(`¡Cuenta PAGADA con éxito!\nFactura: ${nroFactura}\nTotal cobrado: S/ ${totalFinalCalculado.toFixed(2)}`);
    }

    estadoCuenta = 'Pagada';
    bloquearEdicion();
    pedidosMesaActual = [];
    await renderizarHistorial();
});

/* ==========================================
   5. GESTIÓN DE HISTORIAL (SUPABASE)
   ========================================== */
async function renderizarHistorial() {
    const { data, error } = await window.clienteSupabase
        .from('facturas')
        .select('*')
        .order('fecha_pago', { ascending: false });  // columna real: fecha_pago

    if (error) {
        console.error("Error al cargar historial:", error);
        listaFacturasContenedor.innerHTML = "<p>Error al cargar el historial de facturas.</p>";
        return;
    }

    if (!data || data.length === 0) {
        listaFacturasContenedor.innerHTML = "<p>No hay facturas emitidas aún.</p>";
        return;
    }

    listaFacturasContenedor.innerHTML = data.map(f => {
        // Usar fecha_pago que es el nombre real de columna en la tabla
        const fechaRaw = f.fecha_pago || f.fecha || f.created_at;
        const fechaAgradable = fechaRaw
            ? new Date(fechaRaw).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
            : 'Sin fecha';

        return `
        <div class="factura-card">
            <h4>${f.codigo || f.nro || 'Sin código'}</h4>
            <p><strong>Mesa:</strong> ${f.mesa}</p>
            <p><strong>Subtotal:</strong> S/ ${parseFloat(f.subtotal || 0).toFixed(2)}</p>
            <p><strong>Total:</strong> S/ ${parseFloat(f.total).toFixed(2)}</p>
            <p><strong>Pago:</strong> ${f.metodo_pago || f.metodo || '-'}</p>
            ${f.descuento > 0 ? `<p><strong>Descuento:</strong> S/ ${parseFloat(f.descuento).toFixed(2)}</p>` : ''}
            ${f.monto_recibido ? `<p><strong>Recibido:</strong> S/ ${parseFloat(f.monto_recibido).toFixed(2)}</p>` : ''}
            ${f.vuelto > 0 ? `<p><strong>Vuelto:</strong> S/ ${parseFloat(f.vuelto).toFixed(2)}</p>` : ''}
            <p><strong>Estado:</strong> ${f.estado || 'Pagada'}</p>
            <small>${fechaAgradable}</small>
        </div>`;
    }).join('');
}

/* ==========================================
   6. UTILIDADES DE UI
   ========================================== */
function bloquearEdicion() {
    inputDescuento.disabled = true; selectMetodo.disabled = true;
    inputMontoRecibido.disabled = true; txtJustificacion.disabled = true;
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = "CUENTA PAGADA ✓";
    btnConfirmar.style.backgroundColor = "#95a5a6";
}

function desbloquearEdicion() {
    inputDescuento.value = 0;
    selectMetodo.value = '';
    inputMontoRecibido.value = '';
    txtJustificacion.value = '';
    inputDescuento.disabled = false; selectMetodo.disabled = false;
    inputMontoRecibido.disabled = false; txtJustificacion.disabled = false;
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Confirmar Pago";
    btnConfirmar.style.backgroundColor = "";
    document.getElementById('efectivo-details').classList.add('hidden');
    document.getElementById('row-justificacion').classList.add('hidden');
}

function manejarMetodoPago() {
    document.getElementById('efectivo-details').classList.toggle('hidden', selectMetodo.value !== 'Efectivo');
    calcularVuelto();
}

function calcularVuelto() {
    const recibido = parseFloat(inputMontoRecibido.value) || 0;
    const vuelto = recibido - totalFinalCalculado;
    document.getElementById('txt-vuelto').textContent = `S/ ${vuelto > 0 ? vuelto.toFixed(2) : '0.00'}`;
}