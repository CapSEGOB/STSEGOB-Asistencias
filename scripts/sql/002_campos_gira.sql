-- Campos adicionales que aporta el Excel de la gira.
alter table public.presidentes_municipales
  add column if not exists responsable  text,   -- staff que da seguimiento
  add column if not exists confirmacion text;    -- RSVP previo: ASISTE / NO ASISTE / null
