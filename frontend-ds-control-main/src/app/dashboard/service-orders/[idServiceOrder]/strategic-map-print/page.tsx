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
import type { jsPDF as JsPdf } from 'jspdf';
import mapboxgl, { type AnyLayer } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapboxMap, { Layer, MapRef, ScaleControl, Source } from 'react-map-gl/mapbox';

import { useGetServiceOrderById } from '@/queries/service-order.query';
import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';
import { ServiceOrder } from '@/types/service-order.type';

const MAPBOX_TOKEN =
  'pk.eyJ1IjoiYW50b25pb3Zpbmk0NyIsImEiOiJjbWJoNW9wM2swNmlyMmlvbGlmb3J6NW4xIn0.wKznYpMm2m5Z0Opjjkpa-Q';

const MAPBOX_STYLE = 'mapbox://styles/mapbox/streets-v12';
const STRATEGIC_MAP_SOURCE_ID = 'strategic-map-source';
const STRATEGIC_MAP_FILL_LAYER_ID = 'strategic-map-fill';
const STRATEGIC_MAP_OUTLINE_LAYER_ID = 'strategic-map-outline';
const STRATEGIC_MAP_LABELS_LAYER_ID = 'strategic-map-labels';

const EXPORT_WIDTH_PX = 11235;
const EXPORT_HEIGHT_PX = 7946;
const PDF_WIDTH_MM = 1189;
const PDF_HEIGHT_MM = 841;
const CSS_PX_TO_MM = 25.4 / 96;
const CSS_PX_TO_PT = 72 / 96;
const PAGE_WIDTH_CSS_PX = PDF_WIDTH_MM / CSS_PX_TO_MM;
const PAGE_HEIGHT_CSS_PX = PDF_HEIGHT_MM / CSS_PX_TO_MM;
const EXPORT_PX_PER_CSS_PX_X = EXPORT_WIDTH_PX / PAGE_WIDTH_CSS_PX;
const EXPORT_PX_PER_CSS_PX_Y = EXPORT_HEIGHT_PX / PAGE_HEIGHT_CSS_PX;
const EXPORT_TILE_WAIT_TIMEOUT_MS = 60000;
const EXPORT_EXTRA_RENDER_DELAY_MS = 500;
const LOGO_SRC = '/images/ds-drones-agricolas-logo.png';

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
  totalAppliedHectares: number;
  bounds: LngLatBoundsTuple | null;
};

type PdfScaleBar = {
  label: string;
  widthCssPx: number;
};

type StrategicMapPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type DevicePixelRatioRestore = () => void;

const STRATEGIC_MAP_FILL_LAYER: AnyLayer = {
  id: STRATEGIC_MAP_FILL_LAYER_ID,
  type: 'fill',
  source: STRATEGIC_MAP_SOURCE_ID,
  paint: {
    'fill-color': ['coalesce', ['get', 'fill'], '#3388ff'],
    'fill-opacity': 0.82,
  },
};

const STRATEGIC_MAP_OUTLINE_LAYER: AnyLayer = {
  id: STRATEGIC_MAP_OUTLINE_LAYER_ID,
  type: 'line',
  source: STRATEGIC_MAP_SOURCE_ID,
  paint: {
    'line-color': '#111111',
    'line-opacity': 0.95,
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.4, 13, 2.6, 16, 3.4],
  },
};

