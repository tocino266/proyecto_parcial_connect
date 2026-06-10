/* =======================================================
   MÓDULO 4: FACTURACIÓN - INTEGRADO CON SUPABASE
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

// 1. BUSCAR PEDIDOS EN SUPABASE
async function buscarPedidosMesa() {
    const mesaABuscar = parseInt(document.getElementById('mesa-input').value);
    if (!mesaABuscar) return alert("Ingrese un número de mesa.");

    // Buscamos pedidos de esa mesa que NO estén cancelados ni facturados
    const { data, error } = await clienteSupabase
        .from('pedidos')
        .select('*')
        .eq('mesa', mesaABuscar)
        .neq('estado', 'Cancelado')
        .neq('estado', 'Facturado');

    if (error) {
        console.error("Error al buscar mesa:", error);
        return;
    }

    if (!data || data.length === 0) {
        alert("No hay pedidos pendientes para la Mesa " + mesaABuscar);
        resumenConsumo.classList.add('hidden');
        return;
    }

    const aunEnCocina = data.some(p => p.estado === 'Enviado a cocina' || p.estado === 'En preparación');
    if (aunEnCocina) {
        alert("❌ No se puede facturar: Hay pedidos de esta mesa que aún están siendo procesados en Cocina.");
        resumenConsumo.classList.add('hidden');
        return;
    }

    pedidosMesaActual = data.map(p => ({
        ...p,
        platos: typeof p.platos === 'string' ? JSON.parse(p.platos) : p.platos,
        historial: typeof p.historial === 'string' ? JSON.parse(p.historial) : p.historial
    }));

    let listaParaTabla = [];
    pedidosMesaActual.forEach(p => {
        p.platos.forEach(plato => {
            listaParaTabla.push({
                codigo: plato.codigo,
                nombre: plato.nombre,
                cant: plato.cantidad,
                precio: plato.precio,
                obs: plato.obs || '-',
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
        tablaCuerpo.innerHTML += `<tr><td>${item.codigo}</td><td>${item.nombre}</td><td>${item.cant}</td><td>S/ ${parseFloat(item.precio).toFixed(2)}</td><td>S/ ${sub.toFixed(2)}</td><td>${item.obs}</td><td>${item.mozo}</td></tr>`;
    });
    resumenConsumo.classList.remove('hidden');
    calcularTotalFinal();
}

// 3. CÁLCULOS
function calcularTotalFinal() {
    if (estadoCuenta === 'Pagada') return;

    let descuento = parseFloat(inputDescuento.value) || 0;
    if (descuento < 0 || descuento > subtotalGeneral) {
        inputDescuento.value = 0; descuento = 0;
    }

    document.getElementById('row-justificacion').classList.toggle('hidden', descuento <= 0);

    const montoIgv = subtotalGeneral * tasaIGV;
    totalFinalCalculado = (subtotalGeneral + montoIgv) - descuento;
    
    txtSubtotal.textContent = `S/ ${subtotalGeneral.toFixed(2)}`;
    txtIgv.textContent = `S/ ${montoIgv.toFixed(2)}`;
    txtTotal.textContent = `S/ ${totalFinalCalculado.toFixed(2)}`;
    calcularVuelto();
}

// 4. CONFIRMAR PAGO (SUPABASE)
btnConfirmar.addEventListener('click', async () => {
    if (estadoCuenta === 'Pagada') return;

    const descuento = parseFloat(inputDescuento.value) || 0;
    const metodo = selectMetodo.value;

    if (!metodo) return alert("Seleccione método de pago.");
    if (descuento > 0 && txtJustificacion.value.trim().length < 10) return alert("La justificación debe tener al menos 10 caracteres.");
    if (metodo === 'Efectivo' && (parseFloat(inputMontoRecibido.value) || 0) < totalFinalCalculado) return alert("Monto recibido insuficiente.");

    btnConfirmar.textContent = "Procesando...";
    btnConfirmar.disabled = true;

    // A. Guardar Factura
    const nuevaFactura = {
        nro: "FAC-" + Math.floor(1000 + Math.random() * 9000),
        mesa: parseInt(document.getElementById('mesa-input').value),
        total: parseFloat(totalFinalCalculado.toFixed(2)),
        fecha: new Date().toISOString(),
        metodo: metodo
    };

    const { error: errFactura } = await clienteSupabase.from('facturas').insert([nuevaFactura]);

    if (errFactura) {
        alert("Error al generar la factura.");
        btnConfirmar.textContent = "Confirmar Pago";
        btnConfirmar.disabled = false;
        return;
    }

    // B. Actualizar Pedidos a "Facturado"
    for (let actual of pedidosMesaActual) {
        const fechaISO = new Date().toISOString();
        const nuevoHistorial = [...actual.historial, { estado: 'Facturado', fecha: fechaISO }];
        
        await clienteSupabase
            .from('pedidos')
            .update({ estado: 'Facturado', historial: nuevoHistorial })
            .eq('codigo', actual.codigo);
    }
    
    estadoCuenta = 'Pagada';
    bloquearEdicion();
    alert("¡Cuenta PAGADA con éxito!");
    await renderizarHistorial();
});

// 5. GESTIÓN DE HISTORIAL (SUPABASE)
async function renderizarHistorial() {
    const { data, error } = await clienteSupabase
        .from('facturas')
        .select('*')
        .order('fecha', { ascending: false });

    if (error || !data || data.length === 0) {
        listaFacturasContenedor.innerHTML = "<p>No hay facturas emitidas hoy.</p>";
        return;
    }

    listaFacturasContenedor.innerHTML = data.map(f => {
        const fechaAgradable = new Date(f.fecha).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
        return `
        <div class="factura-card">
            <h4>${f.nro}</h4>
            <p><strong>Mesa:</strong> ${f.mesa}</p>
            <p><strong>Total:</strong> S/ ${parseFloat(f.total).toFixed(2)}</p>
            <p><strong>Pago:</strong> ${f.metodo}</p>
            <small>${fechaAgradable}</small>
        </div>`
    }).join('');
}

// 6. UTILIDADES DE UI
function bloquearEdicion() {
    inputDescuento.disabled = true; selectMetodo.disabled = true;
    inputMontoRecibido.disabled = true; txtJustificacion.disabled = true;
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = "CUENTA PAGADA";
    btnConfirmar.style.backgroundColor = "#95a5a6";
}

function desbloquearEdicion() {
    inputDescuento.disabled = false; selectMetodo.disabled = false;
    inputMontoRecibido.disabled = false; txtJustificacion.disabled = false;
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Confirmar Pago";
    btnConfirmar.style.backgroundColor = ""; 
}

function manejarMetodoPago() { document.getElementById('efectivo-details').classList.toggle('hidden', selectMetodo.value !== 'Efectivo'); }

function calcularVuelto() {
    const recibido = parseFloat(inputMontoRecibido.value) || 0;
    const vuelto = recibido - totalFinalCalculado;
    document.getElementById('txt-vuelto').textContent = `S/ ${vuelto > 0 ? vuelto.toFixed(2) : '0.00'}`;
}