-- ============================================================
-- Migración 004: Evento independiente "Desayuno Consejeros MORENA"
-- (12-07-26). Tabla propia, aislada de presidentes_municipales:
-- lista y estadísticas totalmente independientes.
--
-- Entidad: consejero(a) de MORENA, agrupado por DISTRITO FEDERAL
-- (agrupador regional, no partido). Evento de un solo día, sin
-- concepto de "día 1..4" ni de acompañante.
--
-- Correr en: Supabase → SQL Editor  o  scripts/run_migration.js
-- Idempotente (IF NOT EXISTS). No toca ninguna otra tabla.
-- ============================================================

-- 1. Tabla ----------------------------------------------------
create table if not exists public.consejeros_desayuno (
  id                uuid primary key default gen_random_uuid(),
  numero            smallint unique,            -- "Dtto" consecutivo (1..152) del Excel
  distrito          text,                       -- DISTRITO FEDERAL (agrupador regional)
  municipio_origen  text,                       -- municipio de origen del consejero
  nombre            text not null,              -- nombre del consejero(a)
  telefono          text,
  confirmacion      text,                       -- RSVP previo: Confirmado / Enviado / No asiste
  asistio           boolean not null default false,
  fecha_asistencia  timestamptz,
  registrado_por    uuid references public.usuarios(id) on delete set null,
  observaciones     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_cd_distrito  on public.consejeros_desayuno (distrito);
create index if not exists idx_cd_asistio    on public.consejeros_desayuno (asistio);
create index if not exists idx_cd_confirma   on public.consejeros_desayuno (confirmacion);

-- 2. Trigger updated_at (reutiliza la función creada en 001) --
drop trigger if exists trg_cd_updated_at on public.consejeros_desayuno;
create trigger trg_cd_updated_at
  before update on public.consejeros_desayuno
  for each row execute function public.set_updated_at();

-- 3. RLS — igual que presidentes_municipales -----------------
-- Cualquier usuario autenticado lee y actualiza (marcar asistencia).
-- Inserción/borrado solo vía service_role (script de carga).
alter table public.consejeros_desayuno enable row level security;

drop policy if exists "cd_select_auth" on public.consejeros_desayuno;
create policy "cd_select_auth"
  on public.consejeros_desayuno
  for select
  to authenticated
  using (true);

drop policy if exists "cd_update_auth" on public.consejeros_desayuno;
create policy "cd_update_auth"
  on public.consejeros_desayuno
  for update
  to authenticated
  using (true)
  with check (true);
