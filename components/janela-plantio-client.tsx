'use client'

import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { JanelaData } from '@/lib/database.types'

type Props = {
  data: JanelaData[]
}

type AggRow = {
  periodo: string
  mes: number
  quinzena: 1 | 2
  produtividade_media: number
  total_plantios: number
  area_media: number
}

const VERDE_ESCURO = '#15803d'
const VERDE_MEDIO = '#16a34a'
const VERDE_CLARO = '#86efac'

const selectClass =
  'px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500'

export function JanelaPlantioClient({ data }: Props) {
  const culturas = useMemo(
    () => Array.from(new Set(data.map((d) => d.cultura))).sort(),
    [data]
  )
  const [culturaSelecionada, setCulturaSelecionada] = useState<string>(
    culturas[0] ?? ''
  )
  const [talhaoSelecionado, setTalhaoSelecionado] =
    useState<string>('todos')

  const talhoesDaCultura = useMemo(
    () =>
      Array.from(
        new Set(
          data
            .filter((d) => d.cultura === culturaSelecionada)
            .map((d) => d.talhao)
        )
      ).sort(),
    [data, culturaSelecionada]
  )

  const chartData: AggRow[] = useMemo(() => {
    const filtrado = data.filter((d) => d.cultura === culturaSelecionada)

    if (talhaoSelecionado !== 'todos') {
      return filtrado
        .filter((d) => d.talhao === talhaoSelecionado)
        .map((d) => ({
          periodo: d.periodo,
          mes: d.mes,
          quinzena: d.quinzena,
          produtividade_media: d.produtividade_media,
          total_plantios: d.total_plantios,
          area_media: d.area_media,
        }))
        .sort((a, b) => a.mes - b.mes || a.quinzena - b.quinzena)
    }

    // "Todos os Talhões" — média ponderada por total_plantios
    const grupos = new Map<
      string,
      {
        mes: number
        quinzena: 1 | 2
        prodWeighted: number
        plantios: number
        areaWeighted: number
        areaWeightCount: number
      }
    >()

    filtrado.forEach((d) => {
      const key = d.periodo
      const cur = grupos.get(key) ?? {
        mes: d.mes,
        quinzena: d.quinzena,
        prodWeighted: 0,
        plantios: 0,
        areaWeighted: 0,
        areaWeightCount: 0,
      }
      cur.prodWeighted += d.produtividade_media * d.total_plantios
      cur.plantios += d.total_plantios
      cur.areaWeighted += d.area_media * d.total_plantios
      cur.areaWeightCount += d.total_plantios
      grupos.set(key, cur)
    })

    return Array.from(grupos.entries())
      .map(([periodo, v]) => ({
        periodo,
        mes: v.mes,
        quinzena: v.quinzena,
        produtividade_media:
          v.plantios > 0 ? v.prodWeighted / v.plantios : 0,
        total_plantios: v.plantios,
        area_media:
          v.areaWeightCount > 0 ? v.areaWeighted / v.areaWeightCount : 0,
      }))
      .sort((a, b) => a.mes - b.mes || a.quinzena - b.quinzena)
  }, [data, culturaSelecionada, talhaoSelecionado])

  const ranking = useMemo(() => {
    const sorted = [...chartData].sort(
      (a, b) => b.produtividade_media - a.produtividade_media
    )
    const top3 = sorted.slice(0, 3)
    const colorMap = new Map<string, string>()
    sorted.forEach((row, idx) => {
      let color = VERDE_CLARO
      if (idx === 0) color = VERDE_ESCURO
      else if (idx <= 3) color = VERDE_MEDIO
      colorMap.set(row.periodo, color)
    })
    return { top3, colorMap }
  }, [chartData])

  const chartHeight = Math.max(400, chartData.length * 45)

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={culturaSelecionada}
          onChange={(e) => {
            setCulturaSelecionada(e.target.value)
            setTalhaoSelecionado('todos')
          }}
          className={selectClass}
        >
          {culturas.length === 0 && <option value="">—</option>}
          {culturas.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={talhaoSelecionado}
          onChange={(e) => setTalhaoSelecionado(e.target.value)}
          className={selectClass}
        >
          <option value="todos">Todos os Talhões</option>
          {talhoesDaCultura.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Gráfico */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">
          Produtividade Média por Quinzena de Plantio
        </h2>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
            Sem dados para exibir
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 60, left: 20, bottom: 10 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => v.toFixed(0)}
              />
              <YAxis
                type="category"
                dataKey="periodo"
                tick={{ fontSize: 12 }}
                width={120}
              />
              <Tooltip
                cursor={{ fill: 'rgba(22, 163, 74, 0.05)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const row = payload[0].payload as AggRow
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm text-sm">
                      <p className="font-semibold text-gray-900 mb-1">
                        {row.periodo}
                      </p>
                      <p className="text-gray-600">
                        Produtividade média:{' '}
                        <span className="text-gray-900 font-medium">
                          {row.produtividade_media.toFixed(1)} sc/ha
                        </span>
                      </p>
                      <p className="text-gray-600">
                        Plantios no histórico:{' '}
                        <span className="text-gray-900 font-medium">
                          {row.total_plantios}
                        </span>
                      </p>
                      <p className="text-gray-600">
                        Área média:{' '}
                        <span className="text-gray-900 font-medium">
                          {row.area_media.toFixed(2)} ha
                        </span>
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="produtividade_media" radius={[0, 4, 4, 0]}>
                {chartData.map((row) => (
                  <Cell
                    key={row.periodo}
                    fill={ranking.colorMap.get(row.periodo) ?? VERDE_CLARO}
                  />
                ))}
                <LabelList
                  dataKey="produtividade_media"
                  position="right"
                  formatter={(v) =>
                    typeof v === 'number' ? `${v.toFixed(1)} sc/ha` : ''
                  }
                  style={{ fontSize: 12, fill: '#374151' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top 3 */}
      {ranking.top3.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">
            Melhores Janelas de Plantio
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ranking.top3.map((r, idx) => {
              const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'
              const isFirst = idx === 0
              return (
                <div
                  key={r.periodo}
                  className={`rounded-xl border p-5 ${
                    isFirst
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{medalha}</span>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {idx + 1}º lugar
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {r.periodo}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {r.produtividade_media.toFixed(1)} sc/ha
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Baseado em {r.total_plantios}{' '}
                    {r.total_plantios === 1 ? 'plantio' : 'plantios'} do
                    histórico
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