const STRATEGIC_MAP_LABELS_LAYER: AnyLayer = {
  id: STRATEGIC_MAP_LABELS_LAYER_ID,
  type: 'symbol',
  source: STRATEGIC_MAP_SOURCE_ID,
  layout: {
    'text-field': [
      'format',
      ['coalesce', ['get', 'plot_name'], ''],
      {},
      '\n',
      {},
      ['coalesce', ['get', 'hectare_label'], ''],
      { 'font-scale': 0.82 },
    ],
    'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 12, 12, 16, 15],
    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
    'text-anchor': 'center',
    'text-allow-overlap': true,
    'text-ignore-placement': true,
    'text-optional': false,
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': '#000000',
    'text-halo-width': 1.2,
  },
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
    const serviceOrderType = (serviceOrder.observation || 'OS').trim().toLocaleUpperCase('pt-BR');

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
      padding: getStrategicMapSafePadding(width, height, 'screen'),
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

  const handleDownloadReport = useCallback(async () => {
    if (!strategicMapData?.bounds || strategicMapData.featureCollection.features.length === 0) {
      alert('Mapa indispon\u00edvel para gerar o PDF em alta resolu\u00e7\u00e3o.');
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const generatedAt = generatedAtLabel || formatGeneratedAt(new Date());
      const { jsPDF } = await import('jspdf');
      const { imageDataUrl, scaleBar } = await generateStrategicMapImageDataUrl(strategicMapData);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [PDF_WIDTH_MM, PDF_HEIGHT_MM],
        compress: false,
      });

      pdf.addImage(imageDataUrl, 'PNG', 0, 0, PDF_WIDTH_MM, PDF_HEIGHT_MM, undefined, 'NONE');
      await drawStrategicMapPdfOverlays(pdf, {
        title: mapTitle,
        generatedAt,
        farms: strategicMapData.farms,
        totalHectares: strategicMapData.totalHectares,
        totalAppliedHectares: strategicMapData.totalAppliedHectares,
        scaleBar,
      });

      pdf.save(
        `mapa-estrategico-os-${sanitizeFilePart(serviceOrder?.number ?? idServiceOrder)}.pdf`
      );
    } catch (error) {
      console.error('Erro ao gerar PDF do mapa estrategico em alta resolucao:', error);
      alert('N\u00e3o foi poss\u00edvel gerar o PDF em alta resolu\u00e7\u00e3o.');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [generatedAtLabel, idServiceOrder, mapTitle, serviceOrder?.number, strategicMapData]);

  const hasMapFeatures = Boolean(strategicMapData?.featureCollection.features.length);

  return (
    <>
      <main className='strategic-map-print-page'>
        <button
          type='button'
          className='strategic-map-download-button'
          onClick={handleDownloadReport}
          disabled={isGeneratingPdf || !hasMapFeatures}
        >
          {isGeneratingPdf ? 'Gerando PDF...' : 'Baixar relat\u00f3rio'}
        </button>

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
              mapStyle={MAPBOX_STYLE}
              attributionControl={false}
              logoPosition='bottom-left'
              preserveDrawingBuffer={true}
              onLoad={() => setIsMapLoaded(true)}
            >
              <Source
                id={STRATEGIC_MAP_SOURCE_ID}
                type='geojson'
                data={strategicMapData!.featureCollection}
              >
                <Layer {...STRATEGIC_MAP_FILL_LAYER} />
                <Layer {...STRATEGIC_MAP_OUTLINE_LAYER} />
                <Layer {...STRATEGIC_MAP_LABELS_LAYER} />
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
              ÁREA CADASTRADA REPRESENTADA: {formatHectares(strategicMapData.totalHectares)} HA
            </div>
            <div className='strategic-map-legend-total'>
              ÁREA TOTAL APLICADA: {formatHectares(strategicMapData.totalAppliedHectares)} HA
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

        .strategic-map-download-button {
          position: absolute;
          top: 226px;
          left: 42px;
          z-index: 30;
          border: 1px solid rgba(17, 17, 17, 0.22);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
          color: #111111;
          cursor: pointer;
          font-size: 14px;
          font-weight: 900;
          line-height: 1;
          padding: 11px 14px;
          text-transform: uppercase;
        }

        .strategic-map-download-button:disabled {
          cursor: wait;
          opacity: 0.66;
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
          .strategic-map-download-button {
            display: none !important;
          }

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

function getStrategicMapSafePadding(
  width: number,
  height: number,
  mode: 'screen' | 'export'
): StrategicMapPadding {
  const proportionalPadding = {
    top: height * 0.18,
    right: width * 0.2,
    bottom: height * 0.3,
    left: width * 0.3,
  };

  if (mode === 'export') {
    return proportionalPadding;
  }

  return {
    top: Math.max(140, proportionalPadding.top),
    right: Math.max(360, proportionalPadding.right),
    bottom: Math.max(260, proportionalPadding.bottom),
    left: Math.max(420, proportionalPadding.left),
  };
}

function getStrategicMapExportPadding(exportPixelRatio: number): StrategicMapPadding {
  const padding = getStrategicMapSafePadding(EXPORT_WIDTH_PX, EXPORT_HEIGHT_PX, 'export');

  if (exportPixelRatio === 1) {
    return padding;
  }

  return {
    top: padding.top / exportPixelRatio,
    right: padding.right / exportPixelRatio,
    bottom: padding.bottom / exportPixelRatio,
    left: padding.left / exportPixelRatio,
  };
}

async function generateStrategicMapImageDataUrl(
  strategicMapData: StrategicMapData
): Promise<{ imageDataUrl: string; scaleBar: PdfScaleBar | null }> {
  if (!strategicMapData.bounds) {
    throw new Error('Strategic map bounds are not available.');
  }

  const restoreDevicePixelRatio = forceDevicePixelRatio(1);
  const exportPixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const exportWidthCssPx = EXPORT_WIDTH_PX / exportPixelRatio;
  const exportHeightCssPx = EXPORT_HEIGHT_PX / exportPixelRatio;
  const exportContainer = createExportMapContainer(exportWidthCssPx, exportHeightCssPx);
  let exportMap: mapboxgl.Map | null = null;

  document.body.appendChild(exportContainer);
  mapboxgl.accessToken = MAPBOX_TOKEN;

  try {
    exportMap = new mapboxgl.Map({
      accessToken: MAPBOX_TOKEN,
      container: exportContainer,
      style: MAPBOX_STYLE,
      center: [-51.9253, -14.235],
      zoom: 4,
      interactive: false,
      attributionControl: false,
      preserveDrawingBuffer: true,
      logoPosition: 'bottom-left',
      trackResize: false,
      fadeDuration: 0,
      failIfMajorPerformanceCaveat: false,
    });

    await waitForMapLoad(exportMap);
    addStrategicMapSourceAndLayers(exportMap, strategicMapData.featureCollection);
    exportMap.resize();
    exportMap.fitBounds(strategicMapData.bounds, {
      duration: 0,
      essential: true,
      maxZoom: 16,
      padding: getStrategicMapExportPadding(exportPixelRatio),
    });

    await waitForMapIdleAndTiles(exportMap);
    const scaleBar = buildPdfScaleBar(
      exportMap,
      exportWidthCssPx,
      exportHeightCssPx,
      exportPixelRatio
    );
    await delay(EXPORT_EXTRA_RENDER_DELAY_MS);

    const canvas = exportMap.getCanvas();
    const imageDataUrl = canvas.toDataURL('image/png');

    return { imageDataUrl, scaleBar };
  } finally {
    exportMap?.remove();
    exportContainer.remove();
    restoreDevicePixelRatio();
  }
}

function createExportMapContainer(widthCssPx: number, heightCssPx: number): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'strategic-map-export-container';
  container.setAttribute('aria-hidden', 'true');
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    left: `-${Math.ceil(widthCssPx) + 100}px`,
    zIndex: '-1',
    width: `${widthCssPx}px`,
    height: `${heightCssPx}px`,
    overflow: 'hidden',
    pointerEvents: 'none',
    opacity: '0.01',
    contain: 'layout size style paint',
  });

  return container;
}

