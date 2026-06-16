'use client';

import type {
  Feature,
  FeatureCollection,
  GeoJSON,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';
import 'mapbox-gl/dist/mapbox-gl.css';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapboxMap, { Layer, MapRef, ScaleControl, Source } from 'react-map-gl/mapbox';

import { useGetServiceOrderById } from '@/queries/service-order.query';
import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';
import { ServiceOrder } from '@/types/service-order.type';

const MAPBOX_TOKEN =
  'pk.eyJ1IjoiYW50b25pb3Zpbmk0NyIsImEiOiJjbWJoNW9wM2swNmlyMmlvbGlmb3J6NW4xIn0.wKznYpMm2m5Z0Opjjkpa-Q';

const FARM_COLOR_PALETTE = [
  '#e74c3c',
  '#8e44ad',
  '#3498db',
  '#16a085',
  '#f1c40f',
  '#e67e22',
  '#e84118',
  '#8c7ae6',
  '#00a8ff',
  '#44bd32',
  '#2ed573',
  '#ff4757',
  '#5352ed',
  '#1e90ff',
  '#7bed9f',
  '#ff6b81',
  '#f5cd79',
  '#596275',
  '#574b90',
  '#00b894',
];

type DrawableGeometry = Polygon | MultiPolygon;
type LngLatBoundsTuple = [[number, number], [number, number]];

type FarmLegendItem = {
  key: string;
  name: string;
  hectares: number;
  fill: string;
};

type PlotFeatureDraft = {
  feature: Feature<DrawableGeometry>;
  farmKey: string;
};

type StrategicMapData = {
  featureCollection: FeatureCollection<DrawableGeometry>;
  farms: FarmLegendItem[];
  totalHectares: number;
  bounds: LngLatBoundsTuple | null;
};

export default function StrategicMapPrintPage({
  params,
}: {
  params: Promise<{ idServiceOrder: string }>;
}) {
  const { idServiceOrder } = use(params);
  const mapRef = useRef<MapRef | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [generatedAtLabel, setGeneratedAtLabel] = useState('');

  const {
    data: serviceOrder,
    isPending,
    isError,
  } = useGetServiceOrderById(idServiceOrder, {
    includePlots: 'true',
    includeGeoJson: 'true',
    includeFarms: 'true',
    includeCustomers: 'true',
    includeContracts: 'true',
  });

  const strategicMapData = useMemo(
    () => (serviceOrder ? buildStrategicMapData(serviceOrder) : null),
    [serviceOrder]
  );

  const mapTitle = useMemo(() => {
    if (!serviceOrder) {
      return 'MAPA ESTRATÉGICO';
    }

    const customerName = getCustomerShortName(serviceOrder.customer?.name);
    const serviceOrderType = (serviceOrder.observation || 'OS')
      .trim()
      .toLocaleUpperCase('pt-BR');

    return `${customerName} - MAPA ESTRATÉGICO - ${serviceOrderType}`;
  }, [serviceOrder]);

  const fitMapToBounds = useCallback(() => {
    if (!mapRef.current || !strategicMapData?.bounds) {
      return;
    }

    const map = mapRef.current;
    const mapboxMap = map.getMap();
    const rect = mapboxMap.getContainer().getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;

    mapboxMap.resize();
    map.fitBounds(strategicMapData.bounds, {
      duration: 0,
      essential: true,
      maxZoom: 16,
      padding: {
        top: Math.max(90, height * 0.12),
        right: Math.max(120, width * 0.08),
        bottom: Math.max(120, height * 0.16),
        left: Math.max(120, width * 0.1),
      },
    });
  }, [strategicMapData?.bounds]);

  useEffect(() => {
    setGeneratedAtLabel(formatGeneratedAt(new Date()));
  }, []);

  useEffect(() => {
    if (!isMapLoaded) {
      return;
    }

    const timeoutId = window.setTimeout(fitMapToBounds, 150);
    return () => window.clearTimeout(timeoutId);
  }, [fitMapToBounds, isMapLoaded]);

  useEffect(() => {
    const handleResize = () => {
      window.setTimeout(fitMapToBounds, 50);
    };

    const handleBeforePrint = () => {
      window.setTimeout(fitMapToBounds, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [fitMapToBounds]);

  const hasMapFeatures = Boolean(strategicMapData?.featureCollection.features.length);

  return (
    <>
      <main className='strategic-map-print-page'>
        <div className='strategic-map-canvas'>
          {hasMapFeatures ? (
            <MapboxMap
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{
                longitude: -51.9253,
                latitude: -14.235,
                zoom: 4,
              }}
              style={{ width: '100vw', height: '100vh' }}
              mapStyle='mapbox://styles/mapbox/streets-v12'
              attributionControl={false}
              logoPosition='bottom-left'
              preserveDrawingBuffer={true}
              onLoad={() => setIsMapLoaded(true)}
            >
              <Source
                id='strategic-map-source'
                type='geojson'
                data={strategicMapData!.featureCollection}
              >
                <Layer
                  id='strategic-map-fill'
                  type='fill'
                  paint={{
                    'fill-color': ['coalesce', ['get', 'fill'], '#3388ff'],
                    'fill-opacity': 0.82,
                  }}
                />
                <Layer
                  id='strategic-map-outline'
                  type='line'
                  paint={{
                    'line-color': '#111111',
                    'line-opacity': 0.95,
                    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.4, 13, 2.6, 16, 3.4],
                  }}
                />
                <Layer
                  id='strategic-map-labels'
                  type='symbol'
                  layout={{
                    'text-field': [
                      'format',
                      ['coalesce', ['get', 'plot_name'], ''],
                      {},
                      '\n',
                      {},
                      ['coalesce', ['get', 'hectare_label'], ''],
                      { 'font-scale': 0.82 },
                    ],
                    'text-size': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      8,
                      9,
                      12,
                      12,
                      16,
                      15,
                    ],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-anchor': 'center',
                    'text-allow-overlap': true,
                    'text-ignore-placement': true,
                    'text-optional': false,
                  }}
                  paint={{
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1.2,
                  }}
                />
              </Source>
              <ScaleControl maxWidth={220} unit='metric' position='bottom-left' />
            </MapboxMap>
          ) : (
            <div className='strategic-map-empty-state'>
              {isPending
                ? 'Carregando mapa estratégico...'
                : isError
                  ? 'Não foi possível carregar a ordem de serviço.'
                  : 'Mapa indisponível: talhões sem geoJson.'}
            </div>
          )}
        </div>

        <h1 className='strategic-map-title'>{mapTitle}</h1>
        <div className='strategic-map-generated-at'>
          {generatedAtLabel || 'GERADO EM: --/--/---- ÀS --:--'}
        </div>
        <NorthArrow />

        {strategicMapData && (
          <aside className='strategic-map-legend' aria-label='Legenda por fazenda'>
            <h2>LEGENDA</h2>
            <div className='strategic-map-legend-items'>
              {strategicMapData.farms.map((farm) => (
                <div className='strategic-map-legend-item' key={farm.key}>
                  <span
                    className='strategic-map-legend-swatch'
                    style={{ backgroundColor: farm.fill }}
                  />
                  <span>
                    {farm.name} ({formatHectares(farm.hectares)} ha)
                  </span>
                </div>
              ))}
            </div>
            <div className='strategic-map-legend-total'>
              TOTAL: {formatHectares(strategicMapData.totalHectares)} HA
            </div>
          </aside>
        )}

        <img
          className='strategic-map-logo'
          src='/images/ds-drones-agricolas-logo.png'
          alt='DS Drones Agrícolas'
        />
      </main>

      <style jsx global>{`
        @page {
          size: A0 landscape;
          margin: 0;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .strategic-map-print-page,
        .strategic-map-print-page * {
          box-sizing: border-box;
          letter-spacing: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .strategic-map-print-page {
          position: fixed;
          inset: 0;
          z-index: 99999;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #f5f1e8;
          color: #000000;
          font-family:
            Segoe UI,
            Arial,
            sans-serif;
        }

        .strategic-map-canvas,
        .strategic-map-canvas .mapboxgl-map {
          width: 100vw;
          height: 100vh;
        }

        .strategic-map-canvas {
          position: absolute;
          inset: 0;
          z-index: 1;
        }

        .strategic-map-title {
          position: absolute;
          top: 32px;
          left: 50%;
          z-index: 10;
          width: min(1500px, calc(100vw - 520px));
          margin: 0;
          transform: translateX(-50%);
          color: #000000;
          font-size: 52px;
          font-weight: 900;
          line-height: 1;
          overflow: hidden;
          text-align: center;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .strategic-map-generated-at {
          position: absolute;
          top: 34px;
          right: 42px;
          z-index: 11;
          border: 2px solid #111111;
          background: rgba(255, 255, 255, 0.88);
          color: #000000;
          padding: 7px 13px;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.15;
          white-space: nowrap;
        }

        .strategic-map-north-arrow {
          position: absolute;
          top: 42px;
          left: 42px;
          z-index: 10;
          width: 170px;
          height: 170px;
          pointer-events: none;
        }

        .strategic-map-legend {
          position: absolute;
          bottom: 46px;
          left: 48px;
          z-index: 10;
          max-width: min(720px, calc(100vw - 760px));
          color: #000000;
          pointer-events: none;
          text-transform: uppercase;
        }

        .strategic-map-legend h2 {
          margin: 0 0 10px;
          color: #000000;
          font-size: 17px;
          font-weight: 900;
          line-height: 1;
        }

        .strategic-map-legend-items {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .strategic-map-legend-item {
          display: flex;
          align-items: center;
          min-height: 18px;
          color: #000000;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.1;
          text-shadow:
            -1px -1px 0 #ffffff,
            1px -1px 0 #ffffff,
            -1px 1px 0 #ffffff,
            1px 1px 0 #ffffff;
        }

        .strategic-map-legend-swatch {
          width: 18px;
          height: 18px;
          margin-right: 11px;
          flex: 0 0 auto;
          border: 1px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.24);
        }

        .strategic-map-legend-total {
          display: inline-block;
          margin-top: 13px;
          padding-top: 9px;
          border-top: 2px solid #111111;
          color: #000000;
          font-size: 16px;
          font-weight: 900;
          line-height: 1;
          text-shadow:
            -1px -1px 0 #ffffff,
            1px -1px 0 #ffffff,
            -1px 1px 0 #ffffff,
            1px 1px 0 #ffffff;
        }

        .strategic-map-logo {
          position: absolute;
          right: 46px;
          bottom: 42px;
          z-index: 10;
          width: 280px;
          max-width: 24vw;
          height: auto;
          pointer-events: none;
        }

        .strategic-map-empty-state {
          display: flex;
          width: 100vw;
          height: 100vh;
          align-items: center;
          justify-content: center;
          background: #f5f1e8;
          color: #111111;
          font-size: 20px;
          font-weight: 800;
          text-align: center;
        }

        .strategic-map-print-page .mapboxgl-ctrl-logo,
        .strategic-map-print-page .mapboxgl-ctrl-attrib {
          display: none !important;
        }

        .strategic-map-print-page .mapboxgl-ctrl-bottom-left {
          right: auto;
          bottom: 42px;
          left: 50%;
          transform: translateX(-50%);
        }

        .strategic-map-print-page .mapboxgl-ctrl-scale {
          border-color: #111111;
          border-width: 0 2px 2px;
          background: rgba(255, 255, 255, 0.9);
          color: #111111;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.1;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          .strategic-map-print-page,
          .strategic-map-print-page * {
            visibility: visible !important;
          }

          .strategic-map-print-page {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }

          .strategic-map-canvas,
          .strategic-map-canvas .mapboxgl-map {
            width: 100vw !important;
            height: 100vh !important;
          }

          .strategic-map-title {
            top: 50px !important;
            width: 100% !important;
            max-width: none !important;
            padding: 0 900px !important;
            color: #000000 !important;
            font-size: 100px !important;
            text-shadow: none !important;
          }

          .strategic-map-generated-at {
            top: 100px !important;
            right: 100px !important;
            border: 8px solid #000000 !important;
            background: transparent !important;
            padding: 24px 48px !important;
            color: #000000 !important;
            font-size: 56px !important;
            text-shadow: none !important;
          }

          .strategic-map-north-arrow {
            top: 100px !important;
            left: 100px !important;
            width: 600px !important;
            height: 600px !important;
          }

          .strategic-map-legend {
            bottom: 100px !important;
            left: 100px !important;
            max-width: 1600px !important;
          }

          .strategic-map-legend h2 {
            margin-bottom: 32px !important;
            font-size: 56px !important;
            text-shadow: none !important;
          }

          .strategic-map-legend-items {
            gap: 24px !important;
          }

          .strategic-map-legend-item {
            min-height: 60px !important;
            font-size: 48px !important;
            text-shadow: none !important;
          }

          .strategic-map-legend-swatch {
            width: 60px !important;
            height: 60px !important;
            margin-right: 40px !important;
            border: 4px solid #ffffff !important;
          }

          .strategic-map-legend-total {
            margin-top: 48px !important;
            padding-top: 32px !important;
            border-top: 8px solid #000000 !important;
            font-size: 56px !important;
            text-shadow: none !important;
          }

          .strategic-map-logo {
            right: 100px !important;
            bottom: 100px !important;
            width: 900px !important;
            max-width: 900px !important;
          }

          .strategic-map-print-page .mapboxgl-ctrl-bottom-left {
            bottom: 100px !important;
            left: 50% !important;
            transform: translateX(-50%) scale(4) !important;
            transform-origin: bottom center !important;
          }

          .strategic-map-print-page .mapboxgl-ctrl-scale {
            border-width: 0 2px 2px !important;
            background: rgba(255, 255, 255, 0.9) !important;
            font-size: 14px !important;
          }
        }
      `}</style>
    </>
  );
}

function buildStrategicMapData(serviceOrder: ServiceOrder): StrategicMapData {
  const farmsById = buildFarmMap(serviceOrder.farms || []);
  const farmSummaries = new Map<string, Omit<FarmLegendItem, 'fill'>>();
  const drafts: PlotFeatureDraft[] = [];

  (serviceOrder.plots || []).forEach((plot) => {
    const farmKey = plot.farmId || `farmless-${plot.name}`;
    const farmName = formatFarmName(farmsById.get(plot.farmId || '')?.name || 'FAZENDA SEM NOME');
    const hectares = parseHectares(plot.hectare);
    const current = farmSummaries.get(farmKey) || {
      key: farmKey,
      name: farmName,
      hectares: 0,
    };

    current.hectares += hectares;
    farmSummaries.set(farmKey, current);

    const plotGeoJson = parsePlotGeoJson(plot.geoJson);
    if (!plotGeoJson) {
      return;
    }

    plotGeoJson.features.forEach((feature, index) => {
      if (!isDrawableGeometry(feature.geometry)) {
        return;
      }

      drafts.push({
        farmKey,
        feature: {
          type: 'Feature',
          geometry: feature.geometry,
          properties: {
            ...(feature.properties || {}),
            farm_id: farmKey,
            farm_name: farmName,
            hectare: formatHectares(hectares),
            hectare_label: `${formatHectares(hectares)} ha`,
            plot_id: plot.id || `${plot.name}-${index}`,
            plot_name: plot.name,
          },
        },
      });
    });
  });

  const farms = Array.from(farmSummaries.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
  );

  const colorByFarm = new Map<string, string>();
  farms.forEach((farm, index) => {
    colorByFarm.set(farm.key, FARM_COLOR_PALETTE[index % FARM_COLOR_PALETTE.length]);
  });

  const features = drafts.map(({ feature, farmKey }) => ({
    ...feature,
    properties: {
      ...(feature.properties || {}),
      fill: colorByFarm.get(farmKey) || '#3388ff',
      stroke: '#111111',
    },
  }));

  const featureCollection: FeatureCollection<DrawableGeometry> = {
    type: 'FeatureCollection',
    features,
  };

  const legendFarms = farms.map((farm) => ({
    ...farm,
    fill: colorByFarm.get(farm.key) || '#3388ff',
  }));

  return {
    featureCollection,
    farms: legendFarms,
    totalHectares: legendFarms.reduce((sum, farm) => sum + farm.hectares, 0),
    bounds: getFeatureCollectionBounds(featureCollection),
  };
}

function buildFarmMap(farms: Farm[]): Map<string, Farm> {
  const map = new Map<string, Farm>();
  farms.forEach((farm) => {
    if (farm?.id) {
      map.set(farm.id, farm);
    }
  });
  return map;
}

function parsePlotGeoJson(value: unknown): FeatureCollection | null {
  if (!value) {
    return null;
  }

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const geoJson = parsed as GeoJSON;
  if (geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)) {
    return geoJson;
  }

  if (geoJson.type === 'Feature') {
    return {
      type: 'FeatureCollection',
      features: [geoJson],
    };
  }

  if (geoJson.type === 'Polygon' || geoJson.type === 'MultiPolygon') {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: geoJson,
        },
      ],
    };
  }

  return null;
}

