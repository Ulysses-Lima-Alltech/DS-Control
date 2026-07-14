'use client';

/**
 * Espelho em HTML/React do layout do ApplicationsReportPDF.tsx.
 * Reproduz visualmente o relatório para análise e aprovação sem depender da renderização em PDF.
 * NÃO altera o fluxo do PDF nem substitui o arquivo real.
 */

import type { Application } from '@/types/applications.type';
import type { ServiceOrder } from '@/types/service-order.type';
import { formatApplicationDate } from '@/utils/application-date-formatter';
import {
  APPLICATIONS_REPORT_SCOPES,
  buildApplicationsReportData,
  formatReportHectares,
  parseReportArea,
  REPORT_AREA_CRITERIA,
  type ApplicationsReportScope,
  type ReportAreaCriterion,
} from '@/utils/applicationsReportArea';
import { formatOperationalDateBR } from '@/utils/operational-date';
import { buildPlotPolygonSvgOverlay, buildPlotReportLabel } from '@/utils/reportPlotPolygonSvg';

interface ApplicationsReportLayoutMirrorProps {
  serviceOrder: ServiceOrder;
  applications: Application[];
  areaCriterion?: ReportAreaCriterion;
  scope?: ApplicationsReportScope;
}

const formatNumber = (value: number) =>
  value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatRegisteredAreaCoverage = (
  applicationHectares: string,
  plotHectares: string
): string | null => {
  const appliedArea = parseFloat(applicationHectares);
  const registeredPlotArea = parseFloat(plotHectares);

  if (
    !Number.isFinite(appliedArea) ||
    !Number.isFinite(registeredPlotArea) ||
    registeredPlotArea <= 0
  ) {
    return null;
  }

  return `${formatNumber((appliedArea / registeredPlotArea) * 100)}%`;
};

