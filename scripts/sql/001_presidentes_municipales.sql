-- ============================================================
-- Módulo: Presidentes Municipales (Gira 217 municipios)
-- Tabla independiente de `asistentes`. No afecta el evento actual.
-- Correr en: Supabase → SQL Editor
-- ============================================================

-- 1. Tabla ----------------------------------------------------
create table if not exists public.presidentes_municipales (
  id                uuid primary key default gen_random_uuid(),
  cve_ine           text unique,                -- clave INE del municipio (001..217)
  municipio         text not null,
  nombre            text not null,              -- nombre del presidente(a)
  partido           text,                       -- filiación (MORENA, PRI, PVEM, ...)
  telefono          text,                       -- del Excel de la gira
  dia               smallint,                   -- 1..4 (null = sin asignar)
  foto_url          text,                       -- URL pública en Supabase Storage
  asistio           boolean not null default false,
  acompanante       boolean not null default false,  -- llegó con acompañante sí/no
  fecha_asistencia  timestamptz,
  registrado_por    uuid references public.usuarios(id) on delete set null,
  observaciones     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_pm_dia        on public.presidentes_municipales (dia);
create index if not exists idx_pm_asistio    on public.presidentes_municipales (asistio);
create index if not exists idx_pm_partido    on public.presidentes_municipales (partido);
create index if not exists idx_pm_municipio  on public.presidentes_municipales (municipio);

-- 2. Trigger updated_at --------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_pm_updated_at on public.presidentes_municipales;
create trigger trg_pm_updated_at
  before update on public.presidentes_municipales
  for each row execute function public.set_updated_at();

-- 3. RLS ------------------------------------------------------
-- Igual que `asistentes`: cualquier usuario autenticado puede leer y
-- actualizar (marcar asistencia / reasignar día). Inserción/borrado
-- solo vía service_role (scripts de carga).
alter table public.presidentes_municipales enable row level security;

drop policy if exists "pm_select_auth" on public.presidentes_municipales;
create policy "pm_select_auth"
  on public.presidentes_municipales
  for select
  to authenticated
  using (true);

drop policy if exists "pm_update_auth" on public.presidentes_municipales;
create policy "pm_update_auth"
  on public.presidentes_municipales
  for update
  to authenticated
  using (true)
  with check (true);

-- 4. Storage: bucket público para fotos ----------------------
insert into storage.buckets (id, name, public)
values ('presidentes', 'presidentes', true)
on conflict (id) do nothing;

-- Lectura pública de las fotos
drop policy if exists "pm_fotos_public_read" on storage.objects;
create policy "pm_fotos_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'presidentes');