function isDrawableGeometry(geometry: Geometry | null | undefined): geometry is DrawableGeometry {
  return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
}

function getFeatureCollectionBounds(
  featureCollection: FeatureCollection<DrawableGeometry>
): LngLatBoundsTuple | null {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  featureCollection.features.forEach((feature) => {
    collectPositions(feature.geometry).forEach(([lng, lat]) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return;
      }

      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
  });

  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function collectPositions(geometry: DrawableGeometry): Position[] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flat();
  }

  return geometry.coordinates.flat(2);
}

function parseHectares(value: Plot['hectare']): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const raw = String(value).trim();
  if (!raw) {
    return 0;
  }

  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatHectares(value: number): string {
  return value.toFixed(2);
}

function formatFarmName(name: string): string {
  const trimmed = name.trim();
  return (trimmed || 'FAZENDA SEM NOME').toLocaleUpperCase('pt-BR');
}

function getCustomerShortName(name?: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return 'CLIENTE';
  }

  const normalized = normalizeText(trimmed);
  if (normalized.includes('MAITY BIOENERGIA') || normalized === 'MAITY') {
    return 'MAITY';
  }

  return trimmed.split(/\s+/)[0].toLocaleUpperCase('pt-BR');
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR');
}

function formatGeneratedAt(date: Date): string {
  const formattedDate = date.toLocaleDateString('pt-BR');
  const formattedTime = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `GERADO EM: ${formattedDate} ÀS ${formattedTime}`;
}

