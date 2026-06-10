/* =======================================================
   MÓDULO 4: FACTURACIÓN - VERSIÓN FINAL UNIFICADA
   ======================================================= */

// LLAVES DE LOCALSTORAGE
const KEY_PEDIDOS = 'sc_pedidos'; // La misma de tu compañera
const KEY_FACTURAS = 'sc_historial_facturas'; // Para tus facturas recientes

let subtotalGeneral = 0;
const tasaIGV = 0.18;
let totalFinalCalculado = 0;
let estadoCuenta = 'Pendiente de pago';
let pedidosMesaActual = []; 

// Elementos del DOM
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

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    inputDescuento.addEventListener('input', calcularTotalFinal);
    document.getElementById('btn-buscar-pedidos').addEventListener('click', buscarPedidosMesa);
    selectMetodo.addEventListener('change', manejarMetodoPago);
    inputMontoRecibido.addEventListener('input', calcularVuelto);
    
    // Cargar historial apenas abra la página
    renderizarHistorial();
});

// 1. BUSCAR PEDIDOS REALES (CON VALIDACIÓN DE COCINA)
function buscarPedidosMesa() {
    const mesaABuscar = parseInt(document.getElementById('mesa-input').value);
    if (!mesaABuscar) return alert("Ingrese un número de mesa.");

    const todosLosPedidos = JSON.parse(localStorage.getItem(KEY_PEDIDOS) || '[]');
    
    // Filtramos los pedidos de la mesa que no estén cancelados ni facturados
    const pedidosEncontrados = todosLosPedidos.filter(p => 
        p.mesa === mesaABuscar && 
        p.estado !== 'Cancelado' && 
        p.estado !== 'Facturado'
    );

    if (pedidosEncontrados.length === 0) {
        alert("No hay pedidos pendientes para la Mesa " + mesaABuscar);
        resumenConsumo.classList.add('hidden');
        return;
    }

    // --- VALIDACIÓN DE COCINA (REQUISITO PARCIAL) ---
    // Si algún pedido está en cocina o preparación, bloqueamos la facturación
    const aunEnCocina = pedidosEncontrados.some(p => 
        p.estado === 'Enviado a cocina' || p.estado === 'En preparación'
    );

    if (aunEnCocina) {
        alert("❌ No se puede facturar: Hay pedidos de esta mesa que aún están siendo procesados en Cocina.");
        resumenConsumo.classList.add('hidden');
        return;
    }
    // ------------------------------------------------

    pedidosMesaActual = pedidosEncontrados;

    let listaParaTabla = [];
    pedidosMesaActual.forEach(p => {
        p.platos.forEach(plato => {
            listaParaTabla.push({
                codigo: plato.codigo,
                nombre: plato.nombre,
                cant: plato.cantidad,
                precio: plato.precio,
                obs: plato.obs || '-', // <--- AGREGA ESTO
                mozo: p.mozo
            });
        });
    });

    estadoCuenta = 'Pendiente de pago';
    desbloquearEdicion(); 
    renderizarPedidos(listaParaTabla);
}

// 2. RENDERIZAR TABLA DE CONSUMO
function renderizarPedidos(lista) {
    tablaCuerpo.innerHTML = '';
    subtotalGeneral = 0;
    lista.forEach(item => {
        const sub = item.cant * item.precio;
        subtotalGeneral += sub;
        tablaCuerpo.innerHTML += `<tr><td>${item.codigo}</td><td>${item.nombre}</td><td>${item.cant}</td><td>S/ ${item.precio.toFixed(2)}</td><td>S/ ${sub.toFixed(2)}</td><td>${item.obs || '-'}</td><td>${item.mozo}</td></tr>`;
    });
    resumenConsumo.classList.remove('hidden');
    calcularTotalFinal();
}

// 3. CÁLCULOS
function calcularTotalFinal() {
    if (estadoCuenta === 'Pagada') return;

    let descuento = parseFloat(inputDescuento.value) || 0;
    if (descuento < 0 || descuento > subtotalGeneral) {
        inputDescuento.value = 0;
        descuento = 0;
    }

    document.getElementById('row-justificacion').classList.toggle('hidden', descuento <= 0);

    const montoIgv = subtotalGeneral * tasaIGV;
    totalFinalCalculado = (subtotalGeneral + montoIgv) - descuento;
    
    txtSubtotal.textContent = `S/ ${subtotalGeneral.toFixed(2)}`;
    txtIgv.textContent = `S/ ${montoIgv.toFixed(2)}`;
    txtTotal.textContent = `S/ ${totalFinalCalculado.toFixed(2)}`;
    calcularVuelto();
}

