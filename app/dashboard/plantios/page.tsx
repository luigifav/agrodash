import { createClient } from "@/lib/supabase/server";
import { Sprout } from "lucide-react";

export default async function PlantiosPage() {
  const supabase = await createClient();
  const { data: plantios } = await supabase
    .from("plantios")
    .select(
      `id, ano, area_ha, volume_colhido, produtividade_sc_ha,
       talhoes(nome), culturas(nome), safras(nome), unidades(sigla)`
    )
    .order("criado_em", { ascending: false });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Plantios</h1>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Lista de Plantios</h2>
        </div>
        {!plantios || plantios.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Sprout className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum plantio registrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    "Talhão",
                    "Cultura",
                    "Safra",
                    "Ano",
                    "Área (ha)",
                    "Volume Colhido",
                    "Produtividade (sc/ha)",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${i >= 4 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(plantios as any[]).map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {p.talhoes?.nome ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.culturas?.nome ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.safras?.nome ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{p.ano}</td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {Number(p.area_ha).toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {p.volume_colhido
                        ? `${Number(p.volume_colhido).toFixed(1)} ${p.unidades?.sigla ?? ""}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {p.produtividade_sc_ha
                        ? Number(p.produtividade_sc_ha).toFixed(1)
                        : "—"}
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