function NorthArrow() {
  return (
    <svg
      className='strategic-map-north-arrow'
      viewBox='0 0 140 140'
      xmlns='http://www.w3.org/2000/svg'
      aria-label='Rosa dos ventos'
    >
      <g>
        <path d='M70,70 L95,45 L70,70' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L95,95 L70,70' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L45,95 L70,70' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L45,45 L70,70' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L95,45 L75,65 Z' fill='black' />
        <path d='M70,70 L95,45 L85,70 Z' fill='white' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L95,95 L85,70 Z' fill='black' />
        <path d='M70,70 L95,95 L75,85 Z' fill='white' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L45,95 L65,85 Z' fill='black' />
        <path d='M70,70 L45,95 L55,70 Z' fill='white' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L45,45 L55,70 Z' fill='black' />
        <path d='M70,70 L45,45 L65,55 Z' fill='white' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L70,15 L60,60 Z' fill='white' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L70,15 L80,60 Z' fill='black' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L125,70 L80,60 Z' fill='white' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L125,70 L80,80 Z' fill='black' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L70,125 L60,80 Z' fill='black' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L70,125 L80,80 Z' fill='white' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L15,70 L60,60 Z' fill='black' stroke='black' strokeWidth='0.5' />
        <path d='M70,70 L15,70 L60,80 Z' fill='white' stroke='black' strokeWidth='0.5' />
        <text
          x='70'
          y='12'
          textAnchor='middle'
          fontFamily='Times New Roman, serif'
          fontWeight='bold'
          fontSize='16'
          fill='black'
        >
          N
        </text>
        <text
          x='70'
          y='138'
          textAnchor='middle'
          fontFamily='Times New Roman, serif'
          fontWeight='bold'
          fontSize='16'
          fill='black'
        >
          S
        </text>
        <text
          x='6'
          y='75'
          textAnchor='middle'
          fontFamily='Times New Roman, serif'
          fontWeight='bold'
          fontSize='16'
          fill='black'
        >
          W
        </text>
        <text
          x='134'
          y='75'
          textAnchor='middle'
          fontFamily='Times New Roman, serif'
          fontWeight='bold'
          fontSize='16'
          fill='black'
        >
          O
        </text>
      </g>
    </svg>
  );
}
