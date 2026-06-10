/* ─────────────────── STORAGE KEYS ─────────────────── */
const KEY_PEDIDOS = 'sc_pedidos';
const KEY_PLATOS  = 'platos';

/* ─────────────────── STATE ─────────────────── */
let pedidos       = JSON.parse(localStorage.getItem(KEY_PEDIDOS) || '[]');
let platos        = [];
let carritoActual = [];
let prioridadSel  = '';
let prioridadManual = false; // true = el mozo tocó manualmente los pills

/* ─────────────────── INIT ─────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  cargarPlatosDesdeStorage();
  generarCodigo();
  actualizarFecha();
  setInterval(actualizarFecha, 1000);
  renderStats();
  renderTabla();
});

function cargarPlatosDesdeStorage() {
  const raw = JSON.parse(localStorage.getItem(KEY_PLATOS) || '[]');
  platos = raw.filter(p => (p.estado || '').toLowerCase() === 'activo' || p.activo === true);
  poblarSelectPlatos();
}

function poblarSelectPlatos() {
  const sel = document.getElementById('selectPlato');
  sel.innerHTML = '<option value="">-- Selecciona un plato --</option>';
  if (!platos.length) {
    sel.innerHTML += '<option disabled>No hay platos activos registrados</option>';
    return;
  }
  platos.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.codigo || p.id || p.nombre;
    opt.textContent = `${p.nombre} — S/ ${parseFloat(p.precio).toFixed(2)}`;
    opt.dataset.precio    = p.precio;
    opt.dataset.nombre    = p.nombre;
    opt.dataset.tiempo    = p.tiempoPreparacion || p.tiempo || 0;
    opt.dataset.alergenos = JSON.stringify(p.alergenos || []);
    sel.appendChild(opt);
  });
}

/* ─────────────────── CÓDIGO AUTOMÁTICO ─────────────────── */
function generarCodigo() {
  let maxId = 0;
  pedidos.forEach(p => {
    if (p.codigo) {
      const num = parseInt(p.codigo.replace('PED', ''));
      if (!isNaN(num) && num > maxId) maxId = num;
    }
  });
  document.getElementById('codPedido').value = 'PED' + String(maxId + 1).padStart(3, '0');
}

function actualizarFecha() {
  const now = new Date();
  const fmt = now.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' })
            + ' ' + now.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  document.getElementById('fechaHora').value = fmt;
}

/* ─────────────────── TABS ─────────────────── */
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-nuevo').style.display = tab === 'nuevo' ? 'block' : 'none';
  document.getElementById('tab-lista').style.display = tab === 'lista'  ? 'block' : 'none';
  if (tab === 'lista') renderTabla();
}

/* ─────────────────── PRIORIDAD ─────────────────── */

/**
 * Aplica visualmente una prioridad en los pills.
 * @param {string} val  - 'Normal' | 'Alta' | 'Urgente'
 * @param {boolean} esManual - true si lo eligió el mozo, false si es sugerencia automática
 */
function aplicarPrioridad(val, esManual = false) {
  document.querySelectorAll('.priority-pill').forEach(p => p.className = 'priority-pill');
  prioridadSel    = val;
  prioridadManual = esManual;

  const btn = document.querySelector(`.priority-pill[data-val="${val}"]`);
  if (btn) btn.classList.add('selected-' + val.toLowerCase());

  clearErr('prioridad');

  const wrap = document.getElementById('justificacionWrap');
  if (val === 'Urgente') {
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
    document.getElementById('justificacion').value = '';
    clearErr('justificacion');
  }
}

/** Llamado cuando el mozo hace clic en un pill manualmente */
function setPriority(btn) {
  aplicarPrioridad(btn.dataset.val, true); // esManual = true
}

/**
 * Sugiere prioridad según el tiempo estimado total de preparación.
 * Regla (sin importar la cantidad de unidades de cada plato):
 *   - Suma de tiempos de los platos únicos en el carrito
 *   - < 20 min  → Normal
 *   - 20-40 min → Alta
 *   - > 40 min  → Urgente
 *
 * Solo sobreescribe la selección si el mozo NO ha elegido manualmente.
 */