function forceDevicePixelRatio(value: number): DevicePixelRatioRestore {
  const ownDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');

  try {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: () => value,
    });

    return () => {
      try {
        if (ownDescriptor) {
          Object.defineProperty(window, 'devicePixelRatio', ownDescriptor);
          return;
        }

        delete (window as unknown as { devicePixelRatio?: number }).devicePixelRatio;
      } catch {
        // Best-effort restore. The browser will keep its original DPR when overriding is blocked.
      }
    };
  } catch {
    return () => undefined;
  }
}

function addStrategicMapSourceAndLayers(
  map: mapboxgl.Map,
  featureCollection: FeatureCollection<DrawableGeometry>
): void {
  map.addSource(STRATEGIC_MAP_SOURCE_ID, {
    type: 'geojson',
    data: featureCollection,
  });

  map.addLayer(STRATEGIC_MAP_FILL_LAYER);
  map.addLayer(STRATEGIC_MAP_OUTLINE_LAYER);
  map.addLayer(STRATEGIC_MAP_LABELS_LAYER);
}

function waitForMapLoad(map: mapboxgl.Map): Promise<void> {
  if (map.loaded()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for the export map to load.'));
    }, EXPORT_TILE_WAIT_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      map.off('load', handleLoad);
      map.off('error', handleError);
    };

    const handleLoad = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error('The export map failed to load.'));
    };

    map.once('load', handleLoad);
    map.once('error', handleError);
  });
}