// 4. CONFIRMAR PAGO
btnConfirmar.addEventListener('click', () => {
    if (estadoCuenta === 'Pagada') return;

    const descuento = parseFloat(inputDescuento.value) || 0;
    const metodo = selectMetodo.value;

    if (!metodo) return alert("Seleccione método de pago.");
    if (descuento > 0 && txtJustificacion.value.trim().length < 10) {
        return alert("La justificación debe tener al menos 10 caracteres.");
    }
    if (metodo === 'Efectivo' && (parseFloat(inputMontoRecibido.value) || 0) < totalFinalCalculado) {
        return alert("Monto recibido insuficiente.");
    }

    actualizarEstadoEnStorage();
    guardarFacturaEnHistorial();
    
    estadoCuenta = 'Pagada';
    bloquearEdicion();
    alert("¡Cuenta PAGADA con éxito!");
});

// 5. ACTUALIZAR PEDIDOS (CAMBIO A FACTURADO)
function actualizarEstadoEnStorage() {
    const todosLosPedidos = JSON.parse(localStorage.getItem(KEY_PEDIDOS) || '[]');
    
    pedidosMesaActual.forEach(actual => {
        const index = todosLosPedidos.findIndex(p => p.codigo === actual.codigo);
        if (index !== -1) {
            todosLosPedidos[index].estado = 'Facturado';
            if(!todosLosPedidos[index].historial) todosLosPedidos[index].historial = [];
            todosLosPedidos[index].historial.push({ 
                estado: 'Facturado', 
                fecha: new Date().toLocaleString('es-PE') 
            });
        }
    });

    localStorage.setItem(KEY_PEDIDOS, JSON.stringify(todosLosPedidos));
}

// 6. GESTIÓN DE HISTORIAL
function guardarFacturaEnHistorial() {
    const nuevaFactura = {
        nro: "FAC-" + Math.floor(1000 + Math.random() * 9000),
        mesa: document.getElementById('mesa-input').value,
        total: totalFinalCalculado,
        fecha: new Date().toLocaleString('es-PE'),
        metodo: selectMetodo.value
    };

    const historial = JSON.parse(localStorage.getItem(KEY_FACTURAS) || '[]');
    historial.unshift(nuevaFactura); 
    localStorage.setItem(KEY_FACTURAS, JSON.stringify(historial));

    renderizarHistorial();
}

function renderizarHistorial() {
    const historial = JSON.parse(localStorage.getItem(KEY_FACTURAS) || '[]');

    if (historial.length === 0) {
        listaFacturasContenedor.innerHTML = "<p>No hay facturas emitidas hoy.</p>";
        return;
    }

    listaFacturasContenedor.innerHTML = historial.map(f => `
        <div class="factura-card">
            <h4>${f.nro}</h4>
            <p><strong>Mesa:</strong> ${f.mesa}</p>
            <p><strong>Total:</strong> S/ ${f.total.toFixed(2)}</p>
            <p><strong>Pago:</strong> ${f.metodo}</p>
            <small>${f.fecha}</small>
        </div>
    `).join('');
}

// 7. UTILIDADES DE UI
function bloquearEdicion() {
    inputDescuento.disabled = true;
    selectMetodo.disabled = true;
    inputMontoRecibido.disabled = true;
    txtJustificacion.disabled = true;
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = "CUENTA PAGADA";
    btnConfirmar.style.backgroundColor = "#95a5a6";
}

function desbloquearEdicion() {
    inputDescuento.disabled = false;
    selectMetodo.disabled = false;
    inputMontoRecibido.disabled = false;
    txtJustificacion.disabled = false;
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Confirmar Pago";
    btnConfirmar.style.backgroundColor = ""; 
}

function manejarMetodoPago() {
    document.getElementById('efectivo-details').classList.toggle('hidden', selectMetodo.value !== 'Efectivo');
}

function calcularVuelto() {
    const recibido = parseFloat(inputMontoRecibido.value) || 0;
    const vuelto = recibido - totalFinalCalculado;
    document.getElementById('txt-vuelto').textContent = `S/ ${vuelto > 0 ? vuelto.toFixed(2) : '0.00'}`;
}