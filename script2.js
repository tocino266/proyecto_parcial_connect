/* ─────────────────── STATE GLOBALES ─────────────────── */
let pedidos       = [];
let platos        = [];
let carritoActual = [];
let prioridadSel  = '';
let prioridadManual = false;

/* ─────────────────── INIT ─────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await cargarPlatosDesdeSupabase();
  await cargarPedidosDesdeSupabase();
  actualizarFecha();
  setInterval(actualizarFecha, 1000);

  // ponytail: realtime — pedidos list updates instantly when cocina changes status
  let _rt = null;
  const recargar = () => { clearTimeout(_rt); _rt = setTimeout(cargarPedidosDesdeSupabase, 300); };
  window.clienteSupabase
      .channel('pedidos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, recargar)
      .subscribe();
});

/* ─────────────────── SUPABASE FETCH ─────────────────── */
async function cargarPlatosDesdeSupabase() {
  const { data, error } = await window.clienteSupabase
    .from('platos')
    .select('*')
    .eq('estado', 'Activo');

  if (error) {
    console.error("Error al cargar platos:", error);
    toast('Error al cargar platos desde la base de datos.', true);
    return;
  }

  platos = data || [];
  poblarSelectPlatos();
}

async function cargarPedidosDesdeSupabase() {
  // Carga pedidos con sus detalles de platos usando join de Supabase
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
    .order('fecha_hora', { ascending: false });

  if (error) {
    console.error("Error al cargar pedidos:", error);
    toast('Error al cargar pedidos desde la base de datos.', true);
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
    opt.value = p.id;                          // Usamos UUID (plato_id) como valor
    opt.textContent = `${p.nombre} — S/ ${parseFloat(p.precio).toFixed(2)}`;
    opt.dataset.codigo    = p.codigo;
    opt.dataset.precio    = p.precio;
    opt.dataset.nombre    = p.nombre;
    opt.dataset.tiempo    = p.tiempo_preparacion || 0;

    let alergenosArray = [];
    try {
        alergenosArray = typeof p.alergenos === 'string' ? JSON.parse(p.alergenos) : (p.alergenos || []);
    } catch (e) {}
    opt.dataset.alergenos = JSON.stringify(alergenosArray);
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
  if (cant > 99)          { toast('La cantidad no puede superar 99.', true); return; }

  const opt       = sel.options[sel.selectedIndex];
  const platoId   = sel.value;                          // UUID del plato
  const precio    = parseFloat(opt.dataset.precio) || 0;
  const nombre    = opt.dataset.nombre;
  const tiempo    = parseInt(opt.dataset.tiempo) || 0;
  const alerg     = JSON.parse(opt.dataset.alergenos || '[]');
  const codigo    = opt.dataset.codigo;

  const exist = carritoActual.find(i => i.plato_id === platoId && i.obs === obs);
  if (exist) { exist.cantidad += cant; }
  else { carritoActual.push({ plato_id: platoId, codigo, nombre, precio, cantidad: cant, obs, tiempo, alergenos: alerg }); }

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
    const alg  = (item.alergenos && item.alergenos.length) ? `<br><span style="font-size:.75rem;color:var(--warn);">⚠ ${escapeHtml(item.alergenos.join(', '))}</span>` : '';
    const obs  = item.obs ? `<br><em>${escapeHtml(item.obs)}</em>` : '';
    return `<div class="dish-item">
      <div class="dish-name">${escapeHtml(item.nombre)}${alg}${obs}</div>
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

/* ─────────────────── GUARDAR (SUPABASE - 2 tablas) ─────────────────── */
async function guardarPedido() {
  if (!validarFormulario()) { toast('Revisa los campos con error.', true); return; }

  const mozo   = document.getElementById('mozo').value.trim();
  const mesa   = parseInt(document.getElementById('numMesa').value);
  const codigo = document.getElementById('codPedido').value;
  const fechaISO = new Date().toISOString();
  const just   = document.getElementById('justificacion').value.trim();
  const total  = carritoActual.reduce((s, i) => s + i.precio * i.cantidad, 0);

  // Verificar código duplicado
  const { data: existeCodigo } = await window.clienteSupabase
    .from('pedidos')
    .select('codigo')
    .eq('codigo', codigo)
    .maybeSingle();

  if (existeCodigo) {
    toast('Error: código de pedido duplicado. Recargando...', true);
    await cargarPedidosDesdeSupabase();
    return;
  }

  // Obtener el ID del perfil en usuarios_perfil (no el auth user id directamente)
  let mozoPerfilId = null;
  const usuario = await window.obtenerUsuarioActual();
  if (usuario) {
      const { data: perfil } = await window.clienteSupabase
          .from('usuarios_perfil')
          .select('id')
          .eq('user_id', usuario.id)
          .maybeSingle();
      if (perfil) mozoPerfilId = perfil.id;
  }

  toast('Guardando en la nube...');

  // PASO 1: Insertar el pedido principal
  const nuevoPedido = {
    codigo,
    mozo_id: mozoPerfilId,
    mozo_nombre: mozo,
    mesa,
    fecha_hora: fechaISO,
    prioridad: prioridadSel,
    justificacion_prioridad: prioridadSel === 'Urgente' ? just : null,
    estado: 'Registrado',
    total: parseFloat(total.toFixed(2))
  };

  const { data: pedidoInsertado, error: errPedido } = await window.clienteSupabase
    .from('pedidos')
    .insert([nuevoPedido])
    .select()
    .single();

  if (errPedido) {
    console.error("Error al guardar pedido:", errPedido);
    let msg = 'Error de conexión al guardar.';
    if (errPedido.code === '23505') msg = 'Ya existe un pedido con ese código. Intenta de nuevo.';
    toast(msg, true);
    return;
  }

  // PASO 2: Insertar los ítems en pedido_detalle
  const detalles = carritoActual.map(item => ({
    pedido_id: pedidoInsertado.id,
    plato_id: item.plato_id,
    cantidad: item.cantidad,
    precio_unitario: parseFloat(item.precio.toFixed(2)),
    subtotal: parseFloat((item.precio * item.cantidad).toFixed(2)),
    observacion: item.obs || null
  }));

  const { error: errDetalles } = await window.clienteSupabase
    .from('pedido_detalle')
    .insert(detalles);

  if (errDetalles) {
    console.error("Error al guardar detalles:", errDetalles);
    toast(`Pedido ${codigo} guardado pero hubo un error en los detalles.`, true);
  } else {
    toast(`Pedido ${codigo} guardado correctamente ✓`);
  }

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

function obtenerNItemsPedido(p) {
  if (p.pedido_detalle && p.pedido_detalle.length) {
    return p.pedido_detalle.reduce((s, d) => s + (d.cantidad || 1), 0);
  }
  return 0;
}

function renderTabla() {
  const fEst  = document.getElementById('filtroEstado').value;
  const fPrio = document.getElementById('filtroPrioridad').value;
  const fMesa = parseInt(document.getElementById('filtroMesa').value);
  const fMozo = document.getElementById('filtroMozo').value.trim().toLowerCase();

  const datos = pedidos.filter(p => {
    if (fEst  && p.estado    !== fEst)  return false;
    if (fPrio && p.prioridad !== fPrio) return false;
    if (fMesa && p.mesa      !== fMesa) return false;
    // Sin columna mozo texto, filtramos por código si se escribe algo
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
    const nPlatos = obtenerNItemsPedido(p);
    const fechaAgradable = new Date(p.fecha_hora || p.fecha).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const puedeEnviar  = p.estado === 'Registrado';
    const puedeCancelar= !['Cancelado','Entregado','Facturado'].includes(p.estado);
    const puedeEntregar= p.estado === 'Listo para servir';

    return `<tr>
      <td><strong>${escapeHtml(p.codigo)}</strong></td>
      <td>Mesa ${p.mesa}</td>
      <td>${escapeHtml(p.mozo_nombre || 'N/A')}</td>
      <td style="font-size:.8rem;white-space:nowrap">${fechaAgradable}</td>
      <td>${nPlatos} ítem${nPlatos !== 1 ? 's' : ''}</td>
      <td><strong>S/ ${parseFloat(p.total).toFixed(2)}</strong></td>
      <td><span class="badge ${bPrio}">${escapeHtml(p.prioridad)}</span></td>
      <td><span class="badge ${bEst}">${escapeHtml(p.estado)}</span></td>
      <td>
        <div class="actions-cell">
          <button type="button" class="btn-xs btn-xs-outline" onclick="verDetalle('${escapeHtml(p.codigo)}')">Ver</button>
          ${puedeEnviar   ? `<button type="button" class="btn-xs btn-xs-warn"  onclick="cambiarEstadoDesdeBoton('${escapeHtml(p.codigo)}', 'Enviado a cocina')">→ Cocina</button>` : ''}
          ${puedeEntregar ? `<button type="button" class="btn-xs btn-xs-green" onclick="cambiarEstadoDesdeBoton('${escapeHtml(p.codigo)}', 'Entregado')">Entregar</button>` : ''}
          ${puedeCancelar ? `<button type="button" class="btn-xs btn-xs-red"   onclick="cancelarPedidoConfirmado('${escapeHtml(p.codigo)}')">Cancelar</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ─────────────────── ACCIONES (SUPABASE UPDATES) ─────────────────── */
async function actualizarEstadoEnNube(cod, nuevoEstado) {
  const p = pedidos.find(x => x.codigo === cod);
  if (!p) return;

  if (p.estado === 'Cancelado') {
    toast('No se puede cambiar el estado de un pedido cancelado.', true);
    return;
  }

  toast('Procesando...', false);

  const { error } = await window.clienteSupabase
    .from('pedidos')
    .update({ estado: nuevoEstado })
    .eq('codigo', cod);

  if (error) {
    console.error(`Error al cambiar a ${nuevoEstado}:`, error);
    toast('Error de conexión al actualizar el pedido.', true);
  } else {
    toast(`Pedido ${cod} → ${nuevoEstado} ✓`);
    await cargarPedidosDesdeSupabase();
  }
}

function cambiarEstadoDesdeBoton(cod, estado) {
  actualizarEstadoEnNube(cod, estado);
}

function cancelarPedidoConfirmado(cod) {
  const p = pedidos.find(x => x.codigo === cod);
  if (!p) return;

  if (p.estado === 'Cancelado') {
    toast('Este pedido ya está cancelado.', true);
    return;
  }

  if (confirm(`¿Confirmas cancelar el pedido ${cod}?\nEsta acción no se puede deshacer.`)) {
    actualizarEstadoEnNube(cod, 'Cancelado');
  }
}

/* ─────────────────── MODAL DETALLE ─────────────────── */
function verDetalle(cod) {
  const p = pedidos.find(x => x.codigo === cod);
  if (!p) return;
  const bEst  = estadoBadge[p.estado]  || 'badge-registrado';
  const bPrio = prioBadge[p.prioridad] || 'badge-normal';
  const fechaAgradable = new Date(p.fecha_hora || p.fecha).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

  const detalles = p.pedido_detalle || [];

  document.getElementById('modalTitle').textContent = `Pedido ${p.codigo}`;
  document.getElementById('modalBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-row"><span class="d-label">Código</span><span class="d-val">${escapeHtml(p.codigo)}</span></div>
      <div class="detail-row"><span class="d-label">Mesa</span><span class="d-val">Mesa ${p.mesa}</span></div>
      <div class="detail-row"><span class="d-label">Mozo</span><span class="d-val">${escapeHtml(p.mozo_nombre || 'N/A')}</span></div>
      <div class="detail-row"><span class="d-label">Fecha/Hora</span><span class="d-val">${fechaAgradable}</span></div>
      <div class="detail-row"><span class="d-label">Estado</span><span class="d-val"><span class="badge ${bEst}">${escapeHtml(p.estado)}</span></span></div>
      <div class="detail-row"><span class="d-label">Prioridad</span><span class="d-val"><span class="badge ${bPrio}">${escapeHtml(p.prioridad)}</span></span></div>
      ${p.justificacion_prioridad ? `<div class="detail-row" style="grid-column:1/-1"><span class="d-label">Justificación urgencia</span><span class="d-val">${escapeHtml(p.justificacion_prioridad)}</span></div>` : ''}
      <div class="detail-row" style="grid-column:1/-1">
        <span class="d-label">Total</span>
        <span class="d-val" style="font-size:1.2rem;font-weight:700;color:var(--green-dk)">S/ ${parseFloat(p.total).toFixed(2)}</span>
      </div>
    </div>

    <div class="detail-dishes-title">🍽 Platos del pedido</div>
    <div style="display:grid;grid-template-columns:2fr .5fr .8fr 1fr;gap:.4rem;padding:.4rem .7rem;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-soft);">
      <span>Plato</span><span>Cant.</span><span>P.Unit.</span><span>Subtotal</span>
    </div>
    ${detalles.length ? detalles.map(d => {
      const nombrePlato = d.plato ? d.plato.nombre : 'Plato';
      const alergenos   = d.plato?.alergenos || [];
      const alergStr    = Array.isArray(alergenos) ? alergenos.join(', ') : '';
      return `
      <div class="detail-dish-row">
        <div class="ddr-name">${escapeHtml(nombrePlato)}
          ${alergStr ? `<div class="detail-dish-obs">⚠ Alérgenos: ${escapeHtml(alergStr)}</div>` : ''}
          ${d.observacion ? `<div class="detail-dish-obs">📝 ${escapeHtml(d.observacion)}</div>` : ''}
        </div>
        <div>${d.cantidad}</div>
        <div>S/ ${parseFloat(d.precio_unitario||0).toFixed(2)}</div>
        <div><strong>S/ ${parseFloat(d.subtotal||0).toFixed(2)}</strong></div>
      </div>`;
    }).join('') : '<p style="padding:.5rem .7rem;color:var(--text-soft)">Sin detalles disponibles.</p>'}

    <div style="text-align:right;padding:1rem .7rem;font-size:1.1rem;font-weight:700;color:var(--green-dk);border-top:2px solid var(--border);margin-top:.5rem;">
      TOTAL: S/ ${parseFloat(p.total).toFixed(2)}
    </div>
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