async function waitForMapIdleAndTiles(map: mapboxgl.Map): Promise<void> {
  const deadline = Date.now() + EXPORT_TILE_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (map.loaded() && map.areTilesLoaded()) {
      return;
    }

    await waitForMapIdle(map, Math.min(5000, Math.max(1000, deadline - Date.now())));
  }

  if (map.areTilesLoaded()) {
    return;
  }

  throw new Error('Timed out waiting for export map tiles.');
}

function waitForMapIdle(map: mapboxgl.Map, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      map.off('idle', handleIdle);
    };

    const handleIdle = () => {
      cleanup();
      resolve();
    };

    map.once('idle', handleIdle);
  });
}

function buildPdfScaleBar(
  map: mapboxgl.Map,
  exportWidthCssPx: number,
  exportHeightCssPx: number,
  exportPixelRatio: number
): PdfScaleBar | null {
  const maxWidthCssPx = 880;
  const maxWidthMapPx = cssPxToExportPxX(maxWidthCssPx) / exportPixelRatio;
  const y = exportHeightCssPx - cssPxToExportPxY(140) / exportPixelRatio;
  const x1 = exportWidthCssPx / 2 - maxWidthMapPx / 2;
  const x2 = exportWidthCssPx / 2 + maxWidthMapPx / 2;
  const left = map.unproject([x1, y]);
  const right = map.unproject([x2, y]);
  const maxMeters = left.distanceTo(right);

  if (!Number.isFinite(maxMeters) || maxMeters <= 0) {
    return null;
  }

  const niceMeters = getNiceScaleMeters(maxMeters);
  const widthCssPx = Math.max(80, maxWidthCssPx * (niceMeters / maxMeters));

  return {
    label: formatScaleDistance(niceMeters),
    widthCssPx,
  };
}

function getNiceScaleMeters(maxMeters: number): number {
  const unit = Math.pow(10, Math.floor(Math.log10(maxMeters)));
  const multipliers = [1, 2, 3, 5, 10];

  for (let index = multipliers.length - 1; index >= 0; index -= 1) {
    const candidate = multipliers[index] * unit;
    if (candidate <= maxMeters) {
      return candidate;
    }
  }

  return unit;
}

function formatScaleDistance(meters: number): string {
  if (meters >= 1000) {
    const kilometers = meters / 1000;
    return `${Number.isInteger(kilometers) ? kilometers.toFixed(0) : kilometers.toFixed(1)} km`;
  }

  return `${Math.round(meters)} m`;
}

async function drawStrategicMapPdfOverlays(
  pdf: JsPdf,
  params: {
    title: string;
    generatedAt: string;
    farms: FarmLegendItem[];
    totalHectares: number;
    totalAppliedHectares: number;
    scaleBar: PdfScaleBar | null;
  }
): Promise<void> {
  drawPdfTitle(pdf, params.title);
  drawPdfGeneratedAt(pdf, params.generatedAt);
  await drawPdfNorthArrow(pdf);
  drawPdfLegend(pdf, params.farms, params.totalHectares, params.totalAppliedHectares);
  drawPdfScaleBar(pdf, params.scaleBar);
  await drawPdfLogo(pdf);
}

function drawPdfTitle(pdf: JsPdf, title: string): void {
  const maxWidth = PDF_WIDTH_MM - cssPxToMm(1800);
  const fontSize = fitPdfFontSize(pdf, title, maxWidth, cssPxToPt(100), cssPxToPt(62));

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(0, 0, 0);
  pdf.text(title, PDF_WIDTH_MM / 2, cssPxToMm(50), {
    align: 'center',
    baseline: 'top',
    maxWidth,
  });
}

function drawPdfGeneratedAt(pdf: JsPdf, generatedAt: string): void {
  const fontSize = cssPxToPt(56);
  const paddingX = cssPxToMm(48);
  const paddingY = cssPxToMm(24);
  const borderWidth = cssPxToMm(8);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(borderWidth);

  const textWidth = pdf.getTextWidth(generatedAt);
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = ptToMm(fontSize) + paddingY * 2;
  const x = PDF_WIDTH_MM - cssPxToMm(100) - boxWidth;
  const y = cssPxToMm(100);

  pdf.rect(x, y, boxWidth, boxHeight);
  pdf.text(generatedAt, x + paddingX, y + paddingY, {
    baseline: 'top',
  });
}

