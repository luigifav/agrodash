import { createClient } from "@/lib/supabase/server";
import { Upload } from "lucide-react";

export default async function UploadsPage() {
  const supabase = await createClient();
  const { data: uploads } = await supabase
    .from("uploads")
    .select("id, nome_arquivo, status, criado_em")
    .order("criado_em", { ascending: false });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Uploads</h1>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Histórico de Uploads</h2>
        </div>
        {!uploads || uploads.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Upload className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum upload realizado ainda.</p>
            <p className="text-xs mt-1">
              Em breve: importação de dados via planilha.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Arquivo
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {u.nome_arquivo}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.status === "concluido"
                            ? "bg-green-100 text-green-700"
                            : u.status === "erro"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {new Date(u.criado_em).toLocaleDateString("pt-BR")}
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
