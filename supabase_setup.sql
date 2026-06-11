-- ============================================================
-- SUPABASE SETUP - San Choclito Restaurante
-- Ejecutar en el SQL Editor del dashboard de Supabase
-- ============================================================

-- ============================================================
-- 1. TABLA: usuarios_perfil
-- Relacionada con auth.users de Supabase Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuarios_perfil (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    nombre text NOT NULL,
    correo text NOT NULL,
    rol text NOT NULL CHECK (rol IN ('Administrador', 'Mozo', 'Cocina', 'Caja')),
    fecha_creacion timestamptz DEFAULT now()
);

-- ============================================================
-- 2. TABLA: platos (en caso de que ya existe, omitir o ajustar)
-- Ejecuta solo si NO tienes esta tabla aún
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo text NOT NULL UNIQUE,
    nombre text NOT NULL,
    descripcion text,
    categoria text,
    precio numeric(10,2) NOT NULL CHECK (precio >= 0),
    tiempo integer CHECK (tiempo >= 0),     -- tiempo_preparacion en minutos
    estado text DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
    alergenos jsonb DEFAULT '[]'::jsonb,
    modificables text,
    creado_por uuid REFERENCES auth.users(id),
    fecha_creacion timestamptz DEFAULT now()
);

-- ============================================================
-- 3. TABLA: pedidos (en caso de que ya existe, omitir o ajustar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pedidos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo text NOT NULL UNIQUE,
    mozo text NOT NULL,
    mozo_id uuid REFERENCES auth.users(id),
    mesa integer NOT NULL CHECK (mesa >= 1 AND mesa <= 50),
    fecha timestamptz DEFAULT now(),
    prioridad text CHECK (prioridad IN ('Normal', 'Alta', 'Urgente')),
    justificacion text,
    estado text DEFAULT 'Registrado' CHECK (estado IN (
        'Registrado', 'Enviado a cocina', 'En preparación',
        'Listo para servir', 'Entregado', 'Cancelado', 'Facturado'
    )),
    platos jsonb DEFAULT '[]'::jsonb,
    total numeric(10,2) DEFAULT 0,
    historial jsonb DEFAULT '[]'::jsonb
);

-- ============================================================
-- 4. TABLA: facturas (en caso de que ya existe, omitir o ajustar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.facturas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nro text NOT NULL,
    mesa integer NOT NULL,
    total numeric(10,2) NOT NULL,
    fecha timestamptz DEFAULT now(),
    metodo text,
    codigos_pedidos jsonb DEFAULT '[]'::jsonb,  -- lista de codigos de pedidos facturados
    descuento numeric(10,2) DEFAULT 0,
    creado_por uuid REFERENCES auth.users(id)
);

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- Activar RLS en todas las tablas y crear políticas
-- ============================================================

-- Activar RLS
ALTER TABLE public.usuarios_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS: usuarios_perfil
-- ============================================================

-- Un usuario autenticado puede leer su propio perfil
CREATE POLICY "usuarios_perfil: leer propio"
ON public.usuarios_perfil
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Un usuario autenticado puede insertar su propio perfil
CREATE POLICY "usuarios_perfil: insertar propio"
ON public.usuarios_perfil
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Un usuario autenticado puede actualizar su propio perfil
CREATE POLICY "usuarios_perfil: actualizar propio"
ON public.usuarios_perfil
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================
-- POLÍTICAS: platos
-- Todos los usuarios autenticados pueden ver los platos
-- Solo Administrador y Mozo pueden crear/editar/eliminar
-- (El control fino se hace en JS; RLS permite a autenticados operar)
-- ============================================================

CREATE POLICY "platos: cualquier autenticado puede leer"
ON public.platos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "platos: cualquier autenticado puede insertar"
ON public.platos
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "platos: cualquier autenticado puede actualizar"
ON public.platos
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "platos: cualquier autenticado puede eliminar"
ON public.platos
FOR DELETE
TO authenticated
USING (true);

-- ============================================================
-- POLÍTICAS: pedidos
-- ============================================================

CREATE POLICY "pedidos: cualquier autenticado puede leer"
ON public.pedidos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "pedidos: cualquier autenticado puede insertar"
ON public.pedidos
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "pedidos: cualquier autenticado puede actualizar"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (true);

-- ============================================================
-- POLÍTICAS: facturas
-- ============================================================

CREATE POLICY "facturas: cualquier autenticado puede leer"
ON public.facturas
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "facturas: cualquier autenticado puede insertar"
ON public.facturas
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================
-- 6. FUNCIÓN: crear perfil automáticamente al registrarse
-- (Alternativa al insert manual desde JS)
-- Si usas esta función, NO necesitas el insert manual en auth.js
-- Pero lo mantenemos en JS para mayor control.
-- ============================================================

-- Esta función se ejecuta automáticamente cuando un usuario se registra en Auth
-- Solo úsala si quieres automatización total. Por ahora lo manejamos desde JS.
/*
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuarios_perfil (user_id, nombre, correo, rol)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nombre',
    NEW.email,
    NEW.raw_user_meta_data->>'rol'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
*/

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
-- Instrucciones:
-- 1. Ve a tu dashboard de Supabase: https://app.supabase.com
-- 2. Selecciona tu proyecto
-- 3. Ve a "SQL Editor"
-- 4. Pega este script y ejecuta
-- NOTA: Si las tablas platos/pedidos/facturas YA existen con datos,
--       solo ejecuta la sección de usuarios_perfil y las políticas RLS.
--       Las sentencias CREATE TABLE IF NOT EXISTS no romperán tablas existentes.
-- ============================================================
