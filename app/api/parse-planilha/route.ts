import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// ── Types ──────────────────────────────────────────────────────────────────────

type ColumnMapping = {
  columns: {
    talhao_nome: string | null;
    ano: string | null;
    safra_nome: string | null;
    cultura_nome: string | null;
    data_plantio: string | null;
    data_colheita: string | null;
    area_ha: string | null;
    volume_colhido: string | null;
    unidade_sigla: string | null;
    produtividade_sc_ha: string | null;
  };
  normalizations: {
    safra_nome?: Record<string, string>;
    cultura_nome?: Record<string, string>;
    unidade_sigla?: Record<string, string>;
  };
  ano_from_plantio?: boolean;
};

// ── System prompts ─────────────────────────────────────────────────────────────

const XLSX_MAPPING_SYSTEM = `Você é um assistente de mapeamento de planilhas agrícolas brasileiras.
Analise os cabeçalhos e linhas de amostra fornecidos e retorne APENAS um objeto JSON válido, sem markdown, sem explicações.

Formato exato:
{
  "columns": {
    "talhao_nome": "nome exato da coluna ou null",
    "ano": "nome exato da coluna ou null",
    "safra_nome": "nome exato da coluna ou null",
    "cultura_nome": "nome exato da coluna ou null",
    "data_plantio": "nome exato da coluna ou null",
    "data_colheita": "nome exato da coluna ou null",
    "area_ha": "nome exato da coluna ou null",
    "volume_colhido": "nome exato da coluna ou null",
    "unidade_sigla": "nome exato da coluna ou null",
    "produtividade_sc_ha": "nome exato da coluna ou null"
  },
  "normalizations": {
    "safra_nome": { "valor_exato_da_planilha": "Verão|Inverno|Safrinha" },
    "cultura_nome": { "valor_exato_da_planilha": "Soja|Milho|Sorgo|Cevada|Batata|Trigo|Feijão" },
    "unidade_sigla": { "valor_exato_da_planilha": "sc|t" }
  },
  "ano_from_plantio": false
}

Regras:
- Se não houver coluna de ano separada, defina ano_from_plantio: true (o código extrai do data_plantio)
- normalizations deve cobrir TODOS os valores únicos de safra, cultura e unidade encontrados nas amostras
- Campos não encontrados na planilha: use null`;

const PDF_SYSTEM =
  "Você é um parser de relatórios agrícolas brasileiros em PDF. O texto abaixo foi extraído de um PDF que pode ser uma tabela, relatório ou planilha exportada. Analise o conteúdo e extraia todos os registros de plantio que encontrar. Retorne APENAS um array JSON válido, sem nenhum texto adicional, sem markdown, sem explicações. Se um campo não existir no documento, use null. Para safra, normalize para: Verão, Inverno ou Safrinha. Para cultura, normalize para: Soja, Milho, Sorgo, Cevada, Batata, Trigo ou Feijão. Para datas, use formato YYYY-MM-DD. O formato de cada objeto deve ser: { talhao_nome, ano, safra_nome, cultura_nome, data_plantio, data_colheita, area_ha, volume_colhido, unidade_sigla, produtividade_sc_ha }.";

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  // ISO string from xlsx cellDates:true  →  "2023-03-15T03:00:00.000Z"
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  // Already YYYY-MM-DD
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // DD/MM/YYYY
  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split("/");
    return `${y}-${m}-${d}`;
  }
  // Excel serial number
  if (typeof value === "number") {
    return new Date((value - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return isNaN(n) ? null : n;
}

function lookupNorm(raw: string, map: Record<string, string> | undefined): string {
  if (!map) return raw;
  const trimmed = raw.trim();
  // Exact match
  if (map[raw] != null) return map[raw];
  if (map[trimmed] != null) return map[trimmed];
  // Case-insensitive match
  const lower = trimmed.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase().trim() === lower) return v;
  }
  return trimmed;
}