function sugerirPrioridad() {
  // ─── CLAVE: suma de tiempos SIN multiplicar por cantidad ───
  const tiempoTotal = carritoActual.reduce((s, item) => s + item.tiempo, 0);

  const sugerida = tiempoTotal >= 40 ? 'Urgente'
                 : tiempoTotal >= 20 ? 'Alta'
                 : 'Normal';

  if (!prioridadManual) {
    // Modo automático: el sistema impone la sugerencia
    aplicarPrioridad(sugerida, false);
  }
  // Si el mozo ya eligió manualmente, no se sobreescribe
}

/* ─────────────────── CARRITO ─────────────────── */
function agregarPlato() {
  const sel  = document.getElementById('selectPlato');
  const cant = parseInt(document.getElementById('cantPlato').value);
  const obs  = document.getElementById('obsPlato').value.trim();

  if (!sel.value)         { toast('Selecciona un plato.', true); return; }
  if (!cant || cant < 1)  { toast('La cantidad debe ser mayor a 0.', true); return; }

  const opt    = sel.options[sel.selectedIndex];
  const precio = parseFloat(opt.dataset.precio)           || 0;
  const nombre = opt.dataset.nombre;
  const tiempo = parseInt(opt.dataset.tiempo)             || 0;
  const alerg  = JSON.parse(opt.dataset.alergenos || '[]');
  const cod    = sel.value;

  const exist = carritoActual.find(i => i.codigo === cod && i.obs === obs);
  if (exist) {
    exist.cantidad += cant;
  } else {
    carritoActual.push({ codigo: cod, nombre, precio, cantidad: cant, obs, tiempo, alergenos: alerg });
  }

  sugerirPrioridad(); // recalcula con el carrito actualizado
  renderCarrito();

  sel.value = '';
  document.getElementById('cantPlato').value = 1;
  document.getElementById('obsPlato').value  = '';
  document.getElementById('err-platos').style.display = 'none';
}

function quitarPlato(idx) {
  carritoActual.splice(idx, 1);
  sugerirPrioridad(); // recalcula al quitar platos
  renderCarrito();
}

function renderCarrito() {
  const list   = document.getElementById('dishList');
  const totalR = document.getElementById('totalRow');
  const totalD = document.getElementById('totalDisplay');

  if (!carritoActual.length) {
    list.innerHTML = '<p class="empty-dish" id="emptyDish">No hay platos en este pedido aún.</p>';
    totalR.style.display = 'none';
    return;
  }

  list.innerHTML = carritoActual.map((item, i) => {
    const sub  = (item.precio * item.cantidad).toFixed(2);
    const alg  = (item.alergenos && item.alergenos.length)
                 ? `<br><span style="font-size:.75rem;color:var(--warn);">⚠ ${item.alergenos.join(', ')}</span>`
                 : '';
    const obs  = item.obs ? `<br><em>${item.obs}</em>` : '';
    return `<div class="dish-item">
      <div class="dish-name">${item.nombre}${alg}${obs}</div>
      <div class="dish-qty">${item.cantidad}</div>
      <div class="dish-price">S/ ${item.precio.toFixed(2)}</div>
      <div class="dish-sub">S/ ${sub}</div>
      <div class="dish-obs">${item.tiempo} min</div>
      <button type="button" class="btn-remove" onclick="quitarPlato(${i})" title="Eliminar">✕</button>
    </div>`;
  }).join('');

  const totalNum = carritoActual.reduce((s, i) => s + i.precio * i.cantidad, 0);
  totalD.textContent   = 'S/ ' + totalNum.toFixed(2);
  totalR.style.display = 'flex';
}

/* ─────────────────── VALIDACIONES ─────────────────── */
function clearErr(id) {
  const el = document.getElementById('err-' + id);
  if (el) el.style.display = 'none';
  const field = document.getElementById(id)?.closest('.field');
  if (field) field.classList.remove('has-error');
}

function showErr(id, msg) {
  const el = document.getElementById('err-' + id);
  if (el) { if (msg) el.textContent = msg; el.style.display = 'block'; }
  const field = document.getElementById(id)?.closest('.field');
  if (field) field.classList.add('has-error');
}

