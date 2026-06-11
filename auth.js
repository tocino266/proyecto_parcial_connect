// auth.js — Lógica de Autenticación con Supabase

// Cambiar entre vistas de Login y Registro
function toggleAuth(view) {
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (view === 'register') {
        formLogin.classList.add('hidden');
        formRegister.classList.remove('hidden');
    } else {
        formRegister.classList.add('hidden');
        formLogin.classList.remove('hidden');
    }
}

// ==========================================
// 1. LÓGICA DE REGISTRO
// ==========================================
document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('reg-nombre').value.trim();
    const rol = document.getElementById('reg-rol').value;
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const errorBox = document.getElementById('register-error');
    const btn = document.getElementById('btn-register');

    errorBox.classList.add('hidden');

    // Validaciones del lado del cliente
    if (!nombre || nombre.length < 3) {
        errorBox.textContent = "El nombre completo es obligatorio (mínimo 3 caracteres).";
        errorBox.classList.remove('hidden');
        return;
    }

    if (!rol) {
        errorBox.textContent = "Debes seleccionar un rol.";
        errorBox.classList.remove('hidden');
        return;
    }

    if (password.length < 6) {
        errorBox.textContent = "La contraseña debe tener al menos 6 caracteres.";
        errorBox.classList.remove('hidden');
        return;
    }

    if (password !== confirm) {
        errorBox.textContent = "Las contraseñas no coinciden.";
        errorBox.classList.remove('hidden');
        return;
    }

    btn.textContent = "Registrando...";
    btn.disabled = true;

    // 1. Registrar en Supabase Auth
    const { data, error } = await window.clienteSupabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                nombre: nombre,
                rol: rol
            }
        }
    });

    if (error) {
        // Mensajes de error claros y en español
        let mensajeError = "Error al registrar: " + error.message;
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
            mensajeError = "Este correo electrónico ya está registrado. Intenta iniciar sesión.";
        } else if (error.message.includes('invalid email') || error.message.includes('Invalid email')) {
            mensajeError = "El formato del correo electrónico no es válido.";
        } else if (error.message.includes('Password should be')) {
            mensajeError = "La contraseña debe tener al menos 6 caracteres.";
        }
        errorBox.textContent = mensajeError;
        errorBox.classList.remove('hidden');
        btn.textContent = "Registrar Usuario";
        btn.disabled = false;
        return;
    }

    // 2. Si el registro en Auth fue exitoso, guardar el perfil en la tabla usuarios_perfil
    if (data && data.user) {
        const { error: errPerfil } = await window.clienteSupabase
            .from('usuarios_perfil')
            .insert([{
                user_id: data.user.id,
                nombre: nombre,
                correo: email,
                rol: rol
            }]);

        if (errPerfil) {
            // El usuario se creó en Auth pero falló el perfil — informar sin bloquear
            console.warn("Advertencia: No se pudo guardar el perfil en la BD.", errPerfil.message);
        }
    }

    btn.textContent = "Registrar Usuario";
    btn.disabled = false;

    alert("¡Registro exitoso! Ya puedes iniciar sesión.");
    document.getElementById('form-register').reset();
    toggleAuth('login');
});

// ==========================================
// 2. LÓGICA DE LOGIN
// ==========================================
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorBox = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    errorBox.classList.add('hidden');

    // Validaciones básicas del lado del cliente
    if (!email) {
        errorBox.textContent = "El correo electrónico es obligatorio.";
        errorBox.classList.remove('hidden');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorBox.textContent = "El correo electrónico no tiene un formato válido.";
        errorBox.classList.remove('hidden');
        return;
    }

    if (!password) {
        errorBox.textContent = "La contraseña es obligatoria.";
        errorBox.classList.remove('hidden');
        return;
    }

    btn.textContent = "Ingresando...";
    btn.disabled = true;

    const { data, error } = await window.clienteSupabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    btn.textContent = "Ingresar";
    btn.disabled = false;

    if (error) {
        errorBox.textContent = "Credenciales incorrectas. Verifica tu correo y contraseña.";
        errorBox.classList.remove('hidden');
    } else {
        // Verificar que el usuario tiene rol asignado antes de ingresar
        const rol = data.user?.user_metadata?.rol;
        if (!rol) {
            errorBox.textContent = "Tu cuenta no tiene un rol asignado. Comunícate con el administrador.";
            errorBox.classList.remove('hidden');
            await window.clienteSupabase.auth.signOut();
            return;
        }
        window.location.href = 'index.html';
    }
});