function applyMapping(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping
) {
  const { columns: c, normalizations: norm = {}, ano_from_plantio } = mapping;

  return rows.map((row) => {
    const dataPlantio = parseDate(c.data_plantio ? row[c.data_plantio] : null);
    const dataColheita = parseDate(c.data_colheita ? row[c.data_colheita] : null);

    let ano: number | null = null;
    if (c.ano && row[c.ano] != null) {
      ano = parseInt(String(row[c.ano]));
      if (isNaN(ano)) ano = null;
    }
    if (ano == null && ano_from_plantio && dataPlantio) {
      ano = parseInt(dataPlantio.slice(0, 4));
    }

    const rawSafra = c.safra_nome ? String(row[c.safra_nome] ?? "") : "";
    const rawCultura = c.cultura_nome ? String(row[c.cultura_nome] ?? "") : "";
    const rawUnidade = c.unidade_sigla ? String(row[c.unidade_sigla] ?? "") : "";

    return {
      talhao_nome: c.talhao_nome ? String(row[c.talhao_nome] ?? "") : "",
      ano,
      safra_nome: lookupNorm(rawSafra, norm.safra_nome) || null,
      cultura_nome: lookupNorm(rawCultura, norm.cultura_nome) || null,
      data_plantio: dataPlantio,
      data_colheita: dataColheita,
      area_ha: parseNumber(c.area_ha ? row[c.area_ha] : null),
      volume_colhido: parseNumber(c.volume_colhido ? row[c.volume_colhido] : null),
      unidade_sigla: lookupNorm(rawUnidade, norm.unidade_sigla) || null,
      produtividade_sc_ha: parseNumber(c.produtividade_sc_ha ? row[c.produtividade_sc_ha] : null),
    };
  });
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}

// ── Route ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const isPdf = name.endsWith(".pdf");
  const isXlsx = name.endsWith(".xls") || name.endsWith(".xlsx");

  if (!isPdf && !isXlsx) {
    return NextResponse.json(
      { error: "Formato inválido. Envie um arquivo .xls, .xlsx ou .pdf" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── PDF path ─────────────────────────────────────────────────────────────────
  if (isPdf) {
    let pdfText: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      pdfText = result.text;
    } catch {
      return NextResponse.json({ error: "Não foi possível ler o arquivo PDF." }, { status: 422 });
    }

    if (!pdfText || pdfText.trim().length < 20) {
      return NextResponse.json(
        {
          error:
            "PDF não legível. O arquivo pode ser uma imagem escaneada sem texto. Tente converter para XLS ou XLSX antes de importar.",
        },
        { status: 422 }
      );
    }

    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 32768,
        system: PDF_SYSTEM,
        messages: [{ role: "user", content: `Aqui está o texto extraído do PDF:\n${pdfText.slice(0, 20000)}` }],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        return NextResponse.json({ error: "Resposta inesperada da IA" }, { status: 500 });
      }

      const parsed = JSON.parse(stripFences(content.text));
      return NextResponse.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      return NextResponse.json({ error: `Falha ao processar com IA: ${msg}` }, { status: 500 });
    }
  }

  // ── XLSX path — mapping strategy ─────────────────────────────────────────────
  let rows: Record<string, unknown>[];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as Record<string, unknown>[];
    rows = rows.slice(0, 500);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo. Verifique se é um .xls/.xlsx válido." },
      { status: 422 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "A planilha está vazia." }, { status: 422 });
  }

  // Send only headers + 10 sample rows to Claude — response is tiny regardless of spreadsheet size
  const sample = rows.slice(0, 10);
  const headers = Object.keys(rows[0]);

  let mapping: ColumnMapping;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: XLSX_MAPPING_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Cabeçalhos: ${JSON.stringify(headers)}\n\nLinhas de amostra:\n${JSON.stringify(sample, null, 2)}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Resposta inesperada da IA" }, { status: 500 });
    }

    mapping = JSON.parse(stripFences(content.text)) as ColumnMapping;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: `Falha ao processar com IA: ${msg}` }, { status: 500 });
  }

  const result = applyMapping(rows, mapping);
  return NextResponse.json(result);
}
