import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Carrega .env.local manualmente (sem dependência de dotenv)
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // usa service role para bypassar RLS
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Você é um especialista em nomenclatura de talhões agrícolas brasileiros.
Identifique quais talhões representam o mesmo campo físico.

REGRAS — considere iguais:
- Variações de pivô: PV, Pv, pv, Pivô, Pivo, PIVO → sempre normalize para "Pivô"
- Números: 1/I/Um, 2/II/Dois, 3/III/Três, 4/IV/Quatro, 5/V/Cinco (até 20)
- Acentuação: ignore diferenças (seleçoes = seleções)
- Capitalização: ignore completamente
- Sufixos de ano: 2021, 2022, 2023, 2024, 21/22, 22/23, 23/24 → ignore
- Sufixos de cultura: Soja, Milho, Trigo, Feijão, Verão, Safrinha, Inverno → ignore
- Separadores: hífen, underline, espaço duplo → ignore
- Abreviações: Faz = Fazenda, Prop = Propriedade, Sel = Seleções, Prod = Produção

Para cada grupo, o nome canônico deve ser o mais COMPLETO e LEGÍVEL,
com acentuação correta e sem sufixos de ano/cultura.

Retorne APENAS JSON sem markdown:
[{ "canonical_id": "uuid", "canonical_nome": "Nome Canônico Legível", "alias_ids": ["uuid1","uuid2"] }]
Omita talhões sem duplicatas.`

async function main() {
  console.log('🌱 Agrodash — Normalizador de Talhões\n')

  // 1. Busca talhões
  const { data: talhoes, error } = await supabase
    .from('talhoes')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')

  if (error) { console.error('Erro ao buscar talhões:', error.message); process.exit(1) }
  if (!talhoes || talhoes.length < 2) { console.log('Menos de 2 talhões. Nada a normalizar.'); return }

  console.log(`📋 ${talhoes.length} talhões encontrados. Enviando para análise...\n`)

  // 2. Processa em lotes de 60 para evitar rate limit
  const LOTE = 60
  const grupos: Array<{ canonical_id: string; canonical_nome: string; alias_ids: string[] }> = []

  for (let i = 0; i < talhoes.length; i += LOTE) {
    const lote = talhoes.slice(i, i + LOTE)
    console.log(`🤖 Analisando talhões ${i + 1}–${Math.min(i + LOTE, talhoes.length)}...`)

    let tentativa = 0
    while (tentativa < 3) {
      try {
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: JSON.stringify(lote.map(t => ({ id: t.id, nome: t.nome }))) }]
        })

        if (msg.stop_reason !== 'end_turn') throw new Error('Resposta truncada')
        const text = (msg.content[0] as { text: string }).text
          .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
        const resultado = JSON.parse(text)
        grupos.push(...resultado)
        break
      } catch (err: unknown) {
        tentativa++
        const e = err as Error
        if (e.message?.includes('rate_limit') && tentativa < 3) {
          console.log(`  ⏳ Rate limit, aguardando ${tentativa * 3}s...`)
          await new Promise(r => setTimeout(r, tentativa * 3000))
        } else { throw err }
      }
    }

    if (i + LOTE < talhoes.length) {
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  if (grupos.length === 0) { console.log('\n✅ Nenhum talhão duplicado encontrado.'); return }

  console.log(`\n📊 ${grupos.length} grupo(s) identificado(s):\n`)

  // 3. Mostra preview e aplica
  for (const g of grupos) {
    const canonico = talhoes.find(t => t.id === g.canonical_id)
    const aliases = talhoes.filter(t => g.alias_ids.includes(t.id))
    console.log(`  ✓ "${g.canonical_nome}"`)
    for (const a of aliases) console.log(`      ← "${a.nome}"`)

    // Atualiza nome do talhão canônico
    await supabase.from('talhoes').update({ nome: g.canonical_nome }).eq('id', g.canonical_id)

    // Move plantios dos aliases para o canônico
    await supabase.from('plantios').update({ talhao_id: g.canonical_id }).in('talhao_id', g.alias_ids)

    // Desativa aliases
    await supabase.from('talhoes').update({ ativo: false }).in('id', g.alias_ids)
  }

  console.log('\n✅ Normalização concluída! Recarregue o dashboard.')
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1) })
