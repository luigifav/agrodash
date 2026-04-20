import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const XLSX_SYSTEM =
  "Você é um parser de planilhas agrícolas brasileiras. Analise o conteúdo da planilha e extraia todos os registros de plantio que encontrar. Retorne APENAS um array JSON válido, sem nenhum texto adicional, sem markdown, sem explicações. Se um campo não existir na planilha, use null. Para safra, normalize para: Verão, Inverno ou Safrinha. Para cultura, normalize para: Soja, Milho, Sorgo, Cevada, Batata, Trigo ou Feijão. Para datas, use formato YYYY-MM-DD.";

const PDF_SYSTEM =
  "Você é um parser de relatórios agrícolas brasileiros em PDF. O texto abaixo foi extraído de um PDF que pode ser uma tabela, relatório ou planilha exportada. Analise o conteúdo e extraia todos os registros de plantio que encontrar. Retorne APENAS um array JSON válido, sem nenhum texto adicional, sem markdown, sem explicações. Se um campo não existir no documento, use null. Para safra, normalize para: Verão, Inverno ou Safrinha. Para cultura, normalize para: Soja, Milho, Sorgo, Cevada, Batata, Trigo ou Feijão. Para datas, use formato YYYY-MM-DD. O formato de cada objeto deve ser: { talhao_nome, ano, safra_nome, cultura_nome, data_plantio, data_colheita, area_ha, volume_colhido, unidade_sigla, produtividade_sc_ha }.";

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
    return NextResponse.json(
      { error: "Requisição inválida" },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "Nenhum arquivo enviado" },
      { status: 400 }
    );
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

  let systemPrompt: string;
  let userContent: string;

  if (isPdf) {
    let pdfText: string;
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      pdfText = result.text;
    } catch {
      return NextResponse.json(
        { error: "Não foi possível ler o arquivo PDF." },
        { status: 422 }
      );
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

    systemPrompt = PDF_SYSTEM;
    userContent = `Aqui está o texto extraído do PDF:\n${pdfText}`;
  } else {
    let rows: unknown[];
    try {
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
      rows = jsonData.slice(0, 500);
    } catch {
      return NextResponse.json(
        { error: "Não foi possível ler o arquivo. Verifique se é um .xls/.xlsx válido." },
        { status: 422 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "A planilha está vazia." },
        { status: 422 }
      );
    }

    systemPrompt = XLSX_SYSTEM;
    userContent = `Aqui está o conteúdo da planilha em JSON:\n${JSON.stringify(rows, null, 2)}`;
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let parsed: unknown;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json(
        { error: "Resposta inesperada da IA" },
        { status: 500 }
      );
    }

    parsed = JSON.parse(content.text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: `Falha ao processar com IA: ${msg}` },
      { status: 500 }
    );
  }

  return NextResponse.json(parsed);
}
