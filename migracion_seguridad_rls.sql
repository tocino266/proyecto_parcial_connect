-- ============================================================
-- MIGRACIÓN DE SEGURIDAD: RLS Policies restrictivas por rol
-- Ejecutar en el SQL Editor del dashboard de Supabase
-- ============================================================
-- INSTRUCCIONES:
-- 1. Ve a tu dashboard de Supabase → SQL Editor
-- 2. Pega TODO este script y ejecútalo
-- 3. Si algún DROP POLICY da error "does not exist", ignóralo
-- ============================================================

-- ============================================================
-- PASO 1: ELIMINAR POLÍTICAS PERMISIVAS EXISTENTES
-- ============================================================

-- platos
DROP POLICY IF EXISTS "platos: cualquier autenticado puede leer" ON public.platos;
DROP POLICY IF EXISTS "platos: cualquier autenticado puede insertar" ON public.platos;
DROP POLICY IF EXISTS "platos: cualquier autenticado puede actualizar" ON public.platos;
DROP POLICY IF EXISTS "platos: cualquier autenticado puede eliminar" ON public.platos;

-- pedidos
DROP POLICY IF EXISTS "pedidos: cualquier autenticado puede leer" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos: cualquier autenticado puede insertar" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos: cualquier autenticado puede actualizar" ON public.pedidos;

-- facturas
DROP POLICY IF EXISTS "facturas: cualquier autenticado puede leer" ON public.facturas;
DROP POLICY IF EXISTS "facturas: cualquier autenticado puede insertar" ON public.facturas;

-- pedido_detalle (si existe)
DROP POLICY IF EXISTS "pedido_detalle: cualquier autenticado puede leer" ON public.pedido_detalle;
DROP POLICY IF EXISTS "pedido_detalle: cualquier autenticado puede insertar" ON public.pedido_detalle;
DROP POLICY IF EXISTS "pedido_detalle: cualquier autenticado puede actualizar" ON public.pedido_detalle;
DROP POLICY IF EXISTS "pedido_detalle: cualquier autenticado puede eliminar" ON public.pedido_detalle;

-- ============================================================
-- PASO 2: CREAR POLÍTICAS RESTRICTIVAS POR ROL
-- Se usa auth.jwt() -> 'user_metadata' ->> 'rol' para leer
-- el rol directamente desde el token JWT del usuario.
-- ============================================================

-- =========================
-- PLATOS
-- =========================

-- Todos pueden ver los platos (el menú es público para autenticados)
CREATE POLICY "platos: autenticados pueden leer"
ON public.platos FOR SELECT TO authenticated
USING (true);

-- Solo Administrador puede crear platos
CREATE POLICY "platos: solo admin puede insertar"
ON public.platos FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'rol') = 'Administrador'
);

-- Solo Administrador puede editar platos
CREATE POLICY "platos: solo admin puede actualizar"
ON public.platos FOR UPDATE TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'rol') = 'Administrador'
);

-- Solo Administrador puede eliminar platos
CREATE POLICY "platos: solo admin puede eliminar"
ON public.platos FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'rol') = 'Administrador'
);

-- =========================
-- PEDIDOS
-- =========================

-- Todos los autenticados pueden ver pedidos
CREATE POLICY "pedidos: autenticados pueden leer"
ON public.pedidos FOR SELECT TO authenticated
USING (true);

-- Solo Mozo y Administrador pueden crear pedidos
CREATE POLICY "pedidos: mozo y admin pueden insertar"
ON public.pedidos FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('Mozo', 'Administrador')
);

-- Todos pueden actualizar pedidos (Cocina cambia estado, Mozo entrega, etc.)
CREATE POLICY "pedidos: autenticados pueden actualizar"
ON public.pedidos FOR UPDATE TO authenticated
USING (true);

-- Solo Administrador puede eliminar pedidos
CREATE POLICY "pedidos: solo admin puede eliminar"
ON public.pedidos FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'rol') = 'Administrador'
);

-- =========================
-- PEDIDO_DETALLE
-- =========================

-- Habilitar RLS si no está habilitada
ALTER TABLE IF EXISTS public.pedido_detalle ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver detalles
CREATE POLICY "pedido_detalle: autenticados pueden leer"
ON public.pedido_detalle FOR SELECT TO authenticated
USING (true);

-- Solo Mozo y Admin pueden insertar detalles (al crear pedidos)
CREATE POLICY "pedido_detalle: mozo y admin pueden insertar"
ON public.pedido_detalle FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('Mozo', 'Administrador')
);

-- Todos pueden actualizar detalles (Cocina actualiza estado_cocina)
CREATE POLICY "pedido_detalle: autenticados pueden actualizar"
ON public.pedido_detalle FOR UPDATE TO authenticated
USING (true);

-- Solo Admin puede eliminar detalles
CREATE POLICY "pedido_detalle: solo admin puede eliminar"
ON public.pedido_detalle FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'rol') = 'Administrador'
);

-- =========================
-- FACTURAS
-- =========================

-- Todos pueden ver facturas
CREATE POLICY "facturas: autenticados pueden leer"
ON public.facturas FOR SELECT TO authenticated
USING (true);

-- Solo Caja y Administrador pueden crear facturas
CREATE POLICY "facturas: caja y admin pueden insertar"
ON public.facturas FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('Caja', 'Administrador')
);

-- Solo Administrador puede eliminar facturas
CREATE POLICY "facturas: solo admin puede eliminar"
ON public.facturas FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'rol') = 'Administrador'
);

-- ============================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================
-- Resumen de permisos:
--
-- | Tabla           | SELECT | INSERT         | UPDATE | DELETE |
-- |-----------------|--------|----------------|--------|--------|
-- | platos          | Todos  | Admin          | Admin  | Admin  |
-- | pedidos         | Todos  | Mozo, Admin    | Todos  | Admin  |
-- | pedido_detalle  | Todos  | Mozo, Admin    | Todos  | Admin  |
-- | facturas        | Todos  | Caja, Admin    | —      | Admin  |
-- | usuarios_perfil | Propio | Propio         | Propio | —      |
-- ============================================================
