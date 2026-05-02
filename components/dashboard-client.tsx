'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
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
  ComposedChart,
  Line,
} from 'recharts'
import {
  MapPin,
  Sprout,
  BarChart3,
  TrendingUp,
  Award,
  Activity,
  Clock,
  Layers,
  Upload as UploadIcon,
} from 'lucide-react'

export const CULTURE_COLORS: Record<string, string> = {
  Soja: '#16a34a',
  Milho: '#ca8a04',
  Sorgo: '#ea580c',
  Cevada: '#d97706',
  Batata: '#7c3aed',
  Trigo: '#b45309',
  Feijão: '#78350f',
}

export type PlantioResumo = {
  ano: number
  area_ha: number
  volume_colhido: number | null
  produtividade_sc_ha: number | null
  data_colheita: string | null
  talhao: string
  cultura: string
  safra: string
}

type Props = {
  plantios: PlantioResumo[]
  talhoesAtivos: number
}

export function DashboardClient({ plantios, talhoesAtivos }: Props) {
  const [filterAno, setFilterAno] = useState<string>('all')
  const [filterSafra, setFilterSafra] = useState<string>('all')

  const years = useMemo(
    () => Array.from(new Set(plantios.map((p) => p.ano))).sort((a, b) => a - b),
    [plantios]
  )

  const safrasList = useMemo(
    () =>
      Array.from(new Set(plantios.map((p) => p.safra)))
        .filter((s) => s && s !== '—')
        .sort(),
    [plantios]
  )

  const filtered = useMemo(
    () =>
      plantios.filter((p) => {
        if (filterAno !== 'all' && p.ano !== Number(filterAno)) return false
        if (filterSafra !== 'all' && p.safra !== filterSafra) return false
        return true
      }),
    [plantios, filterAno, filterSafra]
  )

  // Aggregated rows by (ano, cultura) used for the bar/line chart and table.
  const resumoAnoCultura = useMemo(() => {
    const grouped = new Map<
      string,
      { ano: number; cultura: string; total_area: number; total_volume: number; sumProd: number; countProd: number }
    >()
    for (const p of filtered) {
      const key = `${p.ano}__${p.cultura}`
      const cur = grouped.get(key) ?? {
        ano: p.ano,
        cultura: p.cultura,
        total_area: 0,
        total_volume: 0,
        sumProd: 0,
        countProd: 0,
      }
      cur.total_area += p.area_ha
      cur.total_volume += p.volume_colhido ?? 0
      if (p.produtividade_sc_ha != null) {
        cur.sumProd += p.produtividade_sc_ha
        cur.countProd += 1
      }
      grouped.set(key, cur)
    }
    return Array.from(grouped.values()).map((r) => ({
      ano: r.ano,
      cultura: r.cultura,
      total_area: r.total_area,
      total_volume: r.total_volume,
      avg_produtividade: r.countProd > 0 ? r.sumProd / r.countProd : null,
    }))
  }, [filtered])

  const stats = useMemo(() => {
    const totalArea = filtered.reduce((s, p) => s + p.area_ha, 0)
    const totalVolume = filtered.reduce(
      (s, p) => s + (p.volume_colhido ?? 0),
      0
    )
    const prodValues = filtered.flatMap((p) =>
      p.produtividade_sc_ha != null ? [p.produtividade_sc_ha] : []
    )
    const avgProd =
      prodValues.length > 0
        ? prodValues.reduce((a, b) => a + b, 0) / prodValues.length
        : 0
    return {
      totalArea: totalArea.toFixed(1),
      totalVolume: totalVolume.toFixed(1),
      avgProd: avgProd.toFixed(1),
    }
  }, [filtered])

  // KPI: melhor produtividade histórica (talhão + cultura).
  const bestProd = useMemo(() => {
    let best: PlantioResumo | null = null
    for (const p of filtered) {
      if (p.produtividade_sc_ha == null) continue
      if (best == null || p.produtividade_sc_ha > (best.produtividade_sc_ha ?? -Infinity)) {
        best = p
      }
    }
    return best
  }, [filtered])

  // KPI: evolução percentual de produtividade ano a ano (último ano vs anterior).
  const yoyChange = useMemo(() => {
    const byYear = new Map<number, { sum: number; count: number }>()
    for (const p of filtered) {
      if (p.produtividade_sc_ha == null) continue
      const cur = byYear.get(p.ano) ?? { sum: 0, count: 0 }
      cur.sum += p.produtividade_sc_ha
      cur.count += 1
      byYear.set(p.ano, cur)
    }
    const yearsSorted = Array.from(byYear.keys()).sort((a, b) => a - b)
    if (yearsSorted.length < 2) return null
    const last = yearsSorted[yearsSorted.length - 1]
    const prev = yearsSorted[yearsSorted.length - 2]
    const lastAvg = byYear.get(last)!.sum / byYear.get(last)!.count
    const prevAvg = byYear.get(prev)!.sum / byYear.get(prev)!.count
    if (prevAvg === 0) return null
    const pct = ((lastAvg - prevAvg) / prevAvg) * 100
    return { pct, last, prev }
  }, [filtered])

  // KPI: percentual de colheitas pendentes.
  const pendentes = useMemo(() => {
    const total = filtered.length
    if (total === 0) return { pct: 0, count: 0, total: 0 }
    const count = filtered.filter((p) => p.data_colheita == null).length
    return { pct: (count / total) * 100, count, total }
  }, [filtered])

  // KPI: área plantada total por safra.
  const areaPorSafra = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of filtered) {
      map.set(p.safra, (map.get(p.safra) ?? 0) + p.area_ha)
    }
    return Array.from(map.entries())
      .map(([safra, area]) => ({ safra, area }))
      .sort((a, b) => b.area - a.area)
  }, [filtered])

  const allCulturesInData = useMemo(
    () => Array.from(new Set(plantios.map((p) => p.cultura))).sort(),
    [plantios]
  )

  // Bar+Line chart data: per-year volume by cultura + avg produtividade.
  const chartData = useMemo(() => {
    const byYear = new Map<
      number,
      { ano: number; sumProd: number; countProd: number; cultures: Record<string, number> }
    >()
    for (const r of resumoAnoCultura) {
      const cur = byYear.get(r.ano) ?? {
        ano: r.ano,
        sumProd: 0,
        countProd: 0,
        cultures: {},
      }
      cur.cultures[r.cultura] = (cur.cultures[r.cultura] ?? 0) + r.total_volume
      if (r.avg_produtividade != null) {
        cur.sumProd += r.avg_produtividade
        cur.countProd += 1
      }
      byYear.set(r.ano, cur)
    }
    return Array.from(byYear.values())
      .sort((a, b) => a.ano - b.ano)
      .map((y) => ({
        ano: y.ano,
        ...y.cultures,
        avg_prod: y.countProd > 0 ? y.sumProd / y.countProd : null,
      }))
  }, [resumoAnoCultura])

  const culturesInBar = allCulturesInData.filter((c) =>
    chartData.some((d) => c in d)
  )

  const donutData = useMemo(() => {
    const recentYear =
      filtered.length > 0 ? Math.max(...filtered.map((p) => p.ano)) : null
    const src =
      recentYear != null ? filtered.filter((p) => p.ano === recentYear) : filtered
    const map = new Map<string, number>()
    for (const p of src) {
      map.set(p.cultura, (map.get(p.cultura) ?? 0) + p.area_ha)
    }
    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }))
  }, [filtered])

  const donutYear =
    filtered.length > 0 ? Math.max(...filtered.map((p) => p.ano)) : null

  const statCards = [
    {
      label: 'Talhões Ativos',
      value: talhoesAtivos,
      icon: MapPin,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Área Total',
      value: `${stats.totalArea} ha`,
      icon: BarChart3,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Volume Total',
      value: `${stats.totalVolume} sc`,
      icon: Sprout,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Produtividade Média',
      value: `${stats.avgProd} sc/ha`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  const selectClass =
    'px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500'

  const tableRows = useMemo(
    () =>
      [...resumoAnoCultura].sort(
        (a, b) => b.ano - a.ano || a.cultura.localeCompare(b.cultura)
      ),
    [resumoAnoCultura]
  )

  // Empty state — when there's nothing in the database at all.
  if (plantios.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
          <Sprout className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Nenhum plantio cadastrado ainda
        </h2>
        <p className="text-sm text-gray-500 mb-6 max-w-md">
          Importe sua planilha de plantios para começar a visualizar
          produtividade, áreas e evolução das safras.
        </p>
        <Link
          href="/dashboard/uploads"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UploadIcon className="w-4 h-4" />
          Importar Planilha
        </Link>
      </div>
    )
  }

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
        <select
          value={filterSafra}
          onChange={(e) => setFilterSafra(e.target.value)}
          className={selectClass}
        >
          <option value="all">Todas as safras</option>
          {safrasList.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <div
                className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}
              >
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Analytical KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Best historical productivity */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">
              Melhor Produtividade
            </span>
            <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          {bestProd ? (
            <>
              <p className="text-2xl font-bold text-gray-900">
                {bestProd.produtividade_sc_ha?.toFixed(1)} sc/ha
              </p>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {bestProd.talhao} · {bestProd.cultura} · {bestProd.ano}
              </p>
            </>
          ) : (
            <p className="text-2xl font-bold text-gray-400">—</p>
          )}
        </div>

        {/* YoY productivity change */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">
              Evolução Anual (Prod.)
            </span>
            <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          {yoyChange ? (
            <>
              <p
                className={`text-2xl font-bold ${
                  yoyChange.pct >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {yoyChange.pct >= 0 ? '+' : ''}
                {yoyChange.pct.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {yoyChange.prev} → {yoyChange.last}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-400">—</p>
              <p className="text-xs text-gray-500 mt-1">
                Histórico insuficiente
              </p>
            </>
          )}
        </div>

        {/* Pending harvests */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">
              Colheitas Pendentes
            </span>
            <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {pendentes.pct.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {pendentes.count} de {pendentes.total} plantios
          </p>
        </div>

        {/* Area by safra */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">
              Área por Safra
            </span>
            <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-teal-600" />
            </div>
          </div>
          {areaPorSafra.length === 0 ? (
            <p className="text-2xl font-bold text-gray-400">—</p>
          ) : (
            <ul className="space-y-1.5 mt-1">
              {areaPorSafra.map(({ safra, area }) => (
                <li
                  key={safra}
                  className="flex justify-between text-sm"
                >
                  <span className="text-gray-600">{safra}</span>
                  <span className="font-semibold text-gray-900">
                    {area.toFixed(1)} ha
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Composed chart: bars (volume) + line (avg productivity) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Evolução da Produção por Cultura
          </h2>
          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              Sem dados para exibir
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: 'sc',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11, fill: '#9ca3af' },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: 'sc/ha',
                    angle: 90,
                    position: 'insideRight',
                    style: { fontSize: 11, fill: '#9ca3af' },
                  }}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (value == null) return ['—', name as string]
                    if (name === 'Produtividade Média') {
                      return [`${Number(value).toFixed(1)} sc/ha`, name]
                    }
                    return [`${Number(value).toFixed(1)} sc`, name as string]
                  }}
                />
                <Legend />
                {culturesInBar.map((cultura) => (
                  <Bar
                    key={cultura}
                    yAxisId="left"
                    dataKey={cultura}
                    fill={CULTURE_COLORS[cultura] ?? '#888888'}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avg_prod"
                  name="Produtividade Média"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              </ComposedChart>
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

      {/* Summary table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Resumo de Produção</h2>
        </div>
        {tableRows.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Sprout className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum dado encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Ano', 'Cultura', 'Área Total (ha)', 'Volume Total (sc)', 'Prod. Média (sc/ha)'].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                          i >= 2 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
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
                      {r.total_volume != null ? r.total_volume.toFixed(1) : '—'}
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
        )}
      </div>
    </>
  )
}
