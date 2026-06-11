/* =======================================================
   MÓDULO 1: GESTIÓN DE PLATOS - Integrado con Supabase
   ======================================================= */

let platos = [];
let modoEdicion = false;
let codigoEdicionActual = '';

const formPlatos = document.getElementById('form-platos');
const btnGuardar = document.getElementById('btn-guardar');
const btnCancelar = document.getElementById('btn-cancelar');
const listaPlatos = document.getElementById('lista-platos');
const inputBuscar = document.getElementById('buscar-plato');
const selectFiltroEstado = document.getElementById('filtro-estado');

const checksAlergenos = document.querySelectorAll('input[name="alergeno"]');
const chkNinguno = document.getElementById('alergeno-ninguno');
const chkOtro = document.getElementById('alergeno-otro');
const inputAlergenoDetalle = document.getElementById('alergeno-detalle');

document.addEventListener('DOMContentLoaded', () => {
    cargarPlatosDesdeSupabase();
    configurarEventosAlergenos();
    formPlatos.addEventListener('submit', manejarSubmit);
    btnCancelar.addEventListener('click', cancelarEdicion);
    inputBuscar.addEventListener('input', filtrarTabla);
    selectFiltroEstado.addEventListener('change', filtrarTabla);
});

/* ==========================================
   1. OPERACIONES CON SUPABASE
   ========================================== */
async function cargarPlatosDesdeSupabase() {
    listaPlatos.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando platos desde la nube...</td></tr>';

    const { data, error } = await window.clienteSupabase
        .from('platos')
        .select('*')
        .order('codigo', { ascending: true });

    if (error) {
        console.error("Error al cargar platos:", error);
        listaPlatos.innerHTML = '<tr><td colspan="6" style="text-align:center; color: red;">Error al conectar con la base de datos.</td></tr>';
        return;
    }

    platos = data || [];
    renderizarTabla();
}

/* ==========================================
   2. LÓGICA DE ALÉRGENOS
   ========================================== */
function configurarEventosAlergenos() {
    checksAlergenos.forEach(chk => {
        chk.addEventListener('change', (e) => {
            if (e.target === chkNinguno && chkNinguno.checked) {
                checksAlergenos.forEach(c => {
                    if (c !== chkNinguno) c.checked = false;
                });
            } else if (e.target !== chkNinguno && e.target.checked) {
                chkNinguno.checked = false;
            }

            if (chkOtro.checked) {
                inputAlergenoDetalle.classList.remove('oculto');
                inputAlergenoDetalle.style.display = 'block';
                inputAlergenoDetalle.required = true;
            } else {
                inputAlergenoDetalle.classList.add('oculto');
                inputAlergenoDetalle.style.display = 'none';
                inputAlergenoDetalle.value = '';
                inputAlergenoDetalle.required = false;
            }
        });
    });
}

function obtenerAlergenosSeleccionados() {
    let seleccionados = [];
    checksAlergenos.forEach(chk => {
        if (chk.checked) {
            if (chk.value === 'Otro') {
                seleccionados.push(`Otro: ${inputAlergenoDetalle.value.trim()}`);
            } else {
                seleccionados.push(chk.value);
            }
        }
    });
    return seleccionados;
}

/* ==========================================
   3. MANEJO DEL FORMULARIO (Inserción y Actualización)
   ========================================== */
