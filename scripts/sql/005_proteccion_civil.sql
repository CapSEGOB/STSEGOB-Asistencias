-- ============================================================
-- Migración 005: Evento "Consejo Estatal de Protección Civil"
-- Dos listas en una tabla (campo modalidad):
--   'presencial' → registro por staff (igual que otros eventos)
--   'zoom'       → auto-registro público vía RPC (sin login)
--
-- Seguridad del auto-registro:
--   * La tabla NO tiene políticas para anon: el rol anónimo solo
--     puede llamar las funciones pc_buscar_zoom / pc_registrar_zoom
--     (security definer), que exponen datos mínimos y validan los
--     últimos 4 dígitos del teléfono.
--
-- Correr en: Supabase → SQL Editor  o  scripts/run_migration.js
-- Idempotente. No toca ninguna otra tabla.
-- ============================================================

-- 1. Tabla ----------------------------------------------------
create table if not exists public.pc_asistentes (
  id                uuid primary key default gen_random_uuid(),
  numero            smallint,                   -- consecutivo del Excel (por hoja)
  modalidad         text not null check (modalidad in ('presencial', 'zoom')),
  microrregion      text,                       -- microrregión / región
  municipio         text,
  nombre            text not null,
  telefono          text,
  responsable       text,                       -- responsable de seguimiento
  confirmacion      text,                       -- RSVP previo del Excel
  observaciones     text,
  asistio           boolean not null default false,
  auto_registrado   boolean not null default false, -- true si se registró él mismo vía Zoom
  fecha_asistencia  timestamptz,
  registrado_por    uuid references public.usuarios(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_pc_modalidad on public.pc_asistentes (modalidad);
create index if not exists idx_pc_micro     on public.pc_asistentes (microrregion);
create index if not exists idx_pc_asistio   on public.pc_asistentes (asistio);

-- 2. Trigger updated_at (reutiliza la función creada en 001) --
drop trigger if exists trg_pc_updated_at on public.pc_asistentes;
create trigger trg_pc_updated_at
  before update on public.pc_asistentes
  for each row execute function public.set_updated_at();

-- 3. RLS: autenticados leen/actualizan; anon NADA directo -----
alter table public.pc_asistentes enable row level security;

drop policy if exists "pc_select_auth" on public.pc_asistentes;
create policy "pc_select_auth"
  on public.pc_asistentes
  for select
  to authenticated
  using (true);

drop policy if exists "pc_update_auth" on public.pc_asistentes;
create policy "pc_update_auth"
  on public.pc_asistentes
  for update
  to authenticated
  using (true)
  with check (true);

-- 4. RPC pública: buscar registro Zoom por municipio o nombre --
-- Devuelve solo lo mínimo para identificarse. No expone teléfono
-- (solo una pista con los últimos 2 dígitos) ni observaciones.
create or replace function public.pc_buscar_zoom(p_busqueda text)
returns table (
  id        uuid,
  nombre    text,
  municipio text,
  asistio   boolean,
  tiene_tel boolean,
  tel_hint  text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    a.nombre,
    a.municipio,
    a.asistio,
    coalesce(nullif(regexp_replace(coalesce(a.telefono,''), '\D', '', 'g'), ''), null) is not null,
    case when nullif(regexp_replace(coalesce(a.telefono,''), '\D', '', 'g'), '') is not null
         then '•••• ' || right(regexp_replace(a.telefono, '\D', '', 'g'), 2)
         else null end
  from public.pc_asistentes a
  where a.modalidad = 'zoom'
    and (
      a.municipio ilike '%' || p_busqueda || '%'
      or a.nombre  ilike '%' || p_busqueda || '%'
    )
  order by a.municipio
  limit 12;
$$;

-- 5. RPC pública: registrar asistencia Zoom -------------------
-- Valida últimos 4 dígitos contra cualquiera de los teléfonos
-- registrados (pueden venir como "222.../ 231..."). Si el registro
-- no tiene teléfono, permite registrar sin validación.
create or replace function public.pc_registrar_zoom(p_id uuid, p_ultimos4 text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v pc_asistentes%rowtype;
  seg text;
  ok boolean := false;
begin
  select * into v from pc_asistentes where id = p_id and modalidad = 'zoom';
  if not found then
    return json_build_object('ok', false, 'error', 'registro_no_encontrado');
  end if;

  if v.asistio then
    return json_build_object('ok', true, 'ya_registrado', true, 'nombre', v.nombre);
  end if;

  if nullif(regexp_replace(coalesce(v.telefono,''), '\D', '', 'g'), '') is null then
    ok := true; -- sin teléfono en la lista: no se puede validar
  else
    foreach seg in array string_to_array(v.telefono, '/') loop
      if right(regexp_replace(seg, '\D', '', 'g'), 4) = regexp_replace(coalesce(p_ultimos4,''), '\D', '', 'g') then
        ok := true;
      end if;
    end loop;
  end if;

  if not ok then
    return json_build_object('ok', false, 'error', 'telefono_no_coincide');
  end if;

  update pc_asistentes
     set asistio = true,
         auto_registrado = true,
         fecha_asistencia = now()
   where id = p_id;

  return json_build_object('ok', true, 'ya_registrado', false, 'nombre', v.nombre);
end;
$$;

-- Solo estas funciones quedan expuestas al rol anónimo.
revoke all on function public.pc_buscar_zoom(text) from public;
revoke all on function public.pc_registrar_zoom(uuid, text) from public;
grant execute on function public.pc_buscar_zoom(text) to anon, authenticated;
grant execute on function public.pc_registrar_zoom(uuid, text) to anon, authenticated;