async function drawPdfNorthArrow(pdf: JsPdf): Promise<void> {
  const imageDataUrl = await createNorthArrowDataUrl();
  pdf.addImage(
    imageDataUrl,
    'PNG',
    cssPxToMm(100),
    cssPxToMm(100),
    cssPxToMm(600),
    cssPxToMm(600),
    undefined,
    'NONE'
  );
}

function drawPdfLegend(
  pdf: JsPdf,
  farms: FarmLegendItem[],
  totalHectares: number,
  totalAppliedHectares: number
): void {
  const x = cssPxToMm(100);
  const legendHeightCss =
    56 + 32 + farms.length * 60 + Math.max(0, farms.length - 1) * 24 + 48 + 32 + 8 + 56;
  let y = PDF_HEIGHT_MM - cssPxToMm(100 + legendHeightCss);

  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(cssPxToPt(56));
  pdf.text('LEGENDA', x, y, { baseline: 'top' });

  y += cssPxToMm(56 + 32);

  farms.forEach((farm, index) => {
    if (index > 0) {
      y += cssPxToMm(24);
    }

    const swatchSize = cssPxToMm(60);
    const itemTop = y;

    pdf.setFillColor(farm.fill);
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(cssPxToMm(4));
    pdf.rect(x, itemTop, swatchSize, swatchSize, 'FD');

    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(cssPxToPt(48));
    pdf.text(
      `${farm.name} (${formatHectares(farm.hectares)} ha)`,
      x + swatchSize + cssPxToMm(40),
      itemTop + swatchSize / 2,
      {
        baseline: 'middle',
        maxWidth: cssPxToMm(1500),
      }
    );

    y += cssPxToMm(60);
  });

  y += cssPxToMm(48);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(cssPxToMm(8));
  pdf.line(x, y, x + cssPxToMm(720), y);
  y += cssPxToMm(32);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(cssPxToPt(56));
  pdf.setTextColor(0, 0, 0);
  pdf.text(`ÁREA CADASTRADA REPRESENTADA: ${formatHectares(totalHectares)} HA`, x, y, {
    baseline: 'top',
  });
  y += cssPxToMm(72);
  pdf.text(`ÁREA TOTAL APLICADA: ${formatHectares(totalAppliedHectares)} HA`, x, y, {
    baseline: 'top',
  });
}

function drawPdfScaleBar(pdf: JsPdf, scaleBar: PdfScaleBar | null): void {
  if (!scaleBar) {
    return;
  }

  const width = cssPxToMm(scaleBar.widthCssPx);
  const x = PDF_WIDTH_MM / 2 - width / 2;
  const y = PDF_HEIGHT_MM - cssPxToMm(100);
  const height = cssPxToMm(40);
  const lineWidth = cssPxToMm(8);

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(lineWidth);
  pdf.rect(x, y - height, width, height, 'F');
  pdf.line(x, y, x + width, y);
  pdf.line(x, y, x, y - cssPxToMm(18));
  pdf.line(x + width, y, x + width, y - cssPxToMm(18));

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(cssPxToPt(56));
  pdf.setTextColor(0, 0, 0);
  pdf.text(scaleBar.label, x + width / 2, y - height + cssPxToMm(4), {
    align: 'center',
    baseline: 'top',
  });
}

async function drawPdfLogo(pdf: JsPdf): Promise<void> {
  const image = await loadImage(LOGO_SRC);
  const width = cssPxToMm(900);
  const height = width * (image.naturalHeight / Math.max(1, image.naturalWidth));

  pdf.addImage(
    image,
    'PNG',
    PDF_WIDTH_MM - cssPxToMm(100) - width,
    PDF_HEIGHT_MM - cssPxToMm(100) - height,
    width,
    height,
    undefined,
    'NONE'
  );
}

