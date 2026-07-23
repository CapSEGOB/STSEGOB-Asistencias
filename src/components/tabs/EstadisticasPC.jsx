import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { IconDownload, IconRefresh, IconUsers } from '../Icons'

const horaRegistro = f => f
  ? new Date(f).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : ''

const porMunicipio = (a, b) => (a.municipio || '').localeCompare(b.municipio || '', 'es')
const modLabel = m => m === 'zoom' ? 'Zoom' : 'Presencial'

// Trae todas las filas con detalle, paginando el límite de PostgREST.
async function fetchDetalle() {
  const PAGE = 1000
  let all = [], page = 0, done = false
  while (!done) {
    const { data, error } = await supabase
      .from('pc_asistentes')
      .select('numero, modalidad, microrregion, municipio, nombre, telefono, responsable, confirmacion, asistio, auto_registrado, fecha_asistencia, observaciones')
      .order('modalidad')
      .order('municipio')
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (error || !data) break
    all = all.concat(data)
    done = data.length < PAGE
    page++
  }
  return all
}

export default function EstadisticasPC({ usuario }) {
  const [stats, setStats]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [resetting, setResetting] = useState(false)
  const [confirm, setConfirm]     = useState(false)
  const [exporting, setExporting] = useState(null) // 'pdf' | 'excel' | null
  const isAdmin = usuario?.rol === 'super_admin'

  useEffect(() => { fetchStats() }, [])

  async function resetAsistencia() {
    setResetting(true)
    setConfirm(false)
    const { error } = await supabase
      .from('pc_asistentes')
      .update({ asistio: false, auto_registrado: false, fecha_asistencia: null, registrado_por: null })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    setResetting(false)
    if (!error) fetchStats()
    else alert('Error al reiniciar: ' + error.message)
  }

  async function fetchStats() {
    setLoading(true)

    async function fetchAll(query) {
      const PAGE = 1000
      let all = [], page = 0, done = false
      while (!done) {
        const { data, error } = await query.range(page * PAGE, (page + 1) * PAGE - 1)
        if (error || !data) break
        all = all.concat(data)
        done = data.length < PAGE
        page++
      }
      return all
    }

    const todos = await fetchAll(
      supabase.from('pc_asistentes').select('modalidad, microrregion, asistio, auto_registrado, confirmacion')
    )

    if (!todos.length) { setStats(null); setLoading(false); return }

    const total          = todos.length
    const totalPresentes = todos.filter(c => c.asistio).length
    const totalAusentes  = total - totalPresentes

    // Por modalidad
    const mod = m => {
      const grupo = todos.filter(c => c.modalidad === m)
      return { total: grupo.length, presentes: grupo.filter(c => c.asistio).length }
    }
    const presencial = mod('presencial')
    const zoom       = mod('zoom')
    const autoRegistrados = todos.filter(c => c.auto_registrado).length

    // Por microrregión
    const microMap = {}
    todos.forEach(c => {
      const key = c.microrregion || 'Sin microrregión'
      if (!microMap[key]) microMap[key] = { key, Invitados: 0, Presentes: 0 }
      microMap[key].Invitados++
      if (c.asistio) microMap[key].Presentes++
    })
    const porMicro = Object.values(microMap).sort((a, b) => b.Invitados - a.Invitados)

    // RSVP
    const rsvpConfirmado = todos.filter(c => /CONFIRMA/i.test(c.confirmacion || '')).length
    const rsvpNo         = todos.filter(c => /NO PODRA|NO ASIST/i.test(c.confirmacion || '')).length
    const rsvpSin        = total - rsvpConfirmado - rsvpNo

    setStats({ total, totalPresentes, totalAusentes, presencial, zoom, autoRegistrados, porMicro, rsvpConfirmado, rsvpNo, rsvpSin })
    setLoading(false)
  }

  // Reporte PDF: resumen + por modalidad + microrregión + listas.
  async function exportPDF() {
    if (!stats) return
    setExporting('pdf')
    try {
      const rows = await fetchDetalle()
      const doc = new jsPDF()
      const now = new Date().toLocaleString('es-MX')
      const pct = stats.total > 0 ? ((stats.totalPresentes / stats.total) * 100).toFixed(1) : '0.0'

      doc.setFontSize(18); doc.setTextColor(14, 50, 46)
      doc.text('STSEGOB — Consejo Estatal de Protección Civil', 14, 22)
      doc.setFontSize(10); doc.setTextColor(100)
      doc.text(`Generado: ${now}`, 14, 30)
      doc.setFontSize(13); doc.setTextColor(0)
      doc.text('Resumen General', 14, 44)
      autoTable(doc, {
        startY: 48,
        head: [['Total', 'Presentes', 'Ausentes', '% Asistencia']],
        body: [[stats.total, stats.totalPresentes, stats.totalAusentes, `${pct}%`]],
        headStyles: { fillColor: [14, 50, 46] },
      })
      doc.text('Por modalidad', 14, doc.lastAutoTable.finalY + 14)
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 18,
        head: [['Modalidad', 'En lista', 'Presentes', 'Ausentes', '%']],
        body: [
          ['Presencial', stats.presencial.total, stats.presencial.presentes,
            stats.presencial.total - stats.presencial.presentes,
            stats.presencial.total ? `${((stats.presencial.presentes / stats.presencial.total) * 100).toFixed(1)}%` : '0.0%'],
          ['Vía Zoom', stats.zoom.total, stats.zoom.presentes,
            stats.zoom.total - stats.zoom.presentes,
            stats.zoom.total ? `${((stats.zoom.presentes / stats.zoom.total) * 100).toFixed(1)}%` : '0.0%'],
        ],
        headStyles: { fillColor: [14, 50, 46] },
      })
      doc.text('Asistencia por Microrregión', 14, doc.lastAutoTable.finalY + 14)
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 18,
        head: [['Microrregión', 'En lista', 'Presentes', 'Ausentes', '%']],
        body: stats.porMicro.map(d => [
          d.key, d.Invitados, d.Presentes, d.Invitados - d.Presentes,
          d.Invitados > 0 ? `${((d.Presentes / d.Invitados) * 100).toFixed(1)}%` : '0.0%',
        ]),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [14, 50, 46], fontSize: 8 },
      })

      const ordenar = (a, b) => a.modalidad.localeCompare(b.modalidad) || porMunicipio(a, b)
      const presentes = rows.filter(r => r.asistio).sort(ordenar)
      const ausentes  = rows.filter(r => !r.asistio).sort(ordenar)

      doc.addPage()
      doc.setFontSize(14); doc.setTextColor(21, 128, 61)
      doc.text(`Asistieron (${presentes.length})`, 14, 20)
      autoTable(doc, {
        startY: 24,
        head: [['Nombre', 'Municipio', 'Microrregión', 'Modalidad', 'Hora']],
        body: presentes.map(r => [
          r.nombre, r.municipio || '', r.microrregion || '',
          modLabel(r.modalidad) + (r.auto_registrado ? ' (auto)' : ''),
          horaRegistro(r.fecha_asistencia),
        ]),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [21, 128, 61], fontSize: 8 },
      })

      doc.addPage()
      doc.setFontSize(14); doc.setTextColor(185, 28, 28)
      doc.text(`No asistieron (${ausentes.length})`, 14, 20)
      autoTable(doc, {
        startY: 24,
        head: [['Nombre', 'Municipio', 'Microrregión', 'Modalidad', 'Teléfono', 'RSVP previo']],
        body: ausentes.map(r => [
          r.nombre, r.municipio || '', r.microrregion || '', modLabel(r.modalidad),
          r.telefono || '', r.confirmacion || '',
        ]),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [185, 28, 28], fontSize: 8 },
      })

      doc.save(`proteccion-civil-${now.replace(/[/:, ]/g, '-')}.pdf`)
    } finally {
      setExporting(null)
    }
  }

  // Reporte Excel: hoja general + una por modalidad.
  async function exportExcel() {
    setExporting('excel')
    try {
      const rows = await fetchDetalle()
      const wb = XLSX.utils.book_new()

      const mapRow = r => ({
        '#': r.numero,
        Nombre: r.nombre,
        Municipio: r.municipio || '',
        Microrregión: r.microrregion || '',
        Modalidad: modLabel(r.modalidad),
        Estado: r.asistio ? 'Presente' : 'Ausente',
        'Auto-registro': r.auto_registrado ? 'Sí' : '',
        'Hora registro': r.asistio ? horaRegistro(r.fecha_asistencia) : '',
        Teléfono: r.telefono || '',
        Responsable: r.responsable || '',
        'RSVP previo': r.confirmacion || '',
        Observaciones: r.observaciones || '',
      })
      const cols = [{ wch: 6 }, { wch: 32 }, { wch: 22 }, { wch: 16 }, { wch: 11 }, { wch: 9 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 26 }]

      const todos = [...rows].sort((a, b) => a.modalidad.localeCompare(b.modalidad) || porMunicipio(a, b))
      const wsAll = XLSX.utils.json_to_sheet(todos.map(mapRow))
      wsAll['!cols'] = cols
      XLSX.utils.book_append_sheet(wb, wsAll, 'Todos')

      for (const m of ['presencial', 'zoom']) {
        const grupo = rows.filter(r => r.modalidad === m)
        if (!grupo.length) continue
        grupo.sort((a, b) => (a.asistio === b.asistio ? porMunicipio(a, b) : a.asistio ? -1 : 1))
        const ws = XLSX.utils.json_to_sheet(grupo.map(mapRow))
        ws['!cols'] = cols
        XLSX.utils.book_append_sheet(wb, ws, m === 'zoom' ? 'Vía Zoom' : 'Presenciales')
      }

      const now = new Date().toLocaleString('es-MX').replace(/[/:, ]/g, '-')
      XLSX.writeFile(wb, `proteccion-civil-${now}.xlsx`)
    } finally {
      setExporting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent" style={{ borderColor: '#409b84', borderTopColor: 'transparent' }} />
        <span className="text-sm text-gray-400">Cargando estadísticas...</span>
      </div>
    )
  }

  if (!stats) return <p className="text-center text-gray-500 py-20">Sin datos disponibles.</p>

  const pct = stats.total > 0 ? ((stats.totalPresentes / stats.total) * 100).toFixed(1) : '0.0'
  const pctMod = m => m.total > 0 ? ((m.presentes / m.total) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-5">
      {/* Modal de confirmación reset */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Reiniciar asistencia</h3>
                <p className="text-xs text-gray-500 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Se marcará a <strong>todos como ausentes</strong> (solo este evento, ambas listas). ¿Continuar?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)} className="flex-1 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-xl text-sm transition-colors">Cancelar</button>
              <button onClick={resetAsistencia} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-xl text-sm transition-colors">Sí, reiniciar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header acciones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-bold text-gray-800">Estadísticas del Consejo</h2>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={() => setConfirm(true)} disabled={resetting}
              className="flex items-center gap-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium px-3 py-2 rounded-xl transition-colors text-xs shadow-sm disabled:opacity-50">
              {resetting
                ? <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                : <IconRefresh className="w-3.5 h-3.5" />}
              Reiniciar asistencia
            </button>
          )}
          <button onClick={fetchStats} className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-medium px-3 py-2 rounded-xl transition-colors text-xs shadow-sm">
            <IconRefresh className="w-3.5 h-3.5" /> Actualizar
          </button>
          <button onClick={exportExcel} disabled={!!exporting}
            className="flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-4 py-2 rounded-xl transition-colors text-xs shadow-sm disabled:opacity-50">
            {exporting === 'excel'
              ? <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              : <IconDownload className="w-3.5 h-3.5" />}
            Descargar Excel
          </button>
          <button onClick={exportPDF} disabled={!!exporting}
            className="flex items-center gap-1.5 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-xs shadow-sm disabled:opacity-50" style={{ backgroundColor: '#0e322e' }}>
            {exporting === 'pdf'
              ? <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <IconDownload className="w-3.5 h-3.5" />}
            Descargar PDF
          </button>
        </div>
      </div>

      {/* KPIs + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center">
          <div className="relative">
            <svg viewBox="0 0 120 120" className="w-36 h-36 -rotate-90">
              <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="16" />
              <circle cx="60" cy="60" r="48" fill="none" stroke="#409b84" strokeWidth="16"
                strokeDasharray={`${(parseFloat(pct) / 100) * 301.59} 301.59`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black" style={{ color: '#0e322e' }}>{pct}%</span>
              <span className="text-xs text-gray-400 font-medium">asistencia</span>
            </div>
          </div>
          <div className="mt-4 w-full space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#409b84' }}/><span className="text-gray-600">Presentes</span></div>
              <span className="font-bold" style={{ color: '#0e322e' }}>{stats.totalPresentes.toLocaleString('es-MX')}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block"/><span className="text-gray-600">Ausentes</span></div>
              <span className="font-bold text-slate-500">{stats.totalAusentes.toLocaleString('es-MX')}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2"><IconUsers className="w-3.5 h-3.5 text-gray-400"/><span className="text-gray-600">Total</span></div>
              <span className="font-bold text-gray-700">{stats.total.toLocaleString('es-MX')}</span>
            </div>
          </div>
        </div>

        {/* KPI stack: por modalidad */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3 lg:gap-4">
          <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(to bottom right, #0e322e, #26645b)' }}>
            <div className="text-xs font-medium text-white/70 uppercase tracking-widest mb-1">Presencial</div>
            <div className="text-4xl font-black">{pctMod(stats.presencial)}<span className="text-xl font-bold text-white/60">%</span></div>
            <div className="text-sm text-white/70 mt-1">
              {stats.presencial.presentes.toLocaleString('es-MX')} de {stats.presencial.total.toLocaleString('es-MX')} en sala
            </div>
          </div>
          <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(to bottom right, #1e3a8a, #2563eb)' }}>
            <div className="text-xs font-medium text-white/70 uppercase tracking-widest mb-1">Vía Zoom</div>
            <div className="text-4xl font-black">{pctMod(stats.zoom)}<span className="text-xl font-bold text-white/60">%</span></div>
            <div className="text-sm text-white/70 mt-1">
              {stats.zoom.presentes.toLocaleString('es-MX')} de {stats.zoom.total.toLocaleString('es-MX')} conectados
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <IconUsers className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-black text-blue-700">{stats.autoRegistrados}</div>
              <div className="text-xs text-gray-500 font-medium">Auto-registros por Zoom</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">RSVP previo</div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-green-600 font-medium">Confirmó</span><span className="font-bold text-green-700">{stats.rsvpConfirmado}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-red-500 font-medium">No podrá asistir</span><span className="font-bold text-red-600">{stats.rsvpNo}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 font-medium">Sin confirmar</span><span className="font-bold text-gray-500">{stats.rsvpSin}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Por microrregión */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Asistencia por Microrregión</h3>
          <span className="text-xs text-gray-400">{stats.porMicro.length} microrregiones</span>
        </div>
        <div className="p-4 sm:p-6 overflow-x-auto">
          <div style={{ minWidth: 280 }}>
            <ResponsiveContainer width="100%" height={Math.max(240, stats.porMicro.length * 40)}>
              <BarChart data={stats.porMicro} layout="vertical" margin={{ top: 0, right: 50, left: 20, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f8fafc" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="key" width={120} tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(64,155,132,0.07)' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 12, padding: '10px 14px' }}
                  labelStyle={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }} />
                <Bar dataKey="Invitados" name="En lista" fill="#409b8430" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Presentes" name="Presentes" fill="#409b84" radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fontSize: 11, fill: '#26645b', fontWeight: 700 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
