/* ─────────────────── STATE GLOBALES ─────────────────── */
let pedidos       = [];
let platos        = [];
let carritoActual = [];
let prioridadSel  = '';
let prioridadManual = false; 

/* ─────────────────── INIT ─────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Cargas asíncronas iniciales desde Supabase
  await cargarPlatosDesdeSupabase();
  await cargarPedidosDesdeSupabase();
  
  actualizarFecha();
  setInterval(actualizarFecha, 1000);
});

/* ─────────────────── SUPABASE FETCH ─────────────────── */
async function cargarPlatosDesdeSupabase() {
  // AQUÍ ESTABA EL ERROR: Cambiado a clienteSupabase
  const { data, error } = await clienteSupabase
    .from('platos')
    .select('*')
    .eq('estado', 'Activo'); // Solo traemos los activos

  if (error) {
    console.error("Error al cargar platos:", error);
    return;
  }
  
  platos = data || [];
  poblarSelectPlatos();
}

async function cargarPedidosDesdeSupabase() {
  // Cambiado a clienteSupabase
  const { data, error } = await clienteSupabase
    .from('pedidos')
    .select('*')
    .order('fecha', { ascending: false });

  if (error) {
    console.error("Error al cargar pedidos:", error);
    return;
  }

  pedidos = data || [];
  generarCodigo();
  renderStats();
  renderTabla();
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
    opt.value = p.codigo;
    opt.textContent = `${p.nombre} — S/ ${parseFloat(p.precio).toFixed(2)}`;
    opt.dataset.precio    = p.precio;
    opt.dataset.nombre    = p.nombre;
    opt.dataset.tiempo    = p.tiempo || 0;
    
    // Validar formato de alérgenos por si viene como texto o JSONB
    let alergenosArray = [];
    try {
        alergenosArray = typeof p.alergenos === 'string' ? JSON.parse(p.alergenos) : p.alergenos;
    } catch (e) {}
    opt.dataset.alergenos = JSON.stringify(alergenosArray || []);
    
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

/* ─────────────────── PRIORIDAD Y CARRITO ─────────────────── */
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

function setPriority(btn) { aplicarPrioridad(btn.dataset.val, true); }

function sugerirPrioridad() {
  const tiempoTotal = carritoActual.reduce((s, item) => s + item.tiempo, 0);
  const sugerida = tiempoTotal >= 40 ? 'Urgente' : tiempoTotal >= 20 ? 'Alta' : 'Normal';
  if (!prioridadManual) aplicarPrioridad(sugerida, false);
}

function agregarPlato() {
  const sel  = document.getElementById('selectPlato');
  const cant = parseInt(document.getElementById('cantPlato').value);
  const obs  = document.getElementById('obsPlato').value.trim();

  if (!sel.value)         { toast('Selecciona un plato.', true); return; }
  if (!cant || cant < 1)  { toast('La cantidad debe ser mayor a 0.', true); return; }

  const opt    = sel.options[sel.selectedIndex];
  const precio = parseFloat(opt.dataset.precio) || 0;
  const nombre = opt.dataset.nombre;
  const tiempo = parseInt(opt.dataset.tiempo) || 0;
  const alerg  = JSON.parse(opt.dataset.alergenos || '[]');
  const cod    = sel.value;

  const exist = carritoActual.find(i => i.codigo === cod && i.obs === obs);
  if (exist) { exist.cantidad += cant; } 
  else { carritoActual.push({ codigo: cod, nombre, precio, cantidad: cant, obs, tiempo, alergenos: alerg }); }

  sugerirPrioridad(); 
  renderCarrito();

  sel.value = '';
  document.getElementById('cantPlato').value = 1;
  document.getElementById('obsPlato').value  = '';
  document.getElementById('err-platos').style.display = 'none';
}

function quitarPlato(idx) {
  carritoActual.splice(idx, 1);
  sugerirPrioridad();
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
    const alg  = (item.alergenos && item.alergenos.length) ? `<br><span style="font-size:.75rem;color:var(--warn);">⚠ ${item.alergenos.join(', ')}</span>` : '';
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
  clearErr('mozo'); clearErr('mesa'); clearErr('prioridad'); clearErr('justificacion');
  document.getElementById('err-platos').style.display = 'none';

  const mozo = document.getElementById('mozo').value.trim();
  const mesa = parseInt(document.getElementById('numMesa').value);

  if (!mozo || mozo.length < 3) {
    showErr('mozo', 'Ingresa el nombre del mozo (mín. 3 letras).'); ok = false;
  } else if (/^\d+$/.test(mozo)) {
    showErr('mozo', 'El nombre del mozo no puede ser solo números.'); ok = false;
  }

  if (!mesa || mesa < 1 || mesa > 50 || isNaN(mesa)) {
    showErr('mesa', 'Ingresa una mesa válida (1-50).'); ok = false;
  } else {
    const mesaOcupada = pedidos.some(p => p.mesa === mesa && ['Registrado','Enviado a cocina','En preparación','Listo para servir'].includes(p.estado));
    if (mesaOcupada) { showErr('mesa', '¡Esta mesa ya tiene un pedido en curso!'); ok = false; }
  }

  if (!prioridadSel) { showErr('prioridad', 'Selecciona un nivel de prioridad.'); ok = false; }

  if (prioridadSel === 'Urgente') {
    const just = document.getElementById('justificacion').value.trim();
    if (!just || just.length < 10) { showErr('justificacion', 'Justificación mínima 10 caracteres.'); ok = false; }
  }

  if (!carritoActual.length) { document.getElementById('err-platos').style.display = 'block'; ok = false; }

  return ok;
}

/* ─────────────────── GUARDAR (SUPABASE) ─────────────────── */
async function guardarPedido() {
  if (!validarFormulario()) { toast('Revisa los campos con error.', true); return; }

  const mozo   = document.getElementById('mozo').value.trim();
  const mesa   = parseInt(document.getElementById('numMesa').value);
  const codigo = document.getElementById('codPedido').value;
  const fechaISO = new Date().toISOString(); 
  const just   = document.getElementById('justificacion').value.trim();
  const total  = carritoActual.reduce((s, i) => s + i.precio * i.cantidad, 0);

  toast('Guardando en la nube...');

  const nuevoPedido = {
    codigo, mozo, mesa, 
    fecha: fechaISO, 
    prioridad: prioridadSel,
    justificacion: just,
    estado: 'Registrado',
    platos: carritoActual, 
    total: parseFloat(total.toFixed(2)),
    historial: [{ estado: 'Registrado', fecha: fechaISO }] 
  };

  // Cambiado a clienteSupabase
  const { error } = await clienteSupabase.from('pedidos').insert([nuevoPedido]);

  if (error) {
    console.error("Error al guardar pedido:", error);
    toast('Error de conexión al guardar.', true);
    return;
  }

  toast(`Pedido ${codigo} guardado correctamente ✓`);
  resetForm();
  await cargarPedidosDesdeSupabase(); 
}

/* ─────────────────── RESET ─────────────────── */
function resetForm() {
  document.getElementById('mozo').value = '';
  document.getElementById('numMesa').value = '';
  document.getElementById('justificacion').value = '';
  document.getElementById('obsPlato').value = '';
  document.getElementById('cantPlato').value = 1;
  document.getElementById('selectPlato').value = '';
  document.getElementById('justificacionWrap').style.display = 'none';
  document.querySelectorAll('.priority-pill').forEach(p => p.className = 'priority-pill');
  prioridadSel    = '';
  prioridadManual = false; 
  carritoActual   = [];
  renderCarrito();
  ['mozo','mesa','prioridad','justificacion'].forEach(clearErr);
  document.getElementById('err-platos').style.display = 'none';
  generarCodigo();
}

/* ─────────────────── STATS & TABLA ─────────────────── */
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

const estadoBadge = {
  'Registrado':       'badge-registrado', 'Enviado a cocina': 'badge-cocina',
  'En preparación':   'badge-preparacion', 'Listo para servir':'badge-listo',
  'Entregado':        'badge-entregado', 'Cancelado':        'badge-cancelado',
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
  }); 

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
    
    const platosArray = typeof p.platos === 'string' ? JSON.parse(p.platos) : p.platos;
    const nPlatos = platosArray.reduce((s, i) => s + i.cantidad, 0);
    
    const fechaAgradable = new Date(p.fecha).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const puedeEnviar  = p.estado === 'Registrado';
    const puedeCancelar= !['Cancelado','Entregado','Facturado'].includes(p.estado);
    const puedeEntregar= p.estado === 'Listo para servir';
    
    return `<tr>
      <td><strong>${p.codigo}</strong></td>
      <td>Mesa ${p.mesa}</td>
      <td>${p.mozo}</td>
      <td style="font-size:.8rem;white-space:nowrap">${fechaAgradable}</td>
      <td>${nPlatos} ítem${nPlatos !== 1 ? 's' : ''}</td>
      <td><strong>S/ ${parseFloat(p.total).toFixed(2)}</strong></td>
      <td><span class="badge ${bPrio}">${p.prioridad}</span></td>
      <td><span class="badge ${bEst}">${p.estado}</span></td>
      <td>
        <div class="actions-cell">
          <button type="button" class="btn-xs btn-xs-outline" onclick="verDetalle('${p.codigo}')">Ver</button>
          ${puedeEnviar   ? `<button type="button" class="btn-xs btn-xs-warn"  onclick="cambiarEstadoDesdeBoton('${p.codigo}', 'Enviado a cocina')">→ Cocina</button>` : ''}
          ${puedeEntregar ? `<button type="button" class="btn-xs btn-xs-green" onclick="cambiarEstadoDesdeBoton('${p.codigo}', 'Entregado')">Entregar</button>` : ''}
          ${puedeCancelar ? `<button type="button" class="btn-xs btn-xs-red"   onclick="cancelarPedidoConfirmado('${p.codigo}')">Cancelar</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ─────────────────── ACCIONES (SUPABASE UPDATES) ─────────────────── */
