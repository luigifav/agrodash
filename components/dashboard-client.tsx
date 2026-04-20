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

export const CULTURE_COLORS: Record<string, string> = {
  Soja: '#16a34a',
  Milho: '#ca8a04',
  Sorgo: '#ea580c',
  Cevada: '#d97706',
  Batata: '#7c3aed',
  Trigo: '#b45309',
  Feijão: '#78350f',
}

export type PlantioData = {
  id: string
  ano: number
  area_ha: number
  volume_colhido: number | null
  produtividade_sc_ha: number | null
  cultura: string
  safra: string
  talhao: string
}

type Props = {
  plantios: PlantioData[]
  safras: string[]
  talhoesAtivos: number
}

export function DashboardClient({ plantios, safras, talhoesAtivos }: Props) {
  const [filterAno, setFilterAno] = useState<string>('all')
  const [filterSafra, setFilterSafra] = useState<string>('all')

  const years = useMemo(
    () => [...new Set(plantios.map((p) => p.ano))].sort((a, b) => a - b),
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

  const stats = useMemo(() => {
    const totalArea = filtered.reduce((s, p) => s + (p.area_ha || 0), 0)
    const prodValues = filtered.flatMap((p) =>
      p.produtividade_sc_ha != null ? [p.produtividade_sc_ha] : []
    )
    const avgProd =
      prodValues.length > 0
        ? prodValues.reduce((a, b) => a + b, 0) / prodValues.length
        : 0
    return {
      totalPlantios: filtered.length,
      totalArea: totalArea.toFixed(1),
      avgProd: avgProd.toFixed(1),
    }
  }, [filtered])

  const allCulturesInData = useMemo(
    () => [...new Set(plantios.map((p) => p.cultura))].sort(),
    [plantios]
  )

  const barData: Array<Record<string, number>> = useMemo(() => {
    const grouped: Record<number, Record<string, number>> = {}
    filtered.forEach((p) => {
      if (!grouped[p.ano]) grouped[p.ano] = {}
      grouped[p.ano][p.cultura] =
        (grouped[p.ano][p.cultura] || 0) + (p.volume_colhido || 0)
    })
    return Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([ano, cultures]) => ({ ano: Number(ano), ...cultures }))
  }, [filtered])

  const donutData = useMemo(() => {
    const recentYear =
      filtered.length > 0 ? Math.max(...filtered.map((p) => p.ano)) : null
    const src =
      recentYear != null ? filtered.filter((p) => p.ano === recentYear) : filtered
    const grouped: Record<string, number> = {}
    src.forEach((p) => {
      grouped[p.cultura] = (grouped[p.cultura] || 0) + (p.area_ha || 0)
    })
    return Object.entries(grouped).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }))
  }, [filtered])

  const recentPlantios = useMemo(
    () => [...filtered].sort((a, b) => b.ano - a.ano).slice(0, 10),
    [filtered]
  )

  const culturesInBar = allCulturesInData.filter((c) =>
    barData.some((d) => c in d)
  )

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
      label: 'Total Plantios',
      value: stats.totalPlantios,
      icon: Sprout,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Área Total',
      value: `${stats.totalArea} ha`,
      icon: BarChart3,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
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
          {safras.map((s) => (
            <option key={s} value={s}>
              {s}
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

      {/* Recent plantios */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Últimos Plantios</h2>
        </div>
        {recentPlantios.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Sprout className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum plantio encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Talhão', 'Cultura', 'Safra', 'Ano', 'Área (ha)', 'Produtividade'].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                          i >= 4 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {recentPlantios.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 text-gray-900">{p.talhao}</td>
                    <td className="px-5 py-3 text-gray-600">{p.cultura}</td>
                    <td className="px-5 py-3 text-gray-600">{p.safra}</td>
                    <td className="px-5 py-3 text-gray-600">{p.ano}</td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {Number(p.area_ha).toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {p.produtividade_sc_ha != null
                        ? `${Number(p.produtividade_sc_ha).toFixed(1)} sc/ha`
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
