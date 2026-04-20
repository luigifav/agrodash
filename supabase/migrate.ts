/**
 * Migration runner for Agrodash database schema.
 *
 * Usage (requires node_modules installed):
 *   DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres \
 *     npx tsx supabase/migrate.ts
 *
 * Or via Supabase service role (uses Supabase Management API):
 *   NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=[key] \
 *     npx tsx supabase/migrate.ts
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const schemaPath = join(import.meta.dirname ?? __dirname, 'schema.sql')
const sql = readFileSync(schemaPath, 'utf-8')

async function runWithDatabaseUrl(databaseUrl: string) {
  console.log('Running migration via psql...')
  execSync(`psql "${databaseUrl}" -f "${schemaPath}"`, { stdio: 'inherit' })
  console.log('Migration complete.')
}

async function runWithServiceRole(supabaseUrl: string, serviceRoleKey: string) {
  console.log('Running migration via Supabase Management API...')

  // Extract project ref from URL: https://[ref].supabase.co
  const ref = supabaseUrl.replace('https://', '').split('.')[0]

  // Split SQL into individual statements, skipping blanks and comments
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ query: statement }),
      }
    )

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Statement failed (${response.status}): ${body}\n\nSQL: ${statement.slice(0, 200)}`)
    }
  }

  console.log('Migration complete.')
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (databaseUrl) {
    await runWithDatabaseUrl(databaseUrl)
  } else if (supabaseUrl && serviceRoleKey) {
    await runWithServiceRole(supabaseUrl, serviceRoleKey)
  } else {
    console.error(`
Error: no credentials found.

Provide one of:
  - DATABASE_URL (direct PostgreSQL connection string)
  - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

Alternatively, paste the contents of supabase/schema.sql directly in the
Supabase Dashboard → SQL Editor and run it there.
    `)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