async function manejarSubmit(e) {
    e.preventDefault();

    const codigo = document.getElementById('codigo').value.trim().toUpperCase();
    const nombre = document.getElementById('nombre').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const categoria = document.getElementById('categoria').value;
    const precio = parseFloat(document.getElementById('precio').value);
    const tiempo_preparacion = parseInt(document.getElementById('tiempo').value);
    const estado = document.getElementById('estado').value;
    const ingredientes_modificables = document.getElementById('modificables').value.trim();
    const alergenos = obtenerAlergenosSeleccionados();

    // Limpiar errores anteriores
    document.getElementById('error-codigo').textContent = '';
    document.getElementById('error-nombre').textContent = '';
    document.getElementById('error-alergenos').textContent = '';

    // Validaciones
    if (alergenos.length === 0) {
        document.getElementById('error-alergenos').textContent = 'Debe seleccionar al menos una opción de alérgenos.';
        return;
    }

    const esSoloNumeros = /^[0-9\s]+$/.test(nombre);
    if (esSoloNumeros) {
        document.getElementById('error-nombre').textContent = 'El nombre no puede estar compuesto únicamente por números.';
        return;
    }

    if (precio < 0) {
        document.getElementById('error-codigo').textContent = 'El precio no puede ser negativo.';
        return;
    }

    if (!tiempo_preparacion || tiempo_preparacion < 1) {
        document.getElementById('error-codigo').textContent = 'El tiempo de preparación debe ser al menos 1 minuto.';
        return;
    }

    // Verificar duplicado de código directamente en Supabase (no solo en array local)
    if (!modoEdicion) {
        const { data: existente, error: errBusqueda } = await window.clienteSupabase
            .from('platos')
            .select('codigo')
            .eq('codigo', codigo)
            .maybeSingle();

        if (errBusqueda) {
            document.getElementById('error-codigo').textContent = 'Error al verificar el código. Intenta de nuevo.';
            return;
        }

        if (existente) {
            document.getElementById('error-codigo').textContent = 'Este código ya está registrado en la base de datos.';
            return;
        }
    }

    // Obtener el ID del perfil en usuarios_perfil (no el auth user id directamente)
    let creadoPorId = null;
    const usuario = await window.obtenerUsuarioActual();
    if (usuario) {
        const { data: perfil } = await window.clienteSupabase
            .from('usuarios_perfil')
            .select('id')
            .eq('user_id', usuario.id)
            .maybeSingle();
        if (perfil) creadoPorId = perfil.id;
    }

    const platoData = {
        codigo, nombre, descripcion, categoria,
        precio, tiempo_preparacion, estado, alergenos,
        ingredientes_modificables,
        creado_por: creadoPorId
    };


    btnGuardar.textContent = 'Guardando...';
    btnGuardar.disabled = true;

    if (modoEdicion) {
        // ACTUALIZAR EN SUPABASE
        const { error } = await window.clienteSupabase
            .from('platos')
            .update(platoData)
            .eq('codigo', codigoEdicionActual);

        if (error) {
            let msg = 'Error al actualizar en la nube.';
            if (error.code === '23505') msg = 'Ya existe un plato con ese código.';
            alert(msg);
            console.error(error);
        } else {
            alert('Plato actualizado correctamente.');
        }
    } else {
        // INSERTAR EN SUPABASE
        const { error } = await window.clienteSupabase
            .from('platos')
            .insert([platoData]);

        if (error) {
            let msg = 'Error al registrar en la nube.';
            if (error.code === '23505') msg = 'Ya existe un plato con ese código. Usa un código diferente.';
            alert(msg);
            console.error(error);
        } else {
            alert('Plato registrado correctamente.');
        }
    }

    btnGuardar.textContent = 'Guardar Plato';
    btnGuardar.disabled = false;
    cancelarEdicion();
    await cargarPlatosDesdeSupabase();
}

/* ==========================================
   4. RENDERIZADO DE LA TABLA Y FILTROS
   ========================================== */
function renderizarTabla(platosAMostrar = platos) {
    listaPlatos.innerHTML = '';

    if (platosAMostrar.length === 0) {
        listaPlatos.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay platos registrados.</td></tr>';
        return;
    }

    platosAMostrar.forEach(plato => {
        const tr = document.createElement('tr');
        const badgeClass = plato.estado === 'Activo' ? 'badge activo' : 'badge inactivo';

        tr.innerHTML = `
            <td><strong>${plato.codigo}</strong></td>
            <td>${plato.nombre}</td>
            <td>${plato.categoria}</td>
            <td>S/ ${parseFloat(plato.precio).toFixed(2)}</td>
            <td><span class="${badgeClass}">${plato.estado}</span></td>
            <td>
                <button type="button" class="btn-accion btn-editar" onclick="cargarDatosEdicion('${plato.codigo}')">Editar</button>
                <button type="button" class="btn-accion btn-estado" onclick="cambiarEstado('${plato.codigo}')">
                    ${plato.estado === 'Activo' ? 'Desactivar' : 'Activar'}
                </button>
                <button type="button" class="btn-accion btn-eliminar" onclick="eliminarPlato('${plato.codigo}')">Eliminar</button>
            </td>
        `;
        listaPlatos.appendChild(tr);
    });
}

function filtrarTabla() {
    const textoBuscado = inputBuscar.value.toLowerCase().trim();
    const estadoFiltro = selectFiltroEstado.value;

    const filtrados = platos.filter(plato => {
        const coincideTexto = plato.nombre.toLowerCase().includes(textoBuscado) ||
                              plato.categoria.toLowerCase().includes(textoBuscado);
        const coincideEstado = estadoFiltro === 'Todos' || plato.estado === estadoFiltro;
        return coincideTexto && coincideEstado;
    });

    renderizarTabla(filtrados);
}

/* ==========================================
   5. ACCIONES DE LA TABLA (CRUD con Supabase)
   ========================================== */
function cargarDatosEdicion(codigo) {
    const plato = platos.find(p => p.codigo === codigo);
    if (!plato) return;

    modoEdicion = true;
    codigoEdicionActual = codigo;

    document.getElementById('codigo').value = plato.codigo;
    document.getElementById('codigo').disabled = true;
    document.getElementById('nombre').value = plato.nombre;
    document.getElementById('descripcion').value = plato.descripcion;
    document.getElementById('categoria').value = plato.categoria;
    document.getElementById('precio').value = plato.precio;
    document.getElementById('tiempo').value = plato.tiempo_preparacion || plato.tiempo;
    document.getElementById('estado').value = plato.estado;
    document.getElementById('modificables').value = plato.ingredientes_modificables || plato.modificables || '';

    checksAlergenos.forEach(chk => chk.checked = false);
    inputAlergenoDetalle.classList.add('oculto');
    inputAlergenoDetalle.style.display = 'none';

    const alergenosArray = Array.isArray(plato.alergenos) ? plato.alergenos : JSON.parse(plato.alergenos || '[]');

    alergenosArray.forEach(alergeno => {
        if (alergeno.startsWith('Otro:')) {
            chkOtro.checked = true;
            inputAlergenoDetalle.classList.remove('oculto');
            inputAlergenoDetalle.style.display = 'block';
            inputAlergenoDetalle.value = alergeno.replace('Otro: ', '').trim();
            inputAlergenoDetalle.required = true;
        } else {
            const chk = document.querySelector(`input[name="alergeno"][value="${alergeno}"]`);
            if (chk) chk.checked = true;
        }
    });

    btnGuardar.textContent = 'Actualizar Plato';
    btnCancelar.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    modoEdicion = false;
    codigoEdicionActual = '';
    formPlatos.reset();

    document.getElementById('codigo').disabled = false;
    inputAlergenoDetalle.classList.add('oculto');
    inputAlergenoDetalle.style.display = 'none';
    inputAlergenoDetalle.required = false;

    document.getElementById('error-codigo').textContent = '';
    document.getElementById('error-nombre').textContent = '';
    document.getElementById('error-alergenos').textContent = '';

    btnGuardar.textContent = 'Guardar Plato';
    btnCancelar.style.display = 'none';
}

async function cambiarEstado(codigo) {
    const plato = platos.find(p => p.codigo === codigo);
    if (!plato) return;

    const nuevoEstado = plato.estado === 'Activo' ? 'Inactivo' : 'Activo';

    const { error } = await window.clienteSupabase
        .from('platos')
        .update({ estado: nuevoEstado })
        .eq('codigo', codigo);

    if (error) {
        alert('Error al cambiar el estado en la base de datos.');
        console.error(error);
    } else {
        await cargarPlatosDesdeSupabase();
    }
}

async function eliminarPlato(codigo) {
    if (confirm(`¿Estás seguro de que deseas eliminar el plato con código ${codigo}?\nEsta acción no se puede deshacer.`)) {

        const { error } = await window.clienteSupabase
            .from('platos')
            .delete()
            .eq('codigo', codigo);

        if (error) {
            alert('Error al eliminar el plato de la base de datos.');
            console.error(error);
        } else {
            await cargarPlatosDesdeSupabase();
        }
    }
}