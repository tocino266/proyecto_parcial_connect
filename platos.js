/* =======================================================
   MÓDULO 1: GESTIÓN DE PLATOS - Lógica de Negocio
   ======================================================= */

// Variables globales del módulo
let platos = [];
let modoEdicion = false;
let codigoEdicionActual = '';

// Elementos del DOM
const formPlatos = document.getElementById('form-platos');
const btnGuardar = document.getElementById('btn-guardar');
const btnCancelar = document.getElementById('btn-cancelar');
const listaPlatos = document.getElementById('lista-platos');
const inputBuscar = document.getElementById('buscar-plato');
const selectFiltroEstado = document.getElementById('filtro-estado');

// Inputs de Alérgenos
const checksAlergenos = document.querySelectorAll('input[name="alergeno"]');
const chkNinguno = document.getElementById('alergeno-ninguno');
const chkOtro = document.getElementById('alergeno-otro');
const inputAlergenoDetalle = document.getElementById('alergeno-detalle');

// Inicialización cuando carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    cargarPlatosDelStorage();
    renderizarTabla();
    configurarEventosAlergenos();
    
    // Event Listeners principales
    formPlatos.addEventListener('submit', manejarSubmit);
    btnCancelar.addEventListener('click', cancelarEdicion);
    inputBuscar.addEventListener('input', filtrarTabla);
    selectFiltroEstado.addEventListener('change', filtrarTabla);
});

/* ==========================================
   1. LECTURA Y ESCRITURA EN LOCALSTORAGE
   ========================================== */
function cargarPlatosDelStorage() {
    const datosGuardados = localStorage.getItem('platos');
    if (datosGuardados) {
        platos = JSON.parse(datosGuardados);
    }
}

function guardarPlatosEnStorage() {
    localStorage.setItem('platos', JSON.stringify(platos));
}

/* ==========================================
   2. LÓGICA DE ALÉRGENOS (Interacción Visual)
   ========================================== */
function configurarEventosAlergenos() {
    checksAlergenos.forEach(chk => {
        chk.addEventListener('change', (e) => {
            
            // Regla 1: Si se marca "Ninguno", desmarcar todos los demás
            if (e.target === chkNinguno && chkNinguno.checked) {
                checksAlergenos.forEach(c => {
                    if (c !== chkNinguno) c.checked = false;
                });
            } 
            // Regla 2: Si se marca cualquier otro (incluido "Otro"), desmarcar "Ninguno"
            else if (e.target !== chkNinguno && e.target.checked) {
                chkNinguno.checked = false;
            }

            // Regla 3: Manejo independiente del campo de texto para "Otro"
            if (chkOtro.checked) {
                inputAlergenoDetalle.classList.remove('oculto'); // Quitamos la clase que bloqueaba
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
                // Guardamos "Otro: [detalle]"
                seleccionados.push(`Otro: ${inputAlergenoDetalle.value.trim()}`);
            } else {
                seleccionados.push(chk.value);
            }
        }
    });
    return seleccionados;
}

/* ==========================================
   3. MANEJO DEL FORMULARIO Y VALIDACIONES
   ========================================== */
function manejarSubmit(e) {
    e.preventDefault();

    // Capturar valores
    const codigo = document.getElementById('codigo').value.trim().toUpperCase();
    const nombre = document.getElementById('nombre').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const categoria = document.getElementById('categoria').value;
    const precio = parseFloat(document.getElementById('precio').value);
    const tiempo = parseInt(document.getElementById('tiempo').value);
    const estado = document.getElementById('estado').value;
    const modificables = document.getElementById('modificables').value.trim();
    const alergenos = obtenerAlergenosSeleccionados();

    // Limpiar errores previos
    document.getElementById('error-codigo').textContent = '';
    document.getElementById('error-nombre').textContent = '';
    document.getElementById('error-alergenos').textContent = '';

    // Validar: Al menos un alérgeno
    if (alergenos.length === 0) {
        document.getElementById('error-alergenos').textContent = 'Debe seleccionar al menos una opción.';
        return;
    }

    // Validar: Nombre no debe ser solo números[cite: 2]
    const esSoloNumeros = /^[0-9\s]+$/.test(nombre);
    if (esSoloNumeros) {
        document.getElementById('error-nombre').textContent = 'El nombre no puede estar compuesto únicamente por números.';
        return;
    }

    // Validar: Código único (solo en creación)
    if (!modoEdicion) {
        const existeCodigo = platos.some(p => p.codigo === codigo);
        if (existeCodigo) {
            document.getElementById('error-codigo').textContent = 'Este código ya está registrado.';
            return;
        }
    }

    // Crear objeto
    const nuevoPlato = {
        codigo,
        nombre,
        descripcion,
        categoria,
        precio,
        tiempo,
        estado,
        alergenos,
        modificables
    };

    // Guardar/Actualizar
    if (modoEdicion) {
        const index = platos.findIndex(p => p.codigo === codigoEdicionActual);
        if (index !== -1) platos[index] = nuevoPlato;
        alert('Plato actualizado correctamente.');
    } else {
        platos.push(nuevoPlato);
        alert('Plato registrado correctamente.');
    }

    // Persistir y refrescar
    guardarPlatosEnStorage();
    cancelarEdicion();
    renderizarTabla();
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
            <td>S/ ${plato.precio.toFixed(2)}</td>
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
   5. ACCIONES DE LA TABLA (CRUD)
   ========================================== */
function cargarDatosEdicion(codigo) {
    const plato = platos.find(p => p.codigo === codigo);
    if (!plato) return;

    modoEdicion = true;
    codigoEdicionActual = codigo;

    // Rellenar formulario
    document.getElementById('codigo').value = plato.codigo;
    document.getElementById('codigo').disabled = true;
    document.getElementById('nombre').value = plato.nombre;
    document.getElementById('descripcion').value = plato.descripcion;
    document.getElementById('categoria').value = plato.categoria;
    document.getElementById('precio').value = plato.precio;
    document.getElementById('tiempo').value = plato.tiempo;
    document.getElementById('estado').value = plato.estado;
    document.getElementById('modificables').value = plato.modificables;

    // Resetear alérgenos
    checksAlergenos.forEach(chk => chk.checked = false);
    inputAlergenoDetalle.classList.add('oculto');
    inputAlergenoDetalle.style.display = 'none';
    
    // Marcar los correspondientes (incluyendo el despliegue de "Otro")
    plato.alergenos.forEach(alergeno => {
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

function cambiarEstado(codigo) {
    const index = platos.findIndex(p => p.codigo === codigo);
    if (index !== -1) {
        platos[index].estado = platos[index].estado === 'Activo' ? 'Inactivo' : 'Activo';
        guardarPlatosEnStorage();
        renderizarTabla();
        filtrarTabla(); 
    }
}

function eliminarPlato(codigo) {
    if (confirm(`¿Estás seguro de que deseas eliminar el plato con código ${codigo}?`)) {
        platos = platos.filter(p => p.codigo !== codigo);
        guardarPlatosEnStorage();
        renderizarTabla();
        filtrarTabla();
    }
}