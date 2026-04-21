"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, Loader2, CheckCircle, XCircle, FileText, FileSpreadsheet } from "lucide-react";

type ParsedRow = {
  talhao_nome: string;
  ano: number;
  safra_nome: string;
  cultura_nome: string;
  data_plantio: string;
  data_colheita: string | null;
  area_ha: number;
  area_unidade: string;
  volume_colhido: number | null;
  unidade_sigla: string;
  produtividade_sc_ha: number | null;
  agronomo_nome: string | null;
  latitude: number | null;
  longitude: number | null;
};

type UploadRecord = {
  id: string;
  nome_arquivo: string;
  status: string;
  criado_em: string;
};

const SAFRAS = ["Verão", "Inverno", "Safrinha"];
const CULTURAS = ["Soja", "Milho", "Sorgo", "Cevada", "Batata", "Trigo", "Feijão"];
const UNIDADES = ["sc", "t"];
const AREA_UNIDADES = ["ha", "alq"];
const ALQ_TO_HA = 2.42;

export default function UploadsPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    fetchUploads();
  }, []);

  async function fetchUploads() {
    const { data } = await supabase
      .from("uploads")
      .select("id, nome_arquivo, status, criado_em")
      .order("criado_em", { ascending: false });
    setUploads(data ?? []);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setRows([]);
    setFeedback(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse-planilha", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", msg: data.error ?? "Erro ao processar planilha." });
      } else {
        setRows(data as ParsedRow[]);
      }
    } catch {
      setFeedback({ type: "error", msg: "Erro de conexão ao processar planilha." });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateRow(index: number, field: keyof ParsedRow, value: string | number | null) {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  async function handleSave() {
    if (rows.length === 0 || !fileName) return;
    setSaving(true);
    setFeedback(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    try {
      const [
        { data: culturas },
        { data: safras },
        { data: unidades },
        { data: talhoes },
      ] = await Promise.all([
        supabase.from("culturas").select("id, nome"),
        supabase.from("safras").select("id, nome"),
        supabase.from("unidades").select("id, sigla"),
        supabase.from("talhoes").select("id, nome"),
      ]);

      const culturaMap = new Map((culturas ?? []).map((c) => [c.nome, c.id]));
      const safraMap = new Map((safras ?? []).map((s) => [s.nome, s.id]));
      const unidadeMap = new Map((unidades ?? []).map((u) => [u.sigla, u.id]));
      const talhaoMap = new Map((talhoes ?? []).map((t) => [t.nome, t.id]));

      // Collect unique talhao names that don't exist yet
      const seen = new Set<string>();
      const newTalhaoNames: string[] = [];
      for (const r of rows) {
        if (r.talhao_nome && !talhaoMap.has(r.talhao_nome) && !seen.has(r.talhao_nome)) {
          seen.add(r.talhao_nome);
          newTalhaoNames.push(r.talhao_nome);
        }
      }

      if (newTalhaoNames.length > 0) {
        const { data: inserted, error } = await supabase
          .from("talhoes")
          .insert(newTalhaoNames.map((nome) => ({ nome })))
          .select("id, nome");
        if (error) throw new Error(`Erro ao criar talhões: ${error.message}`);
        (inserted ?? []).forEach((t: { id: string; nome: string }) => talhaoMap.set(t.nome, t.id));

        // Upsert Point GeoJSON para talhões recém-criados que têm coordenadas
        const talhaoCoordMap = new Map<string, { lat: number; lng: number }>();
        for (const r of rows) {
          if (r.latitude != null && r.longitude != null && !talhaoCoordMap.has(r.talhao_nome)) {
            talhaoCoordMap.set(r.talhao_nome, { lat: r.latitude, lng: r.longitude });
          }
        }
        const geojsonUpdates = newTalhaoNames
          .filter((nome) => talhaoCoordMap.has(nome))
          .map((nome) => {
            const coords = talhaoCoordMap.get(nome)!;
            return supabase
              .from("talhoes")
              .update({ geojson: { type: "Point", coordinates: [coords.lng, coords.lat] } })
              .eq("id", talhaoMap.get(nome)!);
          });
        if (geojsonUpdates.length > 0) await Promise.all(geojsonUpdates);
      }

      const plantiosPayload = rows.map((r) => ({
        talhao_id: talhaoMap.get(r.talhao_nome) ?? null,
        cultura_id: culturaMap.get(r.cultura_nome) ?? null,
        safra_id: safraMap.get(r.safra_nome) ?? null,
        ano: r.ano,
        data_plantio: r.data_plantio,
        data_colheita: r.data_colheita ?? null,
        area_ha: r.area_unidade === "alq" ? r.area_ha * ALQ_TO_HA : r.area_ha,
        area_unidade: r.area_unidade,
        volume_colhido: r.volume_colhido ?? null,
        unidade_id: unidadeMap.get(r.unidade_sigla) ?? null,
        produtividade_sc_ha: r.produtividade_sc_ha ?? null,
        agronomo: r.agronomo_nome ?? null,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
        criado_por: user?.id ?? null,
      }));

      const missing = plantiosPayload.filter(
        (p) => !p.talhao_id || !p.cultura_id || !p.safra_id || !p.unidade_id
      );
      if (missing.length > 0) {
        throw new Error(
          `${missing.length} registro(s) com campos obrigatórios inválidos (talhão, cultura, safra ou unidade não encontrados).`
        );
      }

      const { error: plantioError } = await supabase.from("plantios").insert(plantiosPayload);
      if (plantioError) throw new Error(`Erro ao salvar plantios: ${plantioError.message}`);

      await supabase.from("uploads").insert({
        nome_arquivo: fileName,
        status: "concluido",
        criado_por: user?.id ?? null,
      });

      setFeedback({ type: "success", msg: `${rows.length} plantio(s) salvos com sucesso!` });
      setRows([]);
      setFileName(null);
      await fetchUploads();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setFeedback({ type: "error", msg });

      await supabase.from("uploads").insert({
        nome_arquivo: fileName ?? "desconhecido",
        status: "erro",
        criado_por: user?.id ?? null,
      });
      await fetchUploads();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Uploads</h1>

      {/* Upload area */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Importar Planilha</h2>
        </div>
        <div className="p-6">
          <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-600">
              Clique para selecionar um arquivo{" "}
              <span className="font-semibold">.XLS</span>,{" "}
              <span className="font-semibold">.XLSX</span> ou{" "}
              <span className="font-semibold">.PDF</span>
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={loading || saving}
            />
          </label>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 p-5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700">
          <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
          <span className="text-sm">Processando planilha com IA... Isso pode levar alguns segundos.</span>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
            feedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Editable results table */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">Resultados Extraídos</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {rows.length} registro(s) encontrado(s). Revise e corrija se necessário.
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Confirmar e salvar"
              )}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[
                    "Talhão",
                    "Ano",
                    "Safra",
                    "Cultura",
                    "Data Plantio",
                    "Data Colheita",
                    "Área",
                    "Unid.",
                    "Vol. Colhido",
                    "Unidade",
                    "Prod. (sc/ha)",
                    "Agrônomo",
                    "Lat.",
                    "Long.",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-2 py-1.5">
                      <input
                        className="w-28 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.talhao_nome ?? ""}
                        onChange={(e) => updateRow(i, "talhao_nome", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className="w-16 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.ano ?? ""}
                        onChange={(e) => updateRow(i, "ano", parseInt(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.safra_nome ?? ""}
                        onChange={(e) => updateRow(i, "safra_nome", e.target.value)}
                      >
                        <option value="">--</option>
                        {SAFRAS.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.cultura_nome ?? ""}
                        onChange={(e) => updateRow(i, "cultura_nome", e.target.value)}
                      >
                        <option value="">--</option>
                        {CULTURAS.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.data_plantio ?? ""}
                        onChange={(e) => updateRow(i, "data_plantio", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.data_colheita ?? ""}
                        onChange={(e) =>
                          updateRow(i, "data_colheita", e.target.value || null)
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.0001"
                        className="w-20 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.area_ha ?? ""}
                        onChange={(e) =>
                          updateRow(i, "area_ha", parseFloat(e.target.value) || 0)
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.area_unidade ?? "ha"}
                        onChange={(e) => {
                          const newUnit = e.target.value;
                          const oldUnit = row.area_unidade ?? "ha";
                          if (newUnit === oldUnit) return;
                          const converted = newUnit === "ha"
                            ? row.area_ha * ALQ_TO_HA
                            : row.area_ha / ALQ_TO_HA;
                          setRows((prev) => {
                            const updated = [...prev];
                            updated[i] = { ...updated[i], area_unidade: newUnit, area_ha: Math.round(converted * 10000) / 10000 };
                            return updated;
                          });
                        }}
                      >
                        {AREA_UNIDADES.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.0001"
                        className="w-20 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.volume_colhido ?? ""}
                        onChange={(e) =>
                          updateRow(
                            i,
                            "volume_colhido",
                            e.target.value === "" ? null : parseFloat(e.target.value)
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.unidade_sigla ?? ""}
                        onChange={(e) => updateRow(i, "unidade_sigla", e.target.value)}
                      >
                        <option value="">--</option>
                        {UNIDADES.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.0001"
                        className="w-20 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.produtividade_sc_ha ?? ""}
                        onChange={(e) =>
                          updateRow(
                            i,
                            "produtividade_sc_ha",
                            e.target.value === "" ? null : parseFloat(e.target.value)
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-28 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.agronomo_nome ?? ""}
                        onChange={(e) => updateRow(i, "agronomo_nome", e.target.value || null)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.0000001"
                        placeholder="—"
                        className="w-24 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.latitude ?? ""}
                        onChange={(e) =>
                          updateRow(i, "latitude", e.target.value === "" ? null : parseFloat(e.target.value))
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.0000001"
                        placeholder="—"
                        className="w-24 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        value={row.longitude ?? ""}
                        onChange={(e) =>
                          updateRow(i, "longitude", e.target.value === "" ? null : parseFloat(e.target.value))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end p-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Confirmar e salvar"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Upload history */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Histórico de Uploads</h2>
        </div>
        {uploads.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Upload className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum upload realizado ainda.</p>
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
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {u.nome_arquivo.toLowerCase().endsWith(".pdf") ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
                            <FileText className="w-3 h-3" />
                            PDF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">
                            <FileSpreadsheet className="w-3 h-3" />
                            XLS
                          </span>
                        )}
                        <span className="font-medium text-gray-900">{u.nome_arquivo}</span>
                      </div>
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
