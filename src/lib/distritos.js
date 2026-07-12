// Distritos federales del evento "Desayuno Consejeros MORENA".
// Agrupador regional (equivalente al "partido" en el módulo de presidentes).
// Se normaliza el valor crudo (mayúsculas, sin acentos, sin dobles espacios)
// para emparejar con robustez, conservando la etiqueta legible con acentos.

// Normaliza una clave de distrito para el mapa (sin acentos, mayúsculas).
export function normDistrito(str) {
  return (str || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim()
}

// Etiqueta legible + color de marca por distrito. Colores distinguibles
// entre sí; sirven para barras y badges en la tabla y las estadísticas.
const DISTRITOS = {
  'HUAUCHINANGO':          { label: 'Huauchinango',        color: '#0e7490' },
  'ZACATLAN':              { label: 'Zacatlán',            color: '#0d9488' },
  'TEZIUTLAN':             { label: 'Teziutlán',           color: '#15803d' },
  'AJALPAN':               { label: 'Ajalpan',             color: '#65a30d' },
  'SAN MARTIN TEXMELUCAN': { label: 'San Martín Texmelucan', color: '#ca8a04' },
  'PUEBLA':                { label: 'Puebla',              color: '#a6262e' },
  'TEPEACA':               { label: 'Tepeaca',             color: '#c2410c' },
  'CIUDAD SERDAN':         { label: 'Ciudad Serdán',       color: '#b45309' },
  'CHOLULA':               { label: 'Cholula',             color: '#7c3aed' },
  'ATLIXCO':               { label: 'Atlixco',             color: '#be185d' },
  'ACATLAN DE OSORIO':     { label: 'Acatlán de Osorio',   color: '#4f46e5' },
  'TEHUACAN':              { label: 'Tehuacán',            color: '#0369a1' },
}

const DEFAULT = { label: 'Sin distrito', color: '#94a3b8' }

export function distritoInfo(distrito) {
  if (!distrito) return DEFAULT
  const key = normDistrito(distrito)
  return DISTRITOS[key] || { ...DEFAULT, label: distrito }
}

// Orden de aparición en el Excel — para poblar el filtro por distrito.
export const DISTRITOS_ORDEN = [
  'HUAUCHINANGO', 'ZACATLÁN', 'TEZIUTLÁN', 'AJALPAN', 'SAN MARTÍN TEXMELUCAN',
  'PUEBLA', 'TEPEACA', 'CIUDAD SERDÁN', 'CHOLULA', 'ATLIXCO',
  'ACATLÁN DE OSORIO', 'TEHUACÁN',
]