async function createNorthArrowDataUrl(): Promise<string> {
  const svg = `<svg viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg"><g><path d="M70,70 L95,45 L70,70" stroke="black" stroke-width="0.5"/><path d="M70,70 L95,95 L70,70" stroke="black" stroke-width="0.5"/><path d="M70,70 L45,95 L70,70" stroke="black" stroke-width="0.5"/><path d="M70,70 L45,45 L70,70" stroke="black" stroke-width="0.5"/><path d="M70,70 L95,45 L75,65 Z" fill="black"/><path d="M70,70 L95,45 L85,70 Z" fill="white" stroke="black" stroke-width="0.5"/><path d="M70,70 L95,95 L85,70 Z" fill="black"/><path d="M70,70 L95,95 L75,85 Z" fill="white" stroke="black" stroke-width="0.5"/><path d="M70,70 L45,95 L65,85 Z" fill="black"/><path d="M70,70 L45,95 L55,70 Z" fill="white" stroke="black" stroke-width="0.5"/><path d="M70,70 L45,45 L55,70 Z" fill="black"/><path d="M70,70 L45,45 L65,55 Z" fill="white" stroke="black" stroke-width="0.5"/><path d="M70,70 L70,15 L60,60 Z" fill="white" stroke="black" stroke-width="0.5"/><path d="M70,70 L70,15 L80,60 Z" fill="black" stroke="black" stroke-width="0.5"/><path d="M70,70 L125,70 L80,60 Z" fill="white" stroke="black" stroke-width="0.5"/><path d="M70,70 L125,70 L80,80 Z" fill="black" stroke="black" stroke-width="0.5"/><path d="M70,70 L70,125 L60,80 Z" fill="black" stroke="black" stroke-width="0.5"/><path d="M70,70 L70,125 L80,80 Z" fill="white" stroke="black" stroke-width="0.5"/><path d="M70,70 L15,70 L60,60 Z" fill="black" stroke="black" stroke-width="0.5"/><path d="M70,70 L15,70 L60,80 Z" fill="white" stroke="black" stroke-width="0.5"/><text x="70" y="12" text-anchor="middle" font-family="Times New Roman, serif" font-weight="bold" font-size="16" fill="black">N</text><text x="70" y="138" text-anchor="middle" font-family="Times New Roman, serif" font-weight="bold" font-size="16" fill="black">S</text><text x="6" y="75" text-anchor="middle" font-family="Times New Roman, serif" font-weight="bold" font-size="16" fill="black">W</text><text x="134" y="75" text-anchor="middle" font-family="Times New Roman, serif" font-weight="bold" font-size="16" fill="black">O</text></g></svg>`;
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const canvas = document.createElement('canvas');
  const size = 1800;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create north arrow canvas.');
  }

  context.drawImage(image, 0, 0, size, size);
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${src}`));
    image.src = src;
  });
}

function fitPdfFontSize(
  pdf: JsPdf,
  text: string,
  maxWidthMm: number,
  initialFontSizePt: number,
  minFontSizePt: number
): number {
  let fontSize = initialFontSizePt;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(fontSize);

  while (fontSize > minFontSizePt && pdf.getTextWidth(text) > maxWidthMm) {
    fontSize -= 1;
    pdf.setFontSize(fontSize);
  }

  return fontSize;
}

function cssPxToMm(value: number): number {
  return value * CSS_PX_TO_MM;
}

function cssPxToPt(value: number): number {
  return value * CSS_PX_TO_PT;
}

function ptToMm(value: number): number {
  return (value * 25.4) / 72;
}

function cssPxToExportPxX(value: number): number {
  return value * EXPORT_PX_PER_CSS_PX_X;
}

function cssPxToExportPxY(value: number): number {
  return value * EXPORT_PX_PER_CSS_PX_Y;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function sanitizeFilePart(value: string | number): string {
  const sanitized = String(value)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-');

  return sanitized || 'sem-numero';
}

function parseOptionalHectares(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = parseHectares(value as Plot['hectare']);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildStrategicMapData(serviceOrder: ServiceOrder): StrategicMapData {
  const farmsById = buildFarmMap(serviceOrder.farms || []);
  const farmSummaries = new Map<string, Omit<FarmLegendItem, 'fill'>>();
  const drafts: PlotFeatureDraft[] = [];
  const totalAppliedHectares =
    parseOptionalHectares(serviceOrder.grossAppliedAreaHa) ??
    parseOptionalHectares(serviceOrder.totalAppliedHectares) ??
    0;

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
    totalAppliedHectares,
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
