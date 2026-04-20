'use client'

import { useState, useMemo } from 'react'
import { Sprout } from 'lucide-react'

export type PlantioRow = {
  id: string
  ano: number
  data_plantio: string | null
  data_colheita: string | null
  area_ha: number
  volume_colhido: number | null
  produtividade_sc_ha: number | null
  talhao: string
  cultura: string
  safra: string
  unidade: string
  agronomo: string | null
  latitude: number | null
  longitude: number | null
}

type Props = {
  plantios: PlantioRow[]
  anos: number[]
  safras: string[]
  culturas: string[]
  talhoes: string[]
}

export function PlantiosClient({ plantios, anos, safras, culturas, talhoes }: Props) {
  const [filterAno, setFilterAno] = useState<string>('all')
  const [filterSafra, setFilterSafra] = useState<string>('all')
  const [filterCultura, setFilterCultura] = useState<string>('all')
  const [filterTalhao, setFilterTalhao] = useState<string>('all')

  const filtered = useMemo(
    () =>
      plantios
        .filter((p) => {
          if (filterAno !== 'all' && p.ano !== Number(filterAno)) return false
          if (filterSafra !== 'all' && p.safra !== filterSafra) return false
          if (filterCultura !== 'all' && p.cultura !== filterCultura) return false
          if (filterTalhao !== 'all' && p.talhao !== filterTalhao) return false
          return true
        })
        .sort((a, b) => {
          if (b.ano !== a.ano) return b.ano - a.ano
          return (b.data_plantio ?? '').localeCompare(a.data_plantio ?? '')
        }),
    [plantios, filterAno, filterSafra, filterCultura, filterTalhao]
  )

  const totals = useMemo(() => {
    const totalArea = filtered.reduce((s, p) => s + p.area_ha, 0)
    const totalVolume = filtered.reduce((s, p) => s + (p.volume_colhido ?? 0), 0)
    const prodValues = filtered.flatMap((p) =>
      p.produtividade_sc_ha != null ? [p.produtividade_sc_ha] : []
    )
    const avgProd =
      prodValues.length > 0
        ? prodValues.reduce((a, b) => a + b, 0) / prodValues.length
        : null
    return { totalArea, totalVolume, avgProd }
  }, [filtered])

  const formatDate = (d: string | null) => {
    if (!d) return null
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  }

  const selectClass =
    'px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500'

  const columns = [
    { label: 'Talhão', right: false },
    { label: 'Agrônomo', right: false },
    { label: 'Cultura', right: false },
    { label: 'Safra', right: false },
    { label: 'Ano', right: false },
    { label: 'Dt. Plantio', right: false },
    { label: 'Dt. Colheita', right: false },
    { label: 'Área (ha)', right: true },
    { label: 'Volume Colhido', right: true },
    { label: 'Produtividade (sc/ha)', right: true },
  ]

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
          {anos.map((a) => (
            <option key={a} value={String(a)}>
              {a}
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
        <select
          value={filterCultura}
          onChange={(e) => setFilterCultura(e.target.value)}
          className={selectClass}
        >
          <option value="all">Todas as culturas</option>
          {culturas.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterTalhao}
          onChange={(e) => setFilterTalhao(e.target.value)}
          className={selectClass}
        >
          <option value="all">Todos os talhões</option>
          {talhoes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Lista de Plantios</h2>
          <span className="text-sm text-gray-500">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Sprout className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum plantio encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {columns.map(({ label, right }) => (
                    <th
                      key={label}
                      className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        right ? 'text-right' : 'text-left'
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {p.talhao}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.agronomo ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{p.cultura}</td>
                    <td className="px-5 py-3 text-gray-600">{p.safra}</td>
                    <td className="px-5 py-3 text-gray-600">{p.ano}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {formatDate(p.data_plantio) ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.data_colheita ? (
                        formatDate(p.data_colheita)
                      ) : (
                        <span className="text-amber-600 font-medium">Pendente</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {p.area_ha.toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {p.volume_colhido != null
                        ? `${Number(p.volume_colhido).toFixed(1)} ${p.unidade}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {p.produtividade_sc_ha != null
                        ? Number(p.produtividade_sc_ha).toFixed(1)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-700">
                  <td colSpan={7} className="px-5 py-3">
                    Total / Média
                  </td>
                  <td className="px-5 py-3 text-right text-gray-900">
                    {totals.totalArea.toFixed(1)}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-900">
                    {totals.totalVolume.toFixed(1)}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-900">
                    {totals.avgProd != null ? totals.avgProd.toFixed(1) : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
