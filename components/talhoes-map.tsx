'use client'

import dynamic from 'next/dynamic'
import type { TalhaoMapData } from './talhoes-map-inner'

export type { TalhaoMapData }

const DynamicMap = dynamic(
  () => import('./talhoes-map-inner').then((m) => m.TalhoesMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-xl bg-gray-100 animate-pulse" style={{ height: 400 }} />
    ),
  }
)

export function TalhoesMap({ talhoes }: { talhoes: TalhaoMapData[] }) {
  return (
    <div className="w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: 400 }}>
      <DynamicMap talhoes={talhoes} />
    </div>
  )
}
