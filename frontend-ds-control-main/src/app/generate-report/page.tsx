'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import LoadingIcon from '@/components/LoadingIcon';
import { Progress } from '@/components/ui/progress';
import { AUTH_ACCESS_TOKEN_KEY } from '@/services/api.service';
import { getApplicationsByServiceOrderId } from '@/services/application.service';
import { getServiceOrderById } from '@/services/service-order.service';
import { Application } from '@/types/applications.type';
import { Plot } from '@/types/plot.type';
import { downloadPDF, generateApplicationsReportPDF } from '@/utils/pdfGenerator';

type StatusType = 'connecting' | 'fetching' | 'generating' | 'downloading' | 'completed' | 'error';

function GenerateReportContent() {
  const searchParams = useSearchParams();
  const serviceOrderId = searchParams.get('serviceOrderId');
  const token = searchParams.get('token');

  const [status, setStatus] = useState<StatusType>('connecting');
  const [progress, setProgress] = useState(0);
  const [applicationCount, setApplicationCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!serviceOrderId || !token) {
      setStatus('error');
      setErrorMessage('Parâmetros inválidos. serviceOrderId e token são obrigatórios.');
      return;
    }

    generateReport();
  }, [serviceOrderId, token]);

  const generateReport = async () => {
    try {
      setStatus('connecting');
      setProgress(5);

      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_ACCESS_TOKEN_KEY, token!);
      }

      setProgress(10);

      setStatus('fetching');

      const serviceOrderResult = await getServiceOrderById(serviceOrderId!, {
        includePlots: 'true',
        includeGeoJson: 'true',
        includePilots: 'true',
        includeFarms: 'true',
        includeContracts: 'true',
        includeCustomers: 'true',
      });

      if (!serviceOrderResult) {
        throw new Error('Erro ao carregar dados da ordem de serviço');
      }

      setProgress(40);

      const applicationsResult = await getApplicationsByServiceOrderId(serviceOrderId!);

      if (!applicationsResult?.data) {
        throw new Error('Erro ao carregar aplicações');
      }

      setApplicationCount(applicationsResult.data.length);
      setProgress(60);

      setStatus('generating');

      const applications = [...applicationsResult.data];

      if (serviceOrderResult.plots && Array.isArray(serviceOrderResult.plots)) {
        const plotMap = new Map<string, Plot>();
        serviceOrderResult.plots.forEach((plot: Plot) => {
          if (plot.id) {
            plotMap.set(plot.id, plot);
          }
        });

        applications.forEach((application: Application) => {
          if (application.plotId && plotMap.has(application.plotId)) {
            const plot = plotMap.get(application.plotId);
            if (plot) {
              application.plot = plot;
            }
          }
        });
      }

      setProgress(75);

      const blob = await generateApplicationsReportPDF({
        serviceOrder: serviceOrderResult,
        applications,
      });

      setProgress(90);

      setStatus('downloading');

      downloadPDF(blob, `relatorio-aplicacoes-os-${serviceOrderResult.number}.pdf`);

      setProgress(100);
      setStatus('completed');
    } catch (error) {
      setStatus('error');
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Erro ao gerar relatório. Tente novamente.');
      }
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
      }
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'connecting':
        return 'Conectando ao servidor...';
      case 'fetching':
        return 'Carregando dados da ordem de serviço...';
      case 'generating':
        return applicationCount
          ? `Gerando relatório de ${applicationCount} aplicações...`
          : 'Gerando relatório...';
      case 'downloading':
        return 'Finalizando download...';
      case 'completed':
        return 'Relatório gerado com sucesso!';
      case 'error':
        return errorMessage || 'Erro ao gerar relatório';
      default:
        return 'Processando...';
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-background p-4'>
      <div className='w-full max-w-md space-y-8'>
        <div className='text-center space-y-4'>
          <div className='flex justify-center'>
            {status === 'error' ? (
              <div className='w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center'>
                <svg
                  className='w-8 h-8 text-destructive'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </div>
            ) : status === 'completed' ? (
              <div className='w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center'>
                <svg
                  className='w-8 h-8 text-green-500'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              </div>
            ) : (
              <LoadingIcon />
            )}
          </div>

          <div className='space-y-2'>
            <h1 className='text-2xl font-semibold text-foreground'>
              {status === 'error'
                ? 'Erro'
                : status === 'completed'
                  ? 'Concluído'
                  : 'Gerando Relatório'}
            </h1>
            <p className='text-muted-foreground'>{getStatusMessage()}</p>
          </div>

          {status !== 'error' && status !== 'completed' && (
            <div className='space-y-2 px-4'>
              <Progress value={progress} className='h-2' />
              <p className='text-xs text-muted-foreground'>{progress}%</p>
            </div>
          )}

          {status === 'completed' && (
            <div className='mt-4 space-y-4'>
              <p className='text-sm text-muted-foreground'>
                O download do relatório foi concluído com sucesso! Confira sua pasta de downloads
                para visualizar o relatório.
              </p>
              <button
                onClick={() => window.close()}
                className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90'
              >
                Fechar
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className='mt-4'>
              <button
                onClick={() => window.close()}
                className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90'
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GenerateReportPage() {
  return (
    <Suspense
      fallback={
        <div className='min-h-screen flex items-center justify-center bg-background'>
          <LoadingIcon />
        </div>
      }
    >
      <GenerateReportContent />
    </Suspense>
  );
}
