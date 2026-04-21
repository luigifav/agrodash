'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Loader } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Tables } from '@/lib/database.types';

type Talhao = Tables<'talhoes'>;
type Plantio = Tables<'plantios'> & {
  culturas: { nome: string } | null;
  safras: { nome: string } | null;
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TalhaoDetailPage({ params }: PageProps) {
  const [talhao, setTalhao] = useState<Talhao | null>(null);
  const [plantios, setPlantios] = useState<Plantio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const unwrapParams = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    };
    unwrapParams();
  }, [params]);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        const supabase = createClient();

        const [talhoesRes, plantiosRes] = await Promise.all([
          supabase.from('talhoes').select('*').eq('id', id).single(),
          supabase
            .from('plantios')
            .select(
              `id, talhao_id, ano, data_plantio, data_colheita,
               area_ha, volume_colhido, produtividade_sc_ha,
               culturas(nome), safras(nome)`
            )
            .eq('talhao_id', id)
            .order('ano', { ascending: false })
            .order('data_plantio', { ascending: false }),
        ]);

        if (talhoesRes.error) {
          setError('Talhão não encontrado');
          return;
        }

        if (plantiosRes.error) {
          setError('Erro ao carregar plantios');
          return;
        }

        setTalhao(talhoesRes.data);
        setPlantios(plantiosRes.data || []);
      } catch (err) {
        setError('Erro ao carregar dados');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !talhao) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Talhão não encontrado'}
        </div>
      </div>
    );
  }

  // Extract coordinates from geojson if available
  let coordinates: { lat: string; lon: string } | null = null;
  if (talhao.geojson) {
    const geojson = talhao.geojson as any;
    if (
      geojson.geometry?.type === 'Polygon' &&
      geojson.geometry?.coordinates?.[0]?.[0]
    ) {
      const [lon, lat] = geojson.geometry.coordinates[0][0];
      coordinates = { lat: lat.toFixed(4), lon: lon.toFixed(4) };
    }
  }

  // Calculate summary metrics
  const totalArea = plantios.reduce((sum, p) => sum + (p.area_ha || 0), 0);
  const avgProductivity =
    plantios.length > 0
      ? plantios.reduce((sum, p) => sum + (p.produtividade_sc_ha || 0), 0) /
        plantios.length
      : 0;

  // Prepare chart data - group by year
  const chartData = plantios
    .filter((p) => p.produtividade_sc_ha != null)
    .reverse()
    .reduce(
      (acc, p) => {
        const existing = acc.find((item) => item.ano === p.ano);
        if (existing) {
          existing.produtividade = (existing.produtividade + p.produtividade_sc_ha) / 2;
        } else {
          acc.push({
            ano: p.ano,
            produtividade: p.produtividade_sc_ha,
          });
        }
        return acc;
      },
      [] as Array<{ ano: number; produtividade: number }>
    );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{talhao.nome}</h1>
            <div className="flex items-center gap-4 mt-2">
              {coordinates && (
                <div className="flex items-center text-gray-600 text-sm">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>{coordinates.lat}°, {coordinates.lon}°</span>
                </div>
              )}
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  talhao.ativo
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {talhao.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-600 text-sm font-medium mb-2">Área Total</p>
          <p className="text-2xl font-bold text-gray-900">
            {totalArea.toFixed(2)}
            <span className="text-base font-normal text-gray-500 ml-1">ha</span>
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-600 text-sm font-medium mb-2">Total de Plantios</p>
          <p className="text-2xl font-bold text-gray-900">{plantios.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-600 text-sm font-medium mb-2">
            Produtividade Média Histórica
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {avgProductivity.toFixed(2)}
            <span className="text-base font-normal text-gray-500 ml-1">sc/ha</span>
          </p>
        </div>
      </div>

      {/* Plantios Table */}
      <div className="bg-white rounded-lg border border-gray-200 mb-8">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Histórico de Plantios</h2>
        </div>
        {plantios.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p>Nenhum plantio registrado para este talhão.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Safra
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ano
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cultura
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Plantio
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Colheita
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Área (ha)
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Volume Colhido
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produtividade (sc/ha)
                  </th>
                </tr>
              </thead>
              <tbody>
                {plantios.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900">{p.safras?.nome || '-'}</td>
                    <td className="px-5 py-3 text-gray-900">{p.ano}</td>
                    <td className="px-5 py-3 text-gray-900">{p.culturas?.nome || '-'}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {new Date(p.data_plantio).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.data_colheita
                        ? new Date(p.data_colheita).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                    <td className="px-5 py-3 text-gray-900">{p.area_ha?.toFixed(2)}</td>
                    <td className="px-5 py-3 text-gray-900">
                      {p.volume_colhido != null ? p.volume_colhido.toFixed(2) : '-'}
                    </td>
                    <td className="px-5 py-3 text-gray-900">
                      {p.produtividade_sc_ha != null
                        ? p.produtividade_sc_ha.toFixed(2)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Productivity Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-6">
            Evolução da Produtividade
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ano" />
              <YAxis />
              <Tooltip
                formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : value)}
                labelFormatter={(label) => `Ano: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="produtividade"
                stroke="#2563eb"
                dot={{ fill: '#2563eb' }}
                activeDot={{ r: 6 }}
                name="Produtividade (sc/ha)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
