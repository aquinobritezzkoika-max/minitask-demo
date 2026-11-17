-- ==============================================================================
-- Proyecto MiniTask: Esquema de Base de Datos y Políticas de Seguridad (RLS)
-- ==============================================================================
-- Tabla: tasks
-- Permite a cada usuario gestionar sus tareas de forma aislada y segura
-- utilizando autenticación anónima de Supabase y Row Level Security (RLS).
-- ==============================================================================

-- 1. Crear extensión pgcrypto para generación de UUID si no existe
create extension if not exists "pgcrypto";

-- 2. Crear tabla de tareas (tasks)
create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    title text not null check (char_length(trim(title)) > 0),
    completed boolean not null default false,
    created_at timestamptz not null default now()
);

-- 3. Crear índices para optimizar consultas por usuario y fecha
create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_created_at on public.tasks(created_at desc);

-- 4. Activar Row Level Security (RLS)
-- Es indispensable para garantizar que ningún usuario acceda a datos ajenos
alter table public.tasks enable row level security;

-- 5. Políticas de Seguridad (RLS)
-- En Supabase, las sesiones anónimas reciben el rol PostgreSQL 'authenticated'.
-- Usamos 'to authenticated' combinado con la verificación explícita de propiedad ((select auth.uid()) = user_id).

-- Política de Lectura (SELECT)
drop policy if exists "Los usuarios pueden consultar unicamente sus tareas" on public.tasks;
create policy "Los usuarios pueden consultar unicamente sus tareas"
    on public.tasks
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

-- Política de Creación (INSERT)
drop policy if exists "Los usuarios pueden insertar unicamente sus tareas" on public.tasks;
create policy "Los usuarios pueden insertar unicamente sus tareas"
    on public.tasks
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

-- Política de Modificación (UPDATE)
drop policy if exists "Los usuarios pueden actualizar unicamente sus tareas" on public.tasks;
create policy "Los usuarios pueden actualizar unicamente sus tareas"
    on public.tasks
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- Política de Eliminación (DELETE)
drop policy if exists "Los usuarios pueden eliminar unicamente sus tareas" on public.tasks;
create policy "Los usuarios pueden eliminar unicamente sus tareas"
    on public.tasks
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);

-- 6. Otorgar permisos al rol authenticated (requerido para Data API / PostgREST)
grant all on table public.tasks to authenticated;
