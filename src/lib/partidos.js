// Mapa de filiación partidista → etiqueta, color de marca y logo.
// El valor crudo (columna `partido`, campo `fil` del padrón) se normaliza aquí.
// Logos en /public/partidos/*.jpg (servidos estáticamente).

const PARTIDOS = {
  MORENA:        { label: 'MORENA',        color: '#a6262e', logo: 'morena' },
  PRI:           { label: 'PRI',           color: '#0d7c3f', logo: 'pri' },
  PVEM:          { label: 'PVEM',          color: '#3aa935', logo: 'pvem' },
  PT:            { label: 'PT',            color: '#d52b1e', logo: 'pt' },
  PAN:           { label: 'PAN',           color: '#0a4a9c', logo: 'pan' },
  PRD:           { label: 'PRD',           color: '#f5c518', logo: 'prd' },
  PSI:           { label: 'PSI',           color: '#6a1b9a', logo: 'psi' },
  MC:            { label: 'MC',            color: '#f58220', logo: 'mc' },
  FXMP:          { label: 'FXM Puebla',    color: '#e5007e', logo: 'fxm' },
  NAP:           { label: 'Nueva Alianza', color: '#00adef', logo: 'alianza' },
  CONCEJO:       { label: 'Concejo Mpal.', color: '#64748b', logo: null },
  INDEPENDIENTE: { label: 'Independiente', color: '#475569', logo: null },
}

const DEFAULT = { label: '—', color: '#94a3b8', logo: null }

export function partidoInfo(partido) {
  if (!partido) return DEFAULT
  return PARTIDOS[partido.trim().toUpperCase()] || { ...DEFAULT, label: partido }
}

export function partidoLogoSrc(partido) {
  const info = partidoInfo(partido)
  return info.logo ? `/partidos/${info.logo}.jpg` : null
}

// Lista para poblar el filtro por partido (orden por presencia aproximada).
export const PARTIDOS_ORDEN = ['MORENA', 'PRI', 'PVEM', 'PT', 'PAN', 'NAP', 'FXMP', 'PRD', 'PSI', 'MC', 'CONCEJO', 'INDEPENDIENTE']