export function ApplicationsReportLayoutMirror({
  serviceOrder,
  applications,
  areaCriterion = 'applied-registered',
  scope = 'all',
}: ApplicationsReportLayoutMirrorProps) {
  const reportData = buildApplicationsReportData({
    serviceOrder,
    applications,
    areaCriterion,
    scope,
  });
  const reportApplications = reportData.applications;
  const criterionMetadata = REPORT_AREA_CRITERIA[areaCriterion];
  const scopeMetadata = APPLICATIONS_REPORT_SCOPES[scope];

  const farmMap = new Map<string, string>();
  if (serviceOrder.farms?.length) {
    serviceOrder.farms.forEach((farm) => {
      farm.plots?.forEach((plot) => {
        if (plot.id) farmMap.set(plot.id, farm.name);
      });
    });
  }

  const generatedDateTime = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const averageFlowRate =
    reportApplications.length > 0
      ? reportApplications.reduce((sum, app) => sum + parseReportArea(app.flowRate), 0) /
        reportApplications.length
      : 0;
  const averageAltitude =
    reportApplications.length > 0
      ? reportApplications.reduce((sum, app) => sum + parseReportArea(app.altitude), 0) /
        reportApplications.length
      : 0;
  const averageRouteSpacing =
    reportApplications.length > 0
      ? reportApplications.reduce((sum, app) => sum + parseReportArea(app.routeSpacing), 0) /
        reportApplications.length
      : 0;
  const averageDropletSize =
    reportApplications.length > 0
      ? reportApplications.reduce((sum, app) => sum + parseReportArea(app.dropletSize), 0) /
        reportApplications.length
      : 0;

  return (
    <div className='bg-white font-sans text-[10px] text-[#1F2937] max-w-[595px] mx-auto'>
      {/* ========== CAPA ========== */}
      <div className='p-10 flex flex-col items-center bg-white min-h-[842px] box-border'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src='/images/pdf-logo-complete.png'
          alt='Logo IControl'
          width={300}
          height={100}
          className='mb-7 object-contain'
        />
        <h1 className='text-2xl font-bold mb-2.5 text-center'>DS Drones Agrícolas LTDA</h1>
        <p className='text-base font-medium mb-2 text-center text-[#6B7280]'>
          Relatório de Aplicações — {criterionMetadata.label}
        </p>
        <p className='mb-2 text-[10px] text-[#6B7280]'>Escopo: {scopeMetadata.label}</p>
        <p className='text-xs text-center mb-10 leading-relaxed'>
          54.134.198/0001-25
          <br />
          Imperatriz - MA
          <br />
          +55 99 9174-5656
        </p>

        {/* Identificação da Ordem de Serviço */}
        <div className='w-full mt-5 p-5 border border-[#E5E7EB] rounded-lg'>
          <h2 className='text-sm font-bold mb-4 text-[#1F2937]'>
            Identificação da Ordem de Serviço
          </h2>
          <div className='flex mb-2'>
            <span className='text-[10px] font-bold w-[40%] text-[#6B7280]'>Número da OS:</span>
            <span className='text-[10px] w-[60%]'>#{serviceOrder.number}</span>
          </div>
          <div className='flex mb-2'>
            <span className='text-[10px] font-bold w-[40%] text-[#6B7280]'>Cliente:</span>
            <span className='text-[10px] w-[60%]'>{serviceOrder.customer?.name || 'N/A'}</span>
          </div>
          <div className='flex mb-2'>
            <span className='text-[10px] font-bold w-[40%] text-[#6B7280]'>Contrato:</span>
            <span className='text-[10px] w-[60%]'>{serviceOrder.contract?.name || 'N/A'}</span>
          </div>
          <div className='flex mb-2'>
            <span className='text-[10px] font-bold w-[40%] text-[#6B7280]'>
              Data Planejada da OS:
            </span>
            <span className='text-[10px] w-[60%]'>
              {formatOperationalDateBR(serviceOrder.plannedDate)}
            </span>
          </div>
          {serviceOrder.farms?.length ? (
            <div className='flex mb-2'>
              <span className='text-[10px] font-bold w-[40%] text-[#6B7280]'>
                Fazendas Vinculadas:
              </span>
              <div className='w-[60%] flex flex-wrap gap-1'>
                {serviceOrder.farms.map((farm) => (
                  <span
                    key={farm.id}
                    className='bg-[#FFF3CD] text-[#EAAE07] px-1.5 py-0.5 rounded text-[8px]'
                  >
                    {farm.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {serviceOrder.pilots?.length ? (
            <div className='flex mb-2'>
              <span className='text-[10px] font-bold w-[40%] text-[#6B7280]'>
                Pilotos Vinculados:
              </span>
              <div className='w-[60%] flex flex-wrap gap-1'>
                {serviceOrder.pilots.map((p) => (
                  <span
                    key={p.id}
                    className='bg-[#FFF3CD] text-[#EAAE07] px-1.5 py-0.5 rounded text-[8px]'
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {serviceOrder.observation ? (
            <div className='flex mb-2'>
              <span className='text-[10px] font-bold w-[40%] text-[#6B7280]'>
                Observação da OS:
              </span>
              <span className='text-[10px] w-[60%]'>{serviceOrder.observation}</span>
            </div>
          ) : null}
        </div>

        {/* Resumo do relatório */}
        <div className='w-full mt-7 p-5 border border-[#E5E7EB] rounded-lg'>
          <h2 className='text-sm font-bold mb-4 text-[#1F2937]'>Resumo do Relatório</h2>
          <p className='text-[8px] text-[#6B7280] -mt-2 mb-3'>
            Critério selecionado: {criterionMetadata.label}. Escopo: {scopeMetadata.label}.
          </p>
          <div className='grid grid-cols-3 gap-2 mb-3'>
            <div className='bg-[#F9FAFB] p-2.5 rounded border border-[#E5E7EB]'>
              <p className='text-[9px] font-bold text-[#6B7280]'>
                {criterionMetadata.summaryLabel}
              </p>
              <p className='text-sm font-bold text-[#1F2937] mt-1'>
                {formatReportHectares(reportData.totalArea)}
              </p>
              <p className='text-[7px] leading-snug text-[#6B7280] mt-1'>
                Valor principal calculado para o critério e o escopo selecionados.
              </p>
            </div>
            <div className='bg-[#FFF3CD] p-2.5 rounded border-2 border-[#EAAE07]'>
              <p className='text-[9px] font-bold text-[#6B7280]'>Critério</p>
              <p className='text-[10px] leading-tight font-bold text-[#EAAE07] mt-1'>
                {criterionMetadata.summaryCriterion}
              </p>
              <p className='text-[7px] leading-snug text-[#6B7280] mt-1'>
                {criterionMetadata.shortDescription}
              </p>
            </div>
            <div className='bg-[#FFFBEB] p-2.5 rounded border border-[#EAAE07]'>
              <p className='text-[9px] font-bold text-[#6B7280]'>{criterionMetadata.countLabel}</p>
              <p className='text-sm font-bold text-[#EAAE07] mt-1'>
                {areaCriterion === 'plot-total'
                  ? reportData.distinctPlotCount
                  : reportData.distinctApplicationCount}
              </p>
              <p className='text-[7px] leading-snug text-[#6B7280] mt-1'>
                Contagem distinta no recorte selecionado.
              </p>
            </div>
          </div>
          <div className='mb-2.5 rounded bg-[#F9FAFB] p-2 text-[8px] leading-snug text-[#6B7280]'>
            {criterionMetadata.operationalNote}
          </div>
          {areaCriterion === 'applied-registered' &&
          scope === 'pending' &&
          !reportData.hasAppliedArea ? (
            <div className='mb-2.5 rounded border border-[#FDE68A] bg-[#FFFBEB] p-2 text-[9px] font-bold text-[#92400E]'>
              Não há área aplicada registrada para os talhões pendentes.
            </div>
          ) : null}
          {reportApplications.length > 0 ? (
            <>
              <div className='flex mb-2'>
                <span className='text-[10px] font-bold w-1/2 text-[#6B7280]'>
                  Taxa de Aplicação Média:
                </span>
                <span className='text-[10px] w-1/2'>{formatNumber(averageFlowRate)} L/ha</span>
              </div>
              <div className='flex mb-2'>
                <span className='text-[10px] font-bold w-1/2 text-[#6B7280]'>
                  Altitude Média de Voo:
                </span>
                <span className='text-[10px] w-1/2'>{formatNumber(averageAltitude)} m</span>
              </div>
              <div className='flex mb-2'>
                <span className='text-[10px] font-bold w-1/2 text-[#6B7280]'>
                  Espaçamento Médio entre Rotas:
                </span>
                <span className='text-[10px] w-1/2'>{formatNumber(averageRouteSpacing)} m</span>
              </div>
              <div className='flex mb-2'>
                <span className='text-[10px] font-bold w-1/2 text-[#6B7280]'>
                  Tamanho Médio de Gota:
                </span>
                <span className='text-[10px] w-1/2'>{formatNumber(averageDropletSize)} µm</span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ========== PÁGINAS POR TALHÃO ========== */}
      {reportData.plotEntries.map((plotEntry, plotIndex) => {
        const { plot, applications: plotApplications, consideredArea } = plotEntry;
        const plotId = plot.id!;
        const mapWidth = 1280;
        const mapHeight = 480;
        const plotPolygonOverlay = buildPlotPolygonSvgOverlay(plot, mapWidth, mapHeight);
        const plotLabel = buildPlotReportLabel(plot);

        return (
          <div key={plotId} className='p-8 min-h-[842px] box-border border-t border-[#E5E7EB]'>
            {/* Header da página */}
            <div className='flex justify-between items-center mb-5 pb-2.5 border-b-2 border-[#EAAE07]'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src='/images/pdf-logo-only.png'
                alt='Logo'
                width={120}
                height={30}
                className='object-contain'
              />
              <div className='text-right'>
                <p className='text-[10px] text-[#6B7280]'>Página {plotIndex + 1}</p>
                <p className='text-[8px] text-[#9CA3AF] mt-0.5'>Gerado em: {generatedDateTime}</p>
              </div>
            </div>

            {/* Área do mapa (espelho geométrico do overlay usado no PDF) */}
            <div
              id={`plot-map-${plotId}`}
              className={`${plotApplications.length > 1 ? 'h-[120px]' : 'h-[200px]'} relative w-full mb-5 overflow-hidden border border-[#E5E7EB] bg-[#F3F4F6] rounded`}
            >
              {plotPolygonOverlay ? (
                <svg
                  className='absolute inset-0 h-full w-full'
                  viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                  preserveAspectRatio='none'
                  aria-label={`${plotLabel.title}, ${plotLabel.area}`}
                >
                  {plotPolygonOverlay.paths.map((path, index) => (
                    <path
                      key={`plot-poly-${plotId}-${index}`}
                      d={path}
                      fill='#3388ff'
                      fillOpacity='0.35'
                      fillRule='evenodd'
                      stroke='#1d4ed8'
                      strokeWidth='2'
                    />
                  ))}
                  <text
                    x={plotPolygonOverlay.labelPoint.x}
                    y={plotPolygonOverlay.labelPoint.y - 10}
                    textAnchor='middle'
                    dominantBaseline='middle'
                    fill='#FFFFFF'
                    stroke='#111827'
                    strokeOpacity='0.8'
                    strokeWidth='6'
                    strokeLinejoin='round'
                    paintOrder='stroke'
                    className='font-bold'
                    fontSize='32'
                  >
                    {plotLabel.title}
                  </text>
                  <text
                    x={plotPolygonOverlay.labelPoint.x}
                    y={plotPolygonOverlay.labelPoint.y + 28}
                    textAnchor='middle'
                    dominantBaseline='middle'
                    fill='#FFFFFF'
                    stroke='#111827'
                    strokeOpacity='0.8'
                    strokeWidth='5'
                    strokeLinejoin='round'
                    paintOrder='stroke'
                    className='font-bold'
                    fontSize='27'
                  >
                    {plotLabel.area}
                  </text>
                </svg>
              ) : (
                <span className='flex h-full items-center justify-center text-sm font-medium text-[#6B7280]'>
                  Mapa não disponível (placeholder no espelho HTML)
                </span>
              )}
            </div>

            {/* Bloco do talhão */}
            <div className='bg-[#F9FAFB] p-4 rounded-lg mb-4 border border-[#E5E7EB]'>
              <h3 className='text-sm font-bold mb-2.5 text-[#EAAE07]'>Talhão: {plot.name}</h3>
              <div className='flex mb-1.5'>
                <span className='text-[9px] font-bold w-[40%] text-[#6B7280]'>
                  Fazenda do Talhão:
                </span>
                <span className='text-[9px] w-[60%]'>{farmMap.get(plotId) || 'N/A'}</span>
              </div>
              <div className='flex mb-1.5'>
                <span className='text-[9px] font-bold w-[40%] text-[#6B7280]'>
                  Área considerada no relatório:
                </span>
                <span className='text-[9px] w-[60%]'>
                  {formatReportHectares(consideredArea)}
                  <small className='block text-[7px] text-[#9CA3AF] mt-0.5'>
                    {criterionMetadata.shortDescription}
                  </small>
                </span>
              </div>
              <div className='flex mb-1.5'>
                <span className='text-[9px] font-bold w-[40%] text-[#6B7280]'>
                  Quantidade de Aplicações:
                </span>
                <span className='text-[9px] w-[60%]'>{plotApplications.length}</span>
              </div>
            </div>

            {/* Lista de aplicações */}
            {plotApplications.length === 0 ? (
              <div className='rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[9px] font-bold text-[#92400E]'>
                Não há área aplicada registrada para este talhão pendente.
              </div>
            ) : null}
            {plotApplications.map((application) => {
              const registeredAreaCoverage = formatRegisteredAreaCoverage(
                application.hectares,
                plot.hectare
              );

              return (
                <div
                  key={application.id}
                  className='bg-white p-3 rounded-lg mb-2.5 border border-[#E5E7EB]'
                >
                  <div className='flex justify-between mb-2.5 pb-2 border-b border-[#E5E7EB]'>
                    <span className='text-xs font-bold text-[#EAAE07]'>
                      Produto Aplicado: {application.product?.name || 'N/A'}
                    </span>
                    <span className='text-[10px] text-[#6B7280]'>
                      Data da Aplicação: {formatApplicationDate(application.date)}
                    </span>
                  </div>
                  <div className='flex flex-wrap gap-x-4 gap-y-1'>
                    <div className='flex'>
                      <span className='text-[8px] font-bold text-[#6B7280] mr-1'>
                        Piloto Responsável:
                      </span>
                      <span className='text-[8px]'>{application.pilot?.name || 'N/A'}</span>
                    </div>
                    <div className='flex'>
                      <span className='text-[8px] font-bold text-[#6B7280] mr-1'>
                        Assistente Responsável:
                      </span>
                      <span className='text-[8px]'>{application.assistant?.name || 'N/A'}</span>
                    </div>
                    <div className='flex'>
                      <span className='text-[8px] font-bold text-[#6B7280] mr-1'>
                        Drone Utilizado:
                      </span>
                      <span className='text-[8px]'>
                        {application.drone?.name || 'N/A'} - {application.drone?.model || 'N/A'}
                      </span>
                    </div>
                    <div className='flex'>
                      <span className='text-[8px] font-bold text-[#6B7280] mr-1'>Cultura:</span>
                      <span className='text-[8px]'>{application.culture?.name || 'N/A'}</span>
                    </div>
                    <div className='flex'>
                      <span className='text-[8px] font-bold text-[#6B7280] mr-1'>
                        Área Aplicada:
                      </span>
                      <span className='text-[8px]'>
                        {formatReportHectares(application.hectares)}
                        <small className='block text-[7px] text-[#9CA3AF]'>
                          Área informada nesta aplicação.
                        </small>
                      </span>
                    </div>
                    {registeredAreaCoverage ? (
                      <div className='w-[calc(50%_-_0.5rem)] min-w-0 rounded border border-[#FDE68A] bg-[#FFFBEB] p-2'>
                        <p className='text-[8px] font-bold text-[#6B7280]'>
                          Cobertura desta Aplicação
                        </p>
                        <p className='mt-1 text-[11px] font-bold text-[#EAAE07]'>
                          {registeredAreaCoverage}
                        </p>
                        <p className='mt-1 text-[7px] leading-snug text-[#6B7280]'>
                          Relação entre a área aplicada nesta operação e a área cadastrada do
                          talhão.
                        </p>
                      </div>
                    ) : null}
                    <div className='flex'>
                      <span className='text-[8px] font-bold text-[#6B7280] mr-1'>
                        Taxa de Aplicação:
                      </span>
                      <span className='text-[8px]'>
                        {formatNumber(parseFloat(application.flowRate))} L/ha
                      </span>
                    </div>
                    <div className='flex'>
                      <span className='text-[8px] font-bold text-[#6B7280] mr-1'>
                        Altitude de Voo:
                      </span>
                      <span className='text-[8px]'>
                        {formatNumber(parseFloat(application.altitude))} m
                      </span>
                    </div>
                    <div className='flex'>
                      <span className='text-[8px] font-bold text-[#6B7280] mr-1'>
                        Espaçamento entre Rotas:
                      </span>
                      <span className='text-[8px]'>
                        {formatNumber(parseFloat(application.routeSpacing))} m
                      </span>
                    </div>
                    <div className='flex'>
                      <span className='text-[8px] font-bold text-[#6B7280] mr-1'>
                        Tamanho de Gota:
                      </span>
                      <span className='text-[8px]'>
                        {formatNumber(parseFloat(application.dropletSize))} µm
                      </span>
                    </div>
                  </div>
                  {application.observations ? (
                    <div className='mt-1.5 w-full'>
                      <span className='text-[8px] font-bold text-[#6B7280]'>
                        Observações da Aplicação:{' '}
                      </span>
                      <span className='text-[8px]'>{application.observations}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