function validarFormulario() {
  let ok = true;
  clearErr('mozo'); clearErr('mesa'); clearErr('prioridad');
  clearErr('justificacion');
  document.getElementById('err-platos').style.display = 'none';

  const mozo = document.getElementById('mozo').value.trim();
  const mesa = parseInt(document.getElementById('numMesa').value);

  if (!mozo || mozo.length < 3) {
    showErr('mozo', 'Ingresa el nombre del mozo (mín. 3 letras).');
    ok = false;
  } else if (/^\d+$/.test(mozo)) {
    showErr('mozo', 'El nombre del mozo no puede ser solo números.');
    ok = false;
  }

  if (!mesa || mesa < 1 || mesa > 50 || isNaN(mesa)) {
    showErr('mesa', 'Ingresa una mesa válida (1-50).');
    ok = false;
  } else {
    const mesaOcupada = pedidos.some(p =>
      p.mesa === mesa &&
      ['Registrado','Enviado a cocina','En preparación','Listo para servir'].includes(p.estado)
    );
    if (mesaOcupada) {
      showErr('mesa', '¡Esta mesa ya tiene un pedido en curso!');
      ok = false;
    }
  }

  if (!prioridadSel) {
    showErr('prioridad', 'Selecciona un nivel de prioridad.');
    ok = false;
  }

  if (prioridadSel === 'Urgente') {
    const just = document.getElementById('justificacion').value.trim();
    if (!just || just.length < 10) {
      showErr('justificacion', 'Justificación mínima 10 caracteres.');
      ok = false;
    }
  }

  if (!carritoActual.length) {
    document.getElementById('err-platos').style.display = 'block';
    ok = false;
  }

  return ok;
}

/* ─────────────────── GUARDAR ─────────────────── */
function guardarPedido() {
  if (!validarFormulario()) { toast('Revisa los campos con error.', true); return; }

  const mozo   = document.getElementById('mozo').value.trim();
  const mesa   = parseInt(document.getElementById('numMesa').value);
  const codigo = document.getElementById('codPedido').value;
  const fecha  = document.getElementById('fechaHora').value;
  const just   = document.getElementById('justificacion').value.trim();
  const total  = carritoActual.reduce((s, i) => s + i.precio * i.cantidad, 0);

  const pedido = {
    codigo, mozo, mesa, fecha,
    prioridad:     prioridadSel,
    justificacion: just,
    estado:        'Registrado',
    platos:        JSON.parse(JSON.stringify(carritoActual)),
    total:         parseFloat(total.toFixed(2)),
    historial:     [{ estado: 'Registrado', fecha }]
  };

  pedidos.push(pedido);
  localStorage.setItem(KEY_PEDIDOS, JSON.stringify(pedidos));

  toast(`Pedido ${codigo} guardado correctamente ✓`);
  resetForm();
  renderStats();
}

/* ─────────────────── RESET ─────────────────── */
function resetForm() {
  document.getElementById('mozo').value          = '';
  document.getElementById('numMesa').value       = '';
  document.getElementById('justificacion').value = '';
  document.getElementById('obsPlato').value      = '';
  document.getElementById('cantPlato').value     = 1;
  document.getElementById('selectPlato').value   = '';
  document.getElementById('justificacionWrap').style.display = 'none';
  document.querySelectorAll('.priority-pill').forEach(p => p.className = 'priority-pill');
  prioridadSel    = '';
  prioridadManual = false; // resetea el flag manual
  carritoActual   = [];
  renderCarrito();
  ['mozo','mesa','prioridad','justificacion'].forEach(clearErr);
  document.getElementById('err-platos').style.display = 'none';
  generarCodigo();
}

