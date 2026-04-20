'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type TalhaoMapData = {
  id: string
  nome: string
  geojson: object
  cultura: string | null
  safra: string | null
  ano: number | null
  area_ha: number | null
  produtividade_sc_ha: number | null
}

const CULTURE_COLORS: Record<string, string> = {
  Soja: '#16a34a',
  Milho: '#ca8a04',
  Sorgo: '#ea580c',
  Cevada: '#d97706',
  Batata: '#7c3aed',
  Trigo: '#b45309',
  Feijão: '#78350f',
}

function BoundsController({ talhoes }: { talhoes: TalhaoMapData[] }) {
  const map = useMap()

  useEffect(() => {
    const features = talhoes
      .filter((t) => t.geojson)
      .map((t) => ({ type: 'Feature' as const, geometry: t.geojson, properties: {} }))

    if (features.length === 0) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bounds = L.geoJSON({ type: 'FeatureCollection', features } as any).getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] })
    } catch {
      // invalid geojson, use default view
    }
  }, [map, talhoes])

  return null
}

export function TalhoesMapInner({ talhoes }: { talhoes: TalhaoMapData[] }) {
  return (
    <MapContainer
      center={[-15, -50]}
      zoom={4}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <BoundsController talhoes={talhoes} />
      {talhoes
        .filter((t) => t.geojson)
        .map((talhao) => {
          const color = CULTURE_COLORS[talhao.cultura ?? ''] ?? '#6b7280'
          return (
            <GeoJSON
              key={talhao.id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data={talhao.geojson as any}
              style={{
                color,
                fillColor: color,
                fillOpacity: 0.4,
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ minWidth: 160 }} className="text-sm">
                  <p className="font-semibold text-gray-900 mb-2">{talhao.nome}</p>
                  <div className="space-y-1 text-gray-600">
                    <p>
                      <span className="font-medium">Cultura:</span>{' '}
                      {talhao.cultura ?? '—'}
                    </p>
                    <p>
                      <span className="font-medium">Safra:</span>{' '}
                      {talhao.safra ?? '—'}
                    </p>
                    <p>
                      <span className="font-medium">Ano:</span>{' '}
                      {talhao.ano ?? '—'}
                    </p>
                    <p>
                      <span className="font-medium">Área:</span>{' '}
                      {talhao.area_ha != null
                        ? `${Number(talhao.area_ha).toFixed(1)} ha`
                        : '—'}
                    </p>
                    <p>
                      <span className="font-medium">Produtividade:</span>{' '}
                      {talhao.produtividade_sc_ha != null
                        ? `${Number(talhao.produtividade_sc_ha).toFixed(1)} sc/ha`
                        : '—'}
                    </p>
                  </div>
                </div>
              </Popup>
            </GeoJSON>
          )
        })}
    </MapContainer>
  )
}