async function actualizarEstadoEnNube(cod, nuevoEstado) {
  const p = pedidos.find(x => x.codigo === cod);
  if (!p) return;

  const fechaISO = new Date().toISOString();
  
  let historialArray = typeof p.historial === 'string' ? JSON.parse(p.historial) : p.historial;
  historialArray.push({ estado: nuevoEstado, fecha: fechaISO });

  toast('Procesando...', false);

  // Cambiado a clienteSupabase
  const { error } = await clienteSupabase
    .from('pedidos')
    .update({ 
        estado: nuevoEstado,
        historial: historialArray
    })
    .eq('codigo', cod);

  if (error) {
    console.error(`Error al cambiar a ${nuevoEstado}:`, error);
    toast('Error de conexión.', true);
  } else {
    toast(`Pedido ${cod} -> ${nuevoEstado} ✓`);
    await cargarPedidosDesdeSupabase(); 
  }
}

function cambiarEstadoDesdeBoton(cod, estado) {
  actualizarEstadoEnNube(cod, estado);
}

function cancelarPedidoConfirmado(cod) {
  if (confirm(`¿Confirmas cancelar el pedido ${cod}?`)) {
    actualizarEstadoEnNube(cod, 'Cancelado');
  }
}

/* ─────────────────── MODAL DETALLE ─────────────────── */
function verDetalle(cod) {
  const p = pedidos.find(x => x.codigo === cod);
  if (!p) return;
  const bEst  = estadoBadge[p.estado]  || 'badge-registrado';
  const bPrio = prioBadge[p.prioridad] || 'badge-normal';
  
  const platosArray = typeof p.platos === 'string' ? JSON.parse(p.platos) : p.platos;
  const historialArray = typeof p.historial === 'string' ? JSON.parse(p.historial) : p.historial;
  const fechaAgradable = new Date(p.fecha).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

  document.getElementById('modalTitle').textContent = `Pedido ${p.codigo}`;
  document.getElementById('modalBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-row"><span class="d-label">Código</span><span class="d-val">${p.codigo}</span></div>
      <div class="detail-row"><span class="d-label">Mesa</span><span class="d-val">Mesa ${p.mesa}</span></div>
      <div class="detail-row"><span class="d-label">Mozo</span><span class="d-val">${p.mozo}</span></div>
      <div class="detail-row"><span class="d-label">Fecha/Hora</span><span class="d-val">${fechaAgradable}</span></div>
      <div class="detail-row"><span class="d-label">Estado</span><span class="d-val"><span class="badge ${bEst}">${p.estado}</span></span></div>
      <div class="detail-row"><span class="d-label">Prioridad</span><span class="d-val"><span class="badge ${bPrio}">${p.prioridad}</span></span></div>
      ${p.justificacion ? `<div class="detail-row" style="grid-column:1/-1"><span class="d-label">Justificación urgencia</span><span class="d-val">${p.justificacion}</span></div>` : ''}
      <div class="detail-row" style="grid-column:1/-1">
        <span class="d-label">Total</span>
        <span class="d-val" style="font-size:1.2rem;font-weight:700;color:var(--green-dk)">S/ ${parseFloat(p.total).toFixed(2)}</span>
      </div>
    </div>

    <div class="detail-dishes-title">🍽 Platos del pedido</div>
    <div style="display:grid;grid-template-columns:2fr .5fr .8fr 1fr;gap:.4rem;padding:.4rem .7rem;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-soft);">
      <span>Plato</span><span>Cant.</span><span>P.Unit.</span><span>Subtotal</span>
    </div>
    ${platosArray.map(pl => `
      <div class="detail-dish-row">
        <div class="ddr-name">${pl.nombre}
          ${pl.alergenos && pl.alergenos.length ? `<div class="detail-dish-obs">⚠ Alérgenos: ${pl.alergenos.join(', ')}</div>` : ''}
          ${pl.obs ? `<div class="detail-dish-obs">📝 ${pl.obs}</div>` : ''}
        </div>
        <div>${pl.cantidad}</div>
        <div>S/ ${parseFloat(pl.precio).toFixed(2)}</div>
        <div><strong>S/ ${(pl.precio * pl.cantidad).toFixed(2)}</strong></div>
      </div>`).join('')}

    <div style="text-align:right;padding:1rem .7rem;font-size:1.1rem;font-weight:700;color:var(--green-dk);border-top:2px solid var(--border);margin-top:.5rem;">
      TOTAL: S/ ${parseFloat(p.total).toFixed(2)}
    </div>

    <div class="detail-dishes-title">📜 Historial de estados</div>
    ${historialArray.map(h => `
      <div style="display:flex;gap:1rem;font-size:.85rem;padding:.35rem .7rem;border-left:3px solid var(--green-lt);margin-bottom:.3rem;background:var(--surface);border-radius:0 6px 6px 0;">
        <strong>${h.estado}</strong> <span style="color:var(--text-soft)">${new Date(h.fecha).toLocaleString('es-PE', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span>
      </div>`).join('')}
  `;
  document.getElementById('modalOverlay').classList.add('open');
}

function cerrarModal() { document.getElementById('modalOverlay').classList.remove('open'); }
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) cerrarModal(); });

/* ─────────────────── TOAST ─────────────────── */
function toast(msg, err = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = err ? 'show err' : 'show';
  setTimeout(() => el.className = '', 3200);
}