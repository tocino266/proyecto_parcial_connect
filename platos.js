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
    // 1. Cargar datos desde Supabase al iniciar
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
    // Mostrar mensaje de carga opcional
    listaPlatos.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando platos desde la nube...</td></tr>';
    
    const { data, error } = await clienteSupabase
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
   2. LÓGICA DE ALÉRGENOS (Sin cambios)
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
    const tiempo = parseInt(document.getElementById('tiempo').value);
    const estado = document.getElementById('estado').value;
    const modificables = document.getElementById('modificables').value.trim();
    const alergenos = obtenerAlergenosSeleccionados();

    document.getElementById('error-codigo').textContent = '';
    document.getElementById('error-nombre').textContent = '';
    document.getElementById('error-alergenos').textContent = '';

    if (alergenos.length === 0) {
        document.getElementById('error-alergenos').textContent = 'Debe seleccionar al menos una opción.';
        return;
    }

    const esSoloNumeros = /^[0-9\s]+$/.test(nombre);
    if (esSoloNumeros) {
        document.getElementById('error-nombre').textContent = 'El nombre no puede estar compuesto únicamente por números.';
        return;
    }

    if (!modoEdicion) {
        const existeCodigo = platos.some(p => p.codigo === codigo);
        if (existeCodigo) {
            document.getElementById('error-codigo').textContent = 'Este código ya está registrado.';
            return;
        }
    }

    const platoData = {
        codigo, nombre, descripcion, categoria, 
        precio, tiempo, estado, alergenos, modificables
    };

    // Bloquear botón mientras guarda
    btnGuardar.textContent = 'Guardando...';
    btnGuardar.disabled = true;

    if (modoEdicion) {
        // ACTUALIZAR EN SUPABASE -> Usando clienteSupabase
        const { error } = await clienteSupabase
            .from('platos')
            .update(platoData)
            .eq('codigo', codigoEdicionActual);

        if (error) {
            alert('Error al actualizar en la nube.');
            console.error(error);
        } else {
            alert('Plato actualizado correctamente.');
        }
    } else {
        // INSERTAR EN SUPABASE -> Usando clienteSupabase
        const { error } = await clienteSupabase
            .from('platos')
            .insert([platoData]);

        if (error) {
            alert('Error al registrar en la nube.');
            console.error(error);
        } else {
            alert('Plato registrado correctamente.');
        }
    }

    btnGuardar.disabled = false;
    cancelarEdicion();
    // Recargar datos frescos de la base de datos
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
    document.getElementById('tiempo').value = plato.tiempo;
    document.getElementById('estado').value = plato.estado;
    document.getElementById('modificables').value = plato.modificables;

    checksAlergenos.forEach(chk => chk.checked = false);
    inputAlergenoDetalle.classList.add('oculto');
    inputAlergenoDetalle.style.display = 'none';
    
    // Al venir de Supabase (JSONB), asegúrate de que sea un array
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
    
    // Aquí está el cambio: clienteSupabase
    const { error } = await clienteSupabase
        .from('platos')
        .update({ estado: nuevoEstado })
        .eq('codigo', codigo);

    if (error) {
        alert('Error al cambiar el estado.');
        console.error(error);
    } else {
        await cargarPlatosDesdeSupabase();
    }
}

async function eliminarPlato(codigo) {
    if (confirm(`¿Estás seguro de que deseas eliminar el plato con código ${codigo}?`)) {
        
        // Aquí está el cambio: clienteSupabase
        const { error } = await clienteSupabase
            .from('platos')
            .delete()
            .eq('codigo', codigo);

        if (error) {
            alert('Error al eliminar el plato.');
            console.error(error);
        } else {
            await cargarPlatosDesdeSupabase();
        }
    }
}