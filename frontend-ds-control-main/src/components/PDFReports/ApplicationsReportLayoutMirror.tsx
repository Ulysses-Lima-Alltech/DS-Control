'use client';

/**
 * Espelho em HTML/React do layout do ApplicationsReportPDF.tsx.
 * Reproduz visualmente o relatório para análise e aprovação sem depender da renderização em PDF.
 * NÃO altera o fluxo do PDF nem substitui o arquivo real.
 */

import type { Application } from '@/types/applications.type';
import type { ServiceOrder } from '@/types/service-order.type';

interface ApplicationsReportLayoutMirrorProps {
  serviceOrder: ServiceOrder;
  applications: Application[];
}

const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatHectares = (hectares: string) => {
  return `${parseFloat(hectares).toFixed(2)} ha`;
};

export function ApplicationsReportLayoutMirror({
  serviceOrder,
  applications,
}: ApplicationsReportLayoutMirrorProps) {
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
      ? applications.reduce((sum, app) => sum + parseFloat(app.routeSpacing), 0) / applications.length
      : 0;
  const averageDropletSize =
    applications.length > 0
      ? applications.reduce((sum, app) => sum + parseFloat(app.dropletSize), 0) / applications.length
      : 0;

  return (
    <div className='bg-white font-sans text-[10px] text-[#1F2937] max-w-[595px] mx-auto'>
      {/* ========== CAPA ========== */}
      <div className='p-10 flex flex-col items-center bg-white min-h-[842px] box-border'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src='/images/pdf-logo-complete.png'
          alt='Logo DS Control'
          width={300}
          height={100}
          className='mb-7 object-contain'
        />
        <h1 className='text-2xl font-bold mb-2.5 text-center'>DS Drones Agrícolas LTDA</h1>
        <p className='text-xs text-center mb-10 leading-relaxed'>
          54.134.198/0001-25<br />
          Imperatriz - MA<br />
          +55 99 9174-5656
        </p>

        {/* Informações da Ordem de Serviço */}
        <div className='w-full mt-5 p-5 border border-[#E5E7EB] rounded-lg'>
          <h2 className='text-sm font-bold mb-4 text-[#1F2937]'>Informações da Ordem de Serviço</h2>
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
            <span className='text-[10px] font-bold w-[40%] text-[#6B7280]'>Data Planejada:</span>
            <span className='text-[10px] w-[60%]'>{formatDate(serviceOrder.plannedDate)}</span>
          </div>
          {serviceOrder.farms?.length ? (
            <div className='flex mb-2'>
              <span className='text-[10px] font-bold w-[40%] text-[#6B7280]'>Fazendas:</span>
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
              <span className='text-[10px] font-bold w-[40%] text-[#6B7280]'>Pilotos:</span>
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
              <span className='text-[10px] font-bold w-[40%] text-[#6B7280]'>Observação:</span>
              <span className='text-[10px] w-[60%]'>{serviceOrder.observation}</span>
            </div>
          ) : null}
        </div>

        {/* Estatísticas das Aplicações */}
        <div className='w-full mt-7 p-5 border border-[#E5E7EB] rounded-lg'>
          <h2 className='text-sm font-bold mb-4 text-[#1F2937]'>Estatísticas das Aplicações</h2>
          <div className='bg-[#FFF3CD] p-3 rounded border-2 border-[#EAAE07] mb-3'>
            <div className='flex justify-between items-center'>
              <span className='text-xs font-bold text-[#6B7280]'>Total de Hectares:</span>
              <span className='text-base font-bold text-[#EAAE07]'>{totalHectares.toFixed(2)} ha</span>
            </div>
          </div>
          <div className='flex mb-2'>
            <span className='text-[10px] font-bold w-1/2 text-[#6B7280]'>Taxa de Fluxo (Vazão) Média:</span>
            <span className='text-[10px] w-1/2'>{averageFlowRate.toFixed(2)} L/ha</span>
          </div>
          <div className='flex mb-2'>
            <span className='text-[10px] font-bold w-1/2 text-[#6B7280]'>Altitude Média:</span>
            <span className='text-[10px] w-1/2'>{averageAltitude.toFixed(2)} m</span>
          </div>
          <div className='flex mb-2'>
            <span className='text-[10px] font-bold w-1/2 text-[#6B7280]'>Espaçamento Médio:</span>
            <span className='text-[10px] w-1/2'>{averageRouteSpacing.toFixed(2)} m</span>
          </div>
          <div className='flex mb-2'>
            <span className='text-[10px] font-bold w-1/2 text-[#6B7280]'>Tamanho de Gota Médio:</span>
            <span className='text-[10px] w-1/2'>{averageDropletSize.toFixed(2)} µm</span>
          </div>
        </div>
      </div>

      {/* ========== PÁGINAS POR TALHÃO ========== */}
      {Object.entries(applicationsByPlot).map(([plotId, plotApplications], plotIndex) => {
        const firstApp = plotApplications[0];
        const plot = firstApp.plot;
        if (!plot) return null;

        return (
          <div
            key={plotId}
            className='p-8 min-h-[842px] box-border border-t border-[#E5E7EB]'
          >
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

            {/* Área do mapa (placeholder no HTML) */}
            <div className='w-full h-[200px] mb-5 border border-[#E5E7EB] bg-[#F3F4F6] flex items-center justify-center rounded'>
              <span className='text-sm text-[#6B7280] font-medium'>Mapa não disponível (placeholder no espelho HTML)</span>
            </div>

            {/* Bloco do talhão */}
            <div className='bg-[#F9FAFB] p-4 rounded-lg mb-4 border border-[#E5E7EB]'>
              <h3 className='text-sm font-bold mb-2.5 text-[#EAAE07]'>{plot.name}</h3>
              <div className='flex mb-1.5'>
                <span className='text-[9px] font-bold w-[40%] text-[#6B7280]'>Fazenda:</span>
                <span className='text-[9px] w-[60%]'>{farmMap.get(firstApp.plotId!) || 'N/A'}</span>
              </div>
              <div className='flex mb-1.5'>
                <span className='text-[9px] font-bold w-[40%] text-[#6B7280]'>Área:</span>
                <span className='text-[9px] w-[60%]'>{formatHectares(plot.hectare)}</span>
              </div>
              <div className='flex mb-1.5'>
                <span className='text-[9px] font-bold w-[40%] text-[#6B7280]'>Aplicações:</span>
                <span className='text-[9px] w-[60%]'>{plotApplications.length}</span>
              </div>
            </div>

            {/* Lista de aplicações */}
            {plotApplications.map((application) => (
              <div
                key={application.id}
                className='bg-white p-3 rounded-lg mb-2.5 border border-[#E5E7EB]'
              >
                <div className='flex justify-between mb-2.5 pb-2 border-b border-[#E5E7EB]'>
                  <span className='text-xs font-bold text-[#EAAE07]'>{application.product?.name || 'N/A'}</span>
                  <span className='text-[10px] text-[#6B7280]'>{formatDate(application.date)}</span>
                </div>
                <div className='flex flex-wrap gap-x-4 gap-y-1'>
                  <div className='flex'>
                    <span className='text-[8px] font-bold text-[#6B7280] mr-1'>Piloto:</span>
                    <span className='text-[8px]'>{application.pilot?.name || 'N/A'}</span>
                  </div>
                  <div className='flex'>
                    <span className='text-[8px] font-bold text-[#6B7280] mr-1'>Assistente:</span>
                    <span className='text-[8px]'>{application.assistant?.name || 'N/A'}</span>
                  </div>
                  <div className='flex'>
                    <span className='text-[8px] font-bold text-[#6B7280] mr-1'>Drone:</span>
                    <span className='text-[8px]'>{application.drone?.name || 'N/A'} - {application.drone?.model || 'N/A'}</span>
                  </div>
                  <div className='flex'>
                    <span className='text-[8px] font-bold text-[#6B7280] mr-1'>Cultura:</span>
                    <span className='text-[8px]'>{application.culture?.name || 'N/A'}</span>
                  </div>
                  <div className='flex'>
                    <span className='text-[8px] font-bold text-[#6B7280] mr-1'>Hectares:</span>
                    <span className='text-[8px]'>{formatHectares(application.hectares)}</span>
                  </div>
                  <div className='flex'>
                    <span className='text-[8px] font-bold text-[#6B7280] mr-1'>Taxa de Fluxo:</span>
                    <span className='text-[8px]'>{parseFloat(application.flowRate).toFixed(2)} L/ha</span>
                  </div>
                  <div className='flex'>
                    <span className='text-[8px] font-bold text-[#6B7280] mr-1'>Altitude:</span>
                    <span className='text-[8px]'>{parseFloat(application.altitude).toFixed(2)} m</span>
                  </div>
                  <div className='flex'>
                    <span className='text-[8px] font-bold text-[#6B7280] mr-1'>Espaçamento:</span>
                    <span className='text-[8px]'>{parseFloat(application.routeSpacing).toFixed(2)} m</span>
                  </div>
                  <div className='flex'>
                    <span className='text-[8px] font-bold text-[#6B7280] mr-1'>Tamanho de Gota:</span>
                    <span className='text-[8px]'>{parseFloat(application.dropletSize).toFixed(2)} µm</span>
                  </div>
                </div>
                {application.observations ? (
                  <div className='mt-1.5 w-full'>
                    <span className='text-[8px] font-bold text-[#6B7280]'>Observações: </span>
                    <span className='text-[8px]'>{application.observations}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
