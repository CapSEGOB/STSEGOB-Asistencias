-- ============================================================
-- Migración 003: asistencia independiente de acompañantes
-- El acompañante puede asistir EN REPRESENTACIÓN del presidente.
-- Ahora cada municipio tiene dos asistencias independientes:
--   presidente_asistio  y  acompanante_asistio.
--   asistio (columna existente) = "presente" = al menos uno de los dos.
--
-- Es ADITIVA y NO destructiva: agrega columnas y rellena desde los
-- datos actuales sin pérdida. Idempotente (usa IF NOT EXISTS).
-- Correr en: Supabase → SQL Editor  o  scripts/run_migration.js
-- ============================================================

-- 1. Nuevas columnas ------------------------------------------
alter table public.presidentes_municipales
  add column if not exists presidente_asistio  boolean not null default false,
  add column if not exists acompanante_asistio boolean not null default false,
  add column if not exists acompanante_nombre  text;

-- 2. Backfill desde el estado actual --------------------------
-- Regla histórica: toda asistencia previa fue del presidente en persona,
-- y `acompanante` solo cuenta como asistido cuando el municipio estaba presente.
update public.presidentes_municipales
   set presidente_asistio  = asistio,
       acompanante_asistio = (asistio and acompanante)
 where presidente_asistio is distinct from asistio
    or acompanante_asistio is distinct from (asistio and acompanante);

-- 3. Coherencia de `asistio` (umbrella = presidente OR acompañante) -----
-- Tras el backfill ya son consistentes; este update es defensivo/idempotente.
update public.presidentes_municipales
   set asistio = (presidente_asistio or acompanante_asistio)
 where asistio is distinct from (presidente_asistio or acompanante_asistio);

-- 4. Índices para reportes por tipo de asistencia -------------
create index if not exists idx_pm_presidente_asistio  on public.presidentes_municipales (presidente_asistio);
create index if not exists idx_pm_acompanante_asistio on public.presidentes_municipales (acompanante_asistio);
