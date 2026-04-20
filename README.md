# Agrodash

Dashboard de produção agrícola para acompanhar safras, talhões e culturas ao longo dos anos.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Linguagem**: TypeScript
- **Estilo**: Tailwind CSS + Shadcn UI (Radix)
- **Banco de dados**: Supabase (PostgreSQL)
- **Gráficos**: Recharts
- **Mapas**: React Leaflet
- **Exportação**: xlsx
- **IA**: Claude API (Anthropic) — somente server-side

## Estrutura de pastas

```
agrodash/
├── app/                    # App Router — rotas, layouts e páginas
│   ├── api/                # Route handlers (server-side only)
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ui/                 # Componentes Shadcn UI
├── hooks/                  # React hooks customizados
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Cliente Supabase (browser)
│   │   └── server.ts       # Cliente Supabase (server / RSC)
│   └── utils.ts            # Utilitários (cn, etc.)
├── public/
├── components.json         # Configuração Shadcn UI
├── tailwind.config.ts
└── tsconfig.json
```

## Variáveis de ambiente

Configure as variáveis diretamente no painel do Vercel (Settings → Environment Variables):

| Variável | Descrição | Onde é usada |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | Client e Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon pública do Supabase | Client e Server |
| `ANTHROPIC_API_KEY` | Chave da API Claude (Anthropic) | **Somente server-side** (route handlers em `app/api/`) |

> **Importante:** `ANTHROPIC_API_KEY` nunca deve ser importada em arquivos com `"use client"` ou em qualquer módulo acessível pelo browser.

## Desenvolvimento

O projeto é configurado para deploy no Vercel sem necessidade de ambiente local. Para rodar localmente, crie um `.env.local` com as variáveis acima (nunca commite esse arquivo).
