'use client'

import { useState, useMemo } from 'react'
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
import { MapPin, Sprout, BarChart3, TrendingUp } from 'lucide-react'
import type { ResumoProducao } from '@/lib/database.types'

export const CULTURE_COLORS: Record<string, string> = {
  Soja: '#16a34a',
  Milho: '#ca8a04',
  Sorgo: '#ea580c',
  Cevada: '#d97706',
  Batata: '#7c3aed',
  Trigo: '#b45309',
  Feijão: '#78350f',
}

type Props = {
  resumo: ResumoProducao[]
  talhoesAtivos: number
}

export function DashboardClient({ resumo, talhoesAtivos }: Props) {
  const [filterAno, setFilterAno] = useState<string>('all')

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

  const stats = useMemo(() => {
    const totalArea = filtered.reduce((s, r) => s + r.total_area, 0)
    const totalVolume = filtered.reduce((s, r) => s + (r.total_volume ?? 0), 0)
    const prodValues = filtered.flatMap((r) =>
      r.avg_produtividade != null ? [r.avg_produtividade] : []
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
      recentYear != null ? filtered.filter((r) => r.ano === recentYear) : filtered
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
    () => [...filtered].sort((a, b) => b.ano - a.ano || a.cultura.localeCompare(b.cultura)),
    [filtered]
  )

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
