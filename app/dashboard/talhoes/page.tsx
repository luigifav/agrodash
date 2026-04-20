import { createClient } from "@/lib/supabase/server";
import { MapPin } from "lucide-react";
import { TalhoesMap } from "@/components/talhoes-map";
import type { TalhaoMapData } from "@/components/talhoes-map";

export default async function TalhoesPage() {
  const supabase = await createClient();

  const [talhoesRes, plantiosRes] = await Promise.all([
    supabase
      .from("talhoes")
      .select("id, nome, geojson, ativo, criado_em")
      .order("criado_em", { ascending: false }),
    supabase
      .from("plantios")
      .select(
        `talhao_id, ano, data_plantio, area_ha, produtividade_sc_ha,
         culturas(nome), safras(nome)`
      )
      .order("ano", { ascending: false })
      .order("data_plantio", { ascending: false }),
  ]);

  const talhoes = talhoesRes.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plantios: any[] = plantiosRes.data ?? [];

  // Most recent planting per talhão (plantios is already sorted desc)
  const latestByTalhao = new Map<string, (typeof plantios)[number]>();
  for (const p of plantios) {
    if (!latestByTalhao.has(p.talhao_id)) {
      latestByTalhao.set(p.talhao_id, p);
    }
  }

  const mapData: TalhaoMapData[] = talhoes
    .filter((t) => t.geojson != null)
    .map((t) => {
      const latest = latestByTalhao.get(t.id);
      return {
        id: t.id,
        nome: t.nome,
        geojson: t.geojson as object,
        cultura: latest?.culturas?.nome ?? null,
        safra: latest?.safras?.nome ?? null,
        ano: latest?.ano ?? null,
        area_ha: latest?.area_ha != null ? Number(latest.area_ha) : null,
        produtividade_sc_ha:
          latest?.produtividade_sc_ha != null
            ? Number(latest.produtividade_sc_ha)
            : null,
      };
    });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Talhões</h1>

      {mapData.length > 0 && (
        <div className="mb-8">
          <TalhoesMap talhoes={mapData} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Lista de Talhões</h2>
        </div>
        {talhoes.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum talhão cadastrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mapa
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data de Criação
                  </th>
                </tr>
              </thead>
              <tbody>
                {talhoes.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {t.nome}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          t.ativo
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {t.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          t.geojson
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {t.geojson ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {new Date(t.criado_em).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
