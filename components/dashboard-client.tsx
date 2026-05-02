'use client'

import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarClock,
  MapPin,
  Sprout,
  Trophy,
  TrendingUp,
} from 'lucide-react'
import type {
  PlantioEnriquecido,
  ResumoProducao,
} from '@/lib/database.types'

export const CULTURE_COLORS: Record<string, string> = {
  Soja: '#16a34a',
  Milho: '#ca8a04',
  Sorgo: '#ea580c',
  Cevada: '#d97706',
  Batata: '#7c3aed',
  Trigo: '#b45309',
  Feijão: '#78350f',
}

const MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

type Props = {
  resumo: ResumoProducao[]
  talhoesAtivos: number
  plantiosBrutos: PlantioEnriquecido[]
}

type Tab = 'resumo' | 'heatmap'

export function DashboardClient({
  resumo,
  talhoesAtivos,
  plantiosBrutos,
}: Props) {
  const [filterAno, setFilterAno] = useState<string>('all')
  const [tab, setTab] = useState<Tab>('resumo')

  const years = useMemo(
    () => Array.from(new Set(resumo.map((r) => r.ano))).sort((a, b) => a - b),
    [resumo]
  )

  const filtered = useMemo(
    () =>
      filterAno === 'all'
        ? resumo
        : resumo.filter((r) => r.ano === Number(filterAno)),
    [resumo, filterAno]
  )

  const totals = useMemo(() => {
    const totalArea = filtered.reduce((s, r) => s + r.total_area, 0)
    const totalVolume = filtered.reduce(
      (s, r) => s + (r.total_volume ?? 0),
      0
    )
    return {
      totalArea: totalArea.toFixed(1),
      totalVolume: totalVolume.toFixed(1),
    }
  }, [filtered])

  const allCulturesInData = useMemo(
    () => Array.from(new Set(resumo.map((r) => r.cultura))).sort(),
    [resumo]
  )

  const barData: Array<Record<string, number>> = useMemo(() => {
    const grouped: Record<number, Record<string, number>> = {}
    filtered.forEach((r) => {
      if (!grouped[r.ano]) grouped[r.ano] = {}
      grouped[r.ano][r.cultura] =
        (grouped[r.ano][r.cultura] ?? 0) + (r.total_volume ?? 0)
    })
    return Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([ano, cultures]) => ({ ano: Number(ano), ...cultures }))
  }, [filtered])

  const donutData = useMemo(() => {
    const recentYear =
      filtered.length > 0 ? Math.max(...filtered.map((r) => r.ano)) : null
    const src =
      recentYear != null
        ? filtered.filter((r) => r.ano === recentYear)
        : filtered
    return src.map((r) => ({
      name: r.cultura,
      value: Number(r.total_area.toFixed(2)),
    }))
  }, [filtered])

  const culturesInBar = allCulturesInData.filter((c) =>
    barData.some((d) => c in d)
  )

  const donutYear =
    filtered.length > 0 ? Math.max(...filtered.map((r) => r.ano)) : null

  // KPIs from plantiosBrutos
  const produtividadeKpi = useMemo(() => {
    const valid = plantiosBrutos.filter(
      (p) => p.produtividade_sc_ha != null
    )
    if (valid.length === 0) {
      return { avg: 0, deltaPct: null as number | null }
    }
    const avg =
      valid.reduce((s, p) => s + (p.produtividade_sc_ha ?? 0), 0) /
      valid.length

    const anos = Array.from(new Set(valid.map((p) => p.ano)))
    if (anos.length < 2) {
      return { avg, deltaPct: null }
    }
    const maxAno = Math.max(...anos)
    const prevAno = Math.max(...anos.filter((a) => a < maxAno))
    const prev = valid.filter((p) => p.ano === prevAno)
    if (prev.length === 0) return { avg, deltaPct: null }
    const prevAvg =
      prev.reduce((s, p) => s + (p.produtividade_sc_ha ?? 0), 0) / prev.length
    if (prevAvg === 0) return { avg, deltaPct: null }
    const deltaPct = ((avg - prevAvg) / prevAvg) * 100
    return { avg, deltaPct }
  }, [plantiosBrutos])

  const melhorTalhao = useMemo<{ nome: string; avg: number } | null>(() => {
    const groups = new Map<string, { sum: number; count: number }>()
    plantiosBrutos.forEach((p) => {
      if (p.produtividade_sc_ha == null) return
      const key = p.talhao
      const cur = groups.get(key) ?? { sum: 0, count: 0 }
      cur.sum += p.produtividade_sc_ha
      cur.count += 1
      groups.set(key, cur)
    })
    let bestNome: string | null = null
    let bestAvg = -Infinity
    groups.forEach((v, nome) => {
      const avg = v.sum / v.count
      if (avg > bestAvg) {
        bestAvg = avg
        bestNome = nome
      }
    })
    return bestNome != null ? { nome: bestNome, avg: bestAvg } : null
  }, [plantiosBrutos])

  const colheitasPendentes = useMemo(() => {
    const total = plantiosBrutos.length
    const pendentes = plantiosBrutos.filter(
      (p) => p.data_colheita == null
    ).length
    const pct = total > 0 ? (pendentes / total) * 100 : 0
    return { pendentes, total, pct }
  }, [plantiosBrutos])

  const sazonalidadeData = useMemo(() => {
    const counts = new Array(12).fill(0) as number[]
    plantiosBrutos.forEach((p) => {
      if (!p.data_plantio) return
      const d = new Date(p.data_plantio)
      const m = d.getMonth()
      if (!Number.isNaN(m)) counts[m] += 1
    })
    return MESES_CURTOS.map((mes, i) => ({ mes, count: counts[i] }))
  }, [plantiosBrutos])

  const heatmap = useMemo(() => {
    const talhoesSet = new Set<string>()
    const anosSet = new Set<number>()
    const groups = new Map<string, { sum: number; count: number }>()

    plantiosBrutos.forEach((p) => {
      if (p.produtividade_sc_ha == null) return
      talhoesSet.add(p.talhao)
      anosSet.add(p.ano)
      const key = `${p.talhao}__${p.ano}`
      const cur = groups.get(key) ?? { sum: 0, count: 0 }
      cur.sum += p.produtividade_sc_ha
      cur.count += 1
      groups.set(key, cur)
    })

    const talhoes = Array.from(talhoesSet).sort()
    const anos = Array.from(anosSet).sort((a, b) => a - b)

    const cells: Record<string, number> = {}
    let min = Infinity
    let max = -Infinity
    groups.forEach((v, key) => {
      const avg = v.sum / v.count
      cells[key] = avg
      if (avg < min) min = avg
      if (avg > max) max = avg
    })
    if (!Number.isFinite(min)) min = 0
    if (!Number.isFinite(max)) max = 0

    return { talhoes, anos, cells, min, max }
  }, [plantiosBrutos])

  function heatmapBg(value: number): string {
    const { min, max } = heatmap
    const intensity = max === min ? 1 : (value - min) / (max - min)
    const r = Math.round(255 - intensity * (255 - 22))
    const g = Math.round(255 - intensity * (255 - 163))
    const b = Math.round(255 - intensity * (255 - 74))
    return `rgb(${r}, ${g}, ${b})`
  }

  const selectClass =
    'px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500'

  const tableRows = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => b.ano - a.ano || a.cultura.localeCompare(b.cultura)
      ),
    [filtered]
  )

  const deltaPct = produtividadeKpi.deltaPct
  const deltaPositive = deltaPct != null && deltaPct >= 0

  return (
    <>
      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={filterAno}
          onChange={(e) => setFilterAno(e.target.value)}
          className={selectClass}
        >
          <option value="all">Todos os anos</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {/* Card 1 — Produtividade Média (lg:col-span-2) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">
              Produtividade Média
            </span>
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-2xl font-bold text-gray-900">
              {produtividadeKpi.avg.toFixed(1)}
              <span className="text-sm font-medium text-gray-500 ml-1">
                sc/ha
              </span>
            </p>
            {deltaPct != null && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                  deltaPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {deltaPositive ? (
                  <ArrowUp className="w-3 h-3" />
                ) : (
                  <ArrowDown className="w-3 h-3" />
                )}
                {Math.abs(deltaPct).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">vs. ano anterior</p>
        </div>

        {/* Card 2 — Melhor Talhão (lg:col-span-2) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">
              Melhor Talhão
            </span>
            <div className="w-9 h-9 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 truncate">
            {melhorTalhao ? melhorTalhao.nome : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {melhorTalhao
              ? `${melhorTalhao.avg.toFixed(1)} sc/ha (média)`
              : 'sem dados'}
          </p>
        </div>

        {/* Card 3 — Colheitas Pendentes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">
              Colheitas Pendentes
            </span>
            <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {colheitasPendentes.pendentes}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {colheitasPendentes.pct.toFixed(1)}% do total
          </p>
        </div>

        {/* Card 4 — Talhões Ativos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">
              Talhões Ativos
            </span>
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{talhoesAtivos}</p>
        </div>

        {/* Card 5 — Área Total */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">
              Área Total (ha)
            </span>
            <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totals.totalArea}</p>
        </div>

        {/* Card 6 — Volume Total */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">
              Volume Total (sc)
            </span>
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <Sprout className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {totals.totalVolume}
          </p>
        </div>
      </div>

      {/* Sazonalidade */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
        <h2 className="font-semibold text-gray-900 mb-4">
          Distribuição de Plantios por Mês
        </h2>
        {plantiosBrutos.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
            Sem dados para exibir
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={sazonalidadeData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(22, 163, 74, 0.05)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const row = payload[0].payload as {
                    mes: string
                    count: number
                  }
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-sm text-gray-900">
                      {row.count} plantios em {row.mes}
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" fill="#16a34a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Evolução da Produção por Cultura
          </h2>
          {barData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              Sem dados para exibir
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={barData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [
                    `${Number(value).toFixed(1)} sc`,
                    undefined,
                  ]}
                />
                <Legend />
                {culturesInBar.map((cultura) => (
                  <Bar
                    key={cultura}
                    dataKey={cultura}
                    fill={CULTURE_COLORS[cultura] ?? '#888888'}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">
            Distribuição de Área
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            {donutYear != null ? `Ano ${donutYear}` : 'Safra mais recente'}
          </p>
          {donutData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              Sem dados para exibir
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {donutData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={CULTURE_COLORS[entry.name] ?? '#888888'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    `${Number(value).toFixed(2)} ha`,
                    undefined,
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabs: Resumo / Heatmap */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('resumo')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'resumo'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Resumo
          </button>
          <button
            type="button"
            onClick={() => setTab('heatmap')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'heatmap'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Heatmap Talhões
          </button>
        </div>

        {tab === 'resumo' &&
          (tableRows.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Sprout className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum dado encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {[
                      'Ano',
                      'Cultura',
                      'Área Total (ha)',
                      'Volume Total (sc)',
                      'Prod. Média (sc/ha)',
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                          i >= 2 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr
                      key={`${r.ano}-${r.cultura}`}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="px-5 py-3 text-gray-900">{r.ano}</td>
                      <td className="px-5 py-3 text-gray-600">{r.cultura}</td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {r.total_area.toFixed(1)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {r.total_volume != null
                          ? r.total_volume.toFixed(1)
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {r.avg_produtividade != null
                          ? `${r.avg_produtividade.toFixed(1)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === 'heatmap' &&
          (heatmap.talhoes.length === 0 || heatmap.anos.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Sprout className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum dado encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-white">
                      Talhão
                    </th>
                    {heatmap.anos.map((ano) => (
                      <th
                        key={ano}
                        className="px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center"
                      >
                        {ano}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.talhoes.map((talhao) => (
                    <tr key={talhao} className="border-b border-gray-50">
                      <td className="px-5 py-2 text-gray-900 font-medium sticky left-0 bg-white">
                        {talhao}
                      </td>
                      {heatmap.anos.map((ano) => {
                        const key = `${talhao}__${ano}`
                        const v = heatmap.cells[key]
                        if (v == null) {
                          return (
                            <td
                              key={ano}
                              className="px-3 py-2 text-center text-gray-400"
                              style={{ background: '#f3f4f6' }}
                            >
                              —
                            </td>
                          )
                        }
                        const intensity =
                          heatmap.max === heatmap.min
                            ? 1
                            : (v - heatmap.min) /
                              (heatmap.max - heatmap.min)
                        const dark = intensity > 0.55
                        return (
                          <td
                            key={ano}
                            className={`px-3 py-2 text-center font-medium ${
                              dark ? 'text-white' : 'text-gray-900'
                            }`}
                            style={{ background: heatmapBg(v) }}
                            title={`Talhão ${talhao}, Ano ${ano}: ${v.toFixed(
                              1
                            )} sc/ha`}
                          >
                            {v.toFixed(1)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </>
  )
}
