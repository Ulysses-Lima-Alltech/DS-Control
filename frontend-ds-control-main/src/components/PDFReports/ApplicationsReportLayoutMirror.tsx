'use client';

/**
 * Espelho em HTML/React do layout do ApplicationsReportPDF.tsx.
 * Reproduz visualmente o relatório para análise e aprovação sem depender da renderização em PDF.
 * NÃO altera o fluxo do PDF nem substitui o arquivo real.
 */

import type { Application } from '@/types/applications.type';
import type { ServiceOrder } from '@/types/service-order.type';
import { formatApplicationDate } from '@/utils/application-date-formatter';
import { formatOperationalDateBR } from '@/utils/operational-date';
import { buildPlotPolygonSvgOverlay, buildPlotReportLabel } from '@/utils/reportPlotPolygonSvg';

interface ApplicationsReportLayoutMirrorProps {
  serviceOrder: ServiceOrder;
  applications: Application[];
  mode?: 'operational' | 'completedPlannedArea';
  completedPlotIds?: string[];
}

const formatHectares = (hectares: string) => {
  return `${parseFloat(hectares).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
};

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
  mode = 'operational',
  completedPlotIds = [],
}: ApplicationsReportLayoutMirrorProps) {
  const isCompletedPlannedArea = mode === 'completedPlannedArea';
  const applicationsWithPlot = applications.filter((app) => app.plotId !== null);
  const applicationsByPlot = applicationsWithPlot.reduce(
    (acc, app) => {
      const plotId = app.plotId!;
      if (!acc[plotId]) acc[plotId] = [];
      acc[plotId].push(app);
      return acc;
    },
    {} as Record<string, Application[]>
  );

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

  const totalHectares = applications.reduce((sum, app) => sum + parseFloat(app.hectares), 0);
  const plannedHectares = Number(serviceOrder.plannedHectares) || 0;
  const serviceOrderProgress = Number(serviceOrder.progressPercent) || 0;
  const completedIds = new Set(completedPlotIds);
  const completedPlotsById = new Map(
    (serviceOrder.plots || [])
      .filter((plot) => Boolean(plot.id && completedIds.has(plot.id)))
      .map((plot) => [plot.id!, plot])
  );
  Object.values(applicationsByPlot).forEach((plotApplications) => {
    const plot = plotApplications[0]?.plot;
    if (plot?.id && completedIds.has(plot.id)) completedPlotsById.set(plot.id, plot);
  });
  const completedPlannedHectares = Array.from(completedPlotsById.values()).reduce(
    (total, plot) => total + (Number.parseFloat(plot.hectare) || 0),
    0
  );
  const reportPlannedHectares = isCompletedPlannedArea ? completedPlannedHectares : plannedHectares;
  const reportProgress = isCompletedPlannedArea ? 100 : serviceOrderProgress;
  const averageFlowRate =
    applications.length > 0
      ? applications.reduce((sum, app) => sum + parseFloat(app.flowRate), 0) / applications.length
      : 0;
  const averageAltitude =
    applications.length > 0
      ? applications.reduce((sum, app) => sum + parseFloat(app.altitude), 0) / applications.length
      : 0;
  const averageRouteSpacing =
    applications.length > 0
      ? applications.reduce((sum, app) => sum + parseFloat(app.routeSpacing), 0) /
        applications.length
      : 0;
  const averageDropletSize =
    applications.length > 0
      ? applications.reduce((sum, app) => sum + parseFloat(app.dropletSize), 0) /
        applications.length
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
          {isCompletedPlannedArea ? 'Relatório de Área Total Concluída' : 'Relatório de Aplicações'}
        </p>
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

        {/* Resumo das Aplicações */}
        <div className='w-full mt-7 p-5 border border-[#E5E7EB] rounded-lg'>
          <h2 className='text-sm font-bold mb-4 text-[#1F2937]'>
            {isCompletedPlannedArea ? 'Resumo da Área Total Concluída' : 'Resumo das Aplicações'}
          </h2>
          <p className='text-[8px] text-[#6B7280] -mt-2 mb-3'>
            {isCompletedPlannedArea
              ? 'Este relatório considera integralmente concluída a área cadastrada dos talhões classificados como concluídos.'
              : 'Indicadores calculados a partir das aplicações incluídas neste relatório.'}
          </p>
          <div className='grid grid-cols-3 gap-2 mb-3'>
            <div className='bg-[#F9FAFB] p-2.5 rounded border border-[#E5E7EB]'>
              <p className='text-[9px] font-bold text-[#6B7280]'>
                {isCompletedPlannedArea ? 'Área Total Concluída' : 'Área Total Planejada da OS'}
              </p>
              <p className='text-sm font-bold text-[#1F2937] mt-1'>
                {formatHectares(String(reportPlannedHectares))}
              </p>
              <p className='text-[7px] leading-snug text-[#6B7280] mt-1'>
                {isCompletedPlannedArea
                  ? 'Soma das áreas cadastradas dos talhões classificados como concluídos.'
                  : 'Soma das áreas cadastradas dos mapas vinculados à Ordem de Serviço.'}
              </p>
            </div>
            <div className='bg-[#FFF3CD] p-2.5 rounded border-2 border-[#EAAE07]'>
              <p className='text-[9px] font-bold text-[#6B7280]'>
                {isCompletedPlannedArea ? 'Talhões Concluídos' : 'Área Total Aplicada'}
              </p>
              <p className='text-sm font-bold text-[#EAAE07] mt-1'>
                {isCompletedPlannedArea
                  ? completedPlotsById.size
                  : formatHectares(String(totalHectares))}
              </p>
              <p className='text-[7px] leading-snug text-[#6B7280] mt-1'>
                {isCompletedPlannedArea
                  ? 'Quantidade de talhões incluídos neste relatório.'
                  : 'Soma das áreas informadas nas aplicações incluídas neste relatório.'}
              </p>
            </div>
            <div className='bg-[#FFFBEB] p-2.5 rounded border border-[#EAAE07]'>
              <p className='text-[9px] font-bold text-[#6B7280]'>
                {isCompletedPlannedArea ? 'Progresso' : 'Progresso da OS'}
              </p>
              <p className='text-sm font-bold text-[#EAAE07] mt-1'>
                {formatNumber(reportProgress)}%
              </p>
              <p className='text-[7px] leading-snug text-[#6B7280] mt-1'>
                {isCompletedPlannedArea
                  ? 'Os talhões deste relatório estão classificados como integralmente concluídos.'
                  : 'Relação entre a área total aplicada e a área total planejada da Ordem de Serviço.'}
              </p>
            </div>
          </div>
          {isCompletedPlannedArea ? (
            <>
              <div className='flex mb-2'>
                <span className='text-[10px] font-bold w-1/2 text-[#6B7280]'>
                  Aplicações Realizadas:
                </span>
                <span className='text-[10px] w-1/2'>{applications.length}</span>
              </div>
            </>
          ) : null}
          {!isCompletedPlannedArea ? (
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
      {Object.entries(applicationsByPlot).map(([plotId, plotApplications], plotIndex) => {
        const firstApp = plotApplications[0];
        const plot = firstApp.plot;
        if (!plot) return null;
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
                <span className='text-[9px] w-[60%]'>{farmMap.get(firstApp.plotId!) || 'N/A'}</span>
              </div>
              <div className='flex mb-1.5'>
                <span className='text-[9px] font-bold w-[40%] text-[#6B7280]'>
                  {isCompletedPlannedArea
                    ? 'Área Total Concluída do Talhão:'
                    : 'Área Cadastrada do Talhão:'}
                </span>
                <span className='text-[9px] w-[60%]'>
                  {formatHectares(plot.hectare)}
                  {!isCompletedPlannedArea ? (
                    <small className='block text-[7px] text-[#9CA3AF] mt-0.5'>
                      Área delimitada no mapa do cadastro.
                    </small>
                  ) : null}
                </span>
              </div>
              {isCompletedPlannedArea ? (
                <>
                  <div className='flex mb-1.5'>
                    <span className='text-[9px] font-bold w-[40%] text-[#6B7280]'>Situação:</span>
                    <span className='text-[9px] w-[60%] font-bold text-[#166534]'>Concluído</span>
                  </div>
                  <div className='flex mb-1.5'>
                    <span className='text-[9px] font-bold w-[40%] text-[#6B7280]'>Cobertura:</span>
                    <span className='text-[9px] w-[60%] font-bold text-[#166534]'>100,00%</span>
                  </div>
                </>
              ) : null}
              <div className='flex mb-1.5'>
                <span className='text-[9px] font-bold w-[40%] text-[#6B7280]'>
                  Quantidade de Aplicações:
                </span>
                <span className='text-[9px] w-[60%]'>{plotApplications.length}</span>
              </div>
            </div>

            {/* Lista de aplicações */}
            {plotApplications.map((application) => {
              const registeredAreaCoverage = isCompletedPlannedArea
                ? null
                : formatRegisteredAreaCoverage(application.hectares, plot.hectare);

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
                    {!isCompletedPlannedArea ? (
                      <div className='flex'>
                        <span className='text-[8px] font-bold text-[#6B7280] mr-1'>
                          Área Aplicada:
                        </span>
                        <span className='text-[8px]'>
                          {formatHectares(application.hectares)}
                          <small className='block text-[7px] text-[#9CA3AF]'>
                            Área informada nesta aplicação.
                          </small>
                        </span>
                      </div>
                    ) : null}
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