/* ─────────────────── STATS ─────────────────── */
function renderStats() {
  const tots = {
    total:    pedidos.length,
    activos:  pedidos.filter(p => !['Cancelado','Entregado','Facturado'].includes(p.estado)).length,
    cocina:   pedidos.filter(p => ['Enviado a cocina','En preparación'].includes(p.estado)).length,
    urgentes: pedidos.filter(p => p.prioridad === 'Urgente' && p.estado !== 'Cancelado').length
  };
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card"><div class="s-num">${tots.total}</div><div class="s-lbl">Total Pedidos</div></div>
    <div class="stat-card"><div class="s-num">${tots.activos}</div><div class="s-lbl">Pedidos Activos</div></div>
    <div class="stat-card"><div class="s-num" style="color:var(--warn)">${tots.cocina}</div><div class="s-lbl">En Cocina</div></div>
    <div class="stat-card"><div class="s-num" style="color:var(--danger)">${tots.urgentes}</div><div class="s-lbl">Urgentes</div></div>
  `;
}

/* ─────────────────── TABLA ─────────────────── */
const estadoBadge = {
  'Registrado':       'badge-registrado',
  'Enviado a cocina': 'badge-cocina',
  'En preparación':   'badge-preparacion',
  'Listo para servir':'badge-listo',
  'Entregado':        'badge-entregado',
  'Cancelado':        'badge-cancelado',
};
const prioBadge = { Normal:'badge-normal', Alta:'badge-alta', Urgente:'badge-urgente' };

function renderTabla() {
  const fEst  = document.getElementById('filtroEstado').value;
  const fPrio = document.getElementById('filtroPrioridad').value;
  const fMesa = parseInt(document.getElementById('filtroMesa').value);
  const fMozo = document.getElementById('filtroMozo').value.trim().toLowerCase();

  const datos = pedidos.filter(p => {
    if (fEst  && p.estado    !== fEst)  return false;
    if (fPrio && p.prioridad !== fPrio) return false;
    if (fMesa && p.mesa      !== fMesa) return false;
    if (fMozo && !p.mozo.toLowerCase().includes(fMozo)) return false;
    return true;
  }).slice().reverse();

  const tbody = document.getElementById('tablaPedidos');
  const noOrd = document.getElementById('noOrders');

  if (!datos.length) {
    tbody.innerHTML = '';
    noOrd.style.display = 'block';
    return;
  }
  noOrd.style.display = 'none';

  tbody.innerHTML = datos.map(p => {
    const bEst  = estadoBadge[p.estado]  || 'badge-registrado';
    const bPrio = prioBadge[p.prioridad] || 'badge-normal';
    const nPlatos      = p.platos.reduce((s, i) => s + i.cantidad, 0);
    const puedeEnviar  = p.estado === 'Registrado';
    const puedeCancelar= !['Cancelado','Entregado','Facturado'].includes(p.estado);
    const puedeEntregar= p.estado === 'Listo para servir';
    return `<tr>
      <td><strong>${p.codigo}</strong></td>
      <td>Mesa ${p.mesa}</td>
      <td>${p.mozo}</td>
      <td style="font-size:.8rem;white-space:nowrap">${p.fecha}</td>
      <td>${nPlatos} ítem${nPlatos !== 1 ? 's' : ''}</td>
      <td><strong>S/ ${p.total.toFixed(2)}</strong></td>
      <td><span class="badge ${bPrio}">${p.prioridad}</span></td>
      <td><span class="badge ${bEst}">${p.estado}</span></td>
      <td>
        <div class="actions-cell">
          <button type="button" class="btn-xs btn-xs-outline" onclick="verDetalle('${p.codigo}')">Ver</button>
          ${puedeEnviar   ? `<button type="button" class="btn-xs btn-xs-warn"  onclick="enviarCocina('${p.codigo}')">→ Cocina</button>` : ''}
          ${puedeEntregar ? `<button type="button" class="btn-xs btn-xs-green" onclick="marcarEntregado('${p.codigo}')">Entregar</button>` : ''}
          ${puedeCancelar ? `<button type="button" class="btn-xs btn-xs-red"   onclick="cancelarPedido('${p.codigo}')">Cancelar</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ─────────────────── ACCIONES ─────────────────── */
function enviarCocina(cod) {
  const p = pedidos.find(x => x.codigo === cod);
  if (!p || p.estado !== 'Registrado') return;
  const ts = new Date().toLocaleString('es-PE');
  p.estado = 'Enviado a cocina';
  p.historial.push({ estado: 'Enviado a cocina', fecha: ts });
  saveAndRefresh();
  toast(`Pedido ${cod} enviado a cocina ✓`);
}

function marcarEntregado(cod) {
  const p = pedidos.find(x => x.codigo === cod);
  if (!p) return;
  const ts = new Date().toLocaleString('es-PE');
  p.estado = 'Entregado';
  p.historial.push({ estado: 'Entregado', fecha: ts });
  saveAndRefresh();
  toast(`Pedido ${cod} marcado como Entregado ✓`);
}

function cancelarPedido(cod) {
  const p = pedidos.find(x => x.codigo === cod);
  if (!p || ['Cancelado','Entregado'].includes(p.estado)) return;
  if (!confirm(`¿Confirmas cancelar el pedido ${cod}?`)) return;
  const ts = new Date().toLocaleString('es-PE');
  p.estado = 'Cancelado';
  p.historial.push({ estado: 'Cancelado', fecha: ts });
  saveAndRefresh();
  toast(`Pedido ${cod} cancelado.`);
}

function saveAndRefresh() {
  localStorage.setItem(KEY_PEDIDOS, JSON.stringify(pedidos));
  renderTabla();
  renderStats();
}

/* ─────────────────── MODAL DETALLE ─────────────────── */
function verDetalle(cod) {
  const p = pedidos.find(x => x.codigo === cod);
  if (!p) return;
  const bEst  = estadoBadge[p.estado]  || 'badge-registrado';
  const bPrio = prioBadge[p.prioridad] || 'badge-normal';

  document.getElementById('modalTitle').textContent = `Pedido ${p.codigo}`;
  document.getElementById('modalBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-row"><span class="d-label">Código</span><span class="d-val">${p.codigo}</span></div>
      <div class="detail-row"><span class="d-label">Mesa</span><span class="d-val">Mesa ${p.mesa}</span></div>
      <div class="detail-row"><span class="d-label">Mozo</span><span class="d-val">${p.mozo}</span></div>
      <div class="detail-row"><span class="d-label">Fecha/Hora</span><span class="d-val">${p.fecha}</span></div>
      <div class="detail-row"><span class="d-label">Estado</span><span class="d-val"><span class="badge ${bEst}">${p.estado}</span></span></div>
      <div class="detail-row"><span class="d-label">Prioridad</span><span class="d-val"><span class="badge ${bPrio}">${p.prioridad}</span></span></div>
      ${p.justificacion ? `<div class="detail-row" style="grid-column:1/-1"><span class="d-label">Justificación urgencia</span><span class="d-val">${p.justificacion}</span></div>` : ''}
      <div class="detail-row" style="grid-column:1/-1">
        <span class="d-label">Total</span>
        <span class="d-val" style="font-size:1.2rem;font-weight:700;color:var(--green-dk)">S/ ${p.total.toFixed(2)}</span>
      </div>
    </div>

    <div class="detail-dishes-title">🍽 Platos del pedido</div>
    <div style="display:grid;grid-template-columns:2fr .5fr .8fr 1fr;gap:.4rem;padding:.4rem .7rem;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-soft);">
      <span>Plato</span><span>Cant.</span><span>P.Unit.</span><span>Subtotal</span>
    </div>
    ${p.platos.map(pl => `
      <div class="detail-dish-row">
        <div class="ddr-name">${pl.nombre}
          ${pl.alergenos && pl.alergenos.length ? `<div class="detail-dish-obs">⚠ Alérgenos: ${pl.alergenos.join(', ')}</div>` : ''}
          ${pl.obs ? `<div class="detail-dish-obs">📝 ${pl.obs}</div>` : ''}
        </div>
        <div>${pl.cantidad}</div>
        <div>S/ ${pl.precio.toFixed(2)}</div>
        <div><strong>S/ ${(pl.precio * pl.cantidad).toFixed(2)}</strong></div>
      </div>`).join('')}

    <div style="text-align:right;padding:1rem .7rem;font-size:1.1rem;font-weight:700;color:var(--green-dk);border-top:2px solid var(--border);margin-top:.5rem;">
      TOTAL: S/ ${p.total.toFixed(2)}
    </div>

    <div class="detail-dishes-title">📜 Historial de estados</div>
    ${p.historial.map(h => `
      <div style="display:flex;gap:1rem;font-size:.85rem;padding:.35rem .7rem;border-left:3px solid var(--green-lt);margin-bottom:.3rem;background:var(--surface);border-radius:0 6px 6px 0;">
        <strong>${h.estado}</strong> <span style="color:var(--text-soft)">${h.fecha}</span>
      </div>`).join('')}
  `;
  document.getElementById('modalOverlay').classList.add('open');
}

function cerrarModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) cerrarModal();
});

/* ─────────────────── TOAST ─────────────────── */
function toast(msg, err = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = err ? 'show err' : 'show';
  setTimeout(() => el.className = '', 3200);
}