'use client'

import { useState } from 'react'
import { AlertCircle, TrendingUp, CalendarDays, Lightbulb, Loader } from 'lucide-react'

type InsightsResponse = {
  summary: {
    total_plantios: number
    periodo: string
    culturas_analisadas: string[]
    safras_analisadas: string[]
    area_total_ha: number
    volume_total_colhido: number | null
    produtividade_media_sc_ha: number | null
    produtividade_min_sc_ha: number | null
    produtividade_max_sc_ha: number | null
    por_ano: Record<
      number,
      {
        total_plantios: number
        area_ha: number
        produtividade_media_sc_ha: number | null
      }
    >
    por_cultura: Record<
      string,
      {
        total_plantios: number
        produtividade_media_sc_ha: number | null
        area_ha: number
      }
    >
    melhor_safra: {
      cultura: string
      ano: number
      produtividade_sc_ha: number
    } | null
    pior_safra: {
      cultura: string
      ano: number
      produtividade_sc_ha: number
    } | null
  }
  insights: {
    tendencia: string
    melhor_epoca: string
    alertas: string[]
    recomendacoes: string[]
  }
}

export default function InsightsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<InsightsResponse | null>(null)
  const [anosInput, setAnosInput] = useState('')
  const [cultura, setCultura] = useState('')
  const [talhaoId, setTalhaoId] = useState('')

  async function handleGenerateAnalysis(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const body: Record<string, unknown> = {}

      if (talhaoId.trim()) {
        body.talhao_id = talhaoId
      }
      if (cultura.trim()) {
        body.cultura = cultura
      }
      if (anosInput.trim()) {
        const anos = anosInput
          .split(',')
          .map((y) => parseInt(y.trim()))
          .filter((y) => !isNaN(y))
        if (anos.length > 0) {
          body.anos = anos
        }
      }

      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao gerar análise')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Análise de Insights</h1>

      {/* Form */}
      <form
        onSubmit={handleGenerateAnalysis}
        className="bg-white rounded-lg border border-gray-200 p-6 mb-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Talhão (ID)
            </label>
            <input
              type="text"
              value={talhaoId}
              onChange={(e) => setTalhaoId(e.target.value)}
              placeholder="ID do talhão (opcional)"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cultura
            </label>
            <input
              type="text"
              value={cultura}
              onChange={(e) => setCultura(e.target.value)}
              placeholder="Nome da cultura (opcional)"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anos
            </label>
            <input
              type="text"
              value={anosInput}
              onChange={(e) => setAnosInput(e.target.value)}
              placeholder="Ex: 2022, 2023, 2024"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                'Gerar Análise'
              )}
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          Deixe os campos vazios para analisar todos os plantios. Use vírgulas para separar
          anos múltiplos.
        </p>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Total de Plantios</p>
              <p className="text-3xl font-bold text-gray-900">{result.summary.total_plantios}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Período</p>
              <p className="text-3xl font-bold text-gray-900">{result.summary.periodo}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Área Total (ha)</p>
              <p className="text-3xl font-bold text-gray-900">
                {result.summary.area_total_ha.toFixed(1)}
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Prod. Média (sc/ha)</p>
              <p className="text-3xl font-bold text-gray-900">
                {result.summary.produtividade_media_sc_ha
                  ? result.summary.produtividade_media_sc_ha.toFixed(1)
                  : '—'}
              </p>
            </div>
          </div>

          {/* Insights Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tendência */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2">Tendência</h3>
                  <p className="text-blue-800">{result.insights.tendencia}</p>
                </div>
              </div>
            </div>

            {/* Melhor Época */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6">
              <div className="flex items-start gap-3">
                <CalendarDays className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-2">Melhor Época</h3>
                  <p className="text-green-800">{result.insights.melhor_epoca}</p>
                </div>
              </div>
            </div>

            {/* Alertas */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-orange-900 mb-3">Alertas</h3>
                  <ul className="space-y-2">
                    {result.insights.alertas.length > 0 ? (
                      result.insights.alertas.map((alerta, idx) => (
                        <li key={idx} className="text-sm text-orange-800">
                          • {alerta}
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-orange-800">Nenhum alerta identificado</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Recomendações */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 p-6">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-purple-900 mb-3">Recomendações</h3>
                  <ul className="space-y-2">
                    {result.insights.recomendacoes.length > 0 ? (
                      result.insights.recomendacoes.map((rec, idx) => (
                        <li key={idx} className="text-sm text-purple-800">
                          • {rec}
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-purple-800">Nenhuma recomendação disponível</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Detalhes por Cultura */}
          {Object.keys(result.summary.por_cultura).length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Desempenho por Cultura</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(result.summary.por_cultura).map(
                  ([cultura, stats]) => (
                    <div
                      key={cultura}
                      className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200"
                    >
                      <p className="font-semibold text-gray-900 mb-3">{cultura}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Plantios:</span>
                          <span className="font-medium text-gray-900">{stats.total_plantios}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Área (ha):</span>
                          <span className="font-medium text-gray-900">{stats.area_ha.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Prod. Média:</span>
                          <span className="font-medium text-gray-900">
                            {stats.produtividade_media_sc_ha
                              ? stats.produtividade_media_sc_ha.toFixed(1)
                              : '—'}{' '}
                            sc/ha
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Melhor e Pior Safra */}
          {(result.summary.melhor_safra || result.summary.pior_safra) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {result.summary.melhor_safra && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6">
                  <h3 className="font-semibold text-green-900 mb-4">Melhor Safra</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-700">Cultura:</span>
                      <span className="font-medium text-green-900">
                        {result.summary.melhor_safra.cultura}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Ano:</span>
                      <span className="font-medium text-green-900">
                        {result.summary.melhor_safra.ano}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Produtividade:</span>
                      <span className="font-medium text-green-900">
                        {result.summary.melhor_safra.produtividade_sc_ha.toFixed(1)} sc/ha
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {result.summary.pior_safra && (
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200 p-6">
                  <h3 className="font-semibold text-orange-900 mb-4">Pior Safra</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-orange-700">Cultura:</span>
                      <span className="font-medium text-orange-900">
                        {result.summary.pior_safra.cultura}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-700">Ano:</span>
                      <span className="font-medium text-orange-900">
                        {result.summary.pior_safra.ano}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-700">Produtividade:</span>
                      <span className="font-medium text-orange-900">
                        {result.summary.pior_safra.produtividade_sc_ha.toFixed(1)} sc/ha
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600">Preencha os filtros e clique em "Gerar Análise" para ver os insights</p>
        </div>
      )}
    </div>
  )
}
