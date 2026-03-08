'use client';

import { BarChart3, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const DashboardCardAnalyticsReport = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [authError, setAuthError] = useState(false);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setAuthError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleIframeMessage = (event: MessageEvent) => {
    if (event.origin === 'https://lookerstudio.google.com') {
      if (event.data && event.data.type === 'auth-error') {
        setAuthError(true);
        setHasError(true);
      }
    }
  };

  const handleOpenInNewTab = () => {
    window.open(
      'https://lookerstudio.google.com/reporting/4b3cd1ee-329a-463f-a240-b98b34db061e/page/p_vs1lbn64td'
    );
  };

  const handleRetryIframe = () => {
    setIsLoading(true);
    setHasError(false);
    setAuthError(false);
    const iframe = document.querySelector(
      'iframe[title="Relatório de Análise - Looker Studio"]'
    ) as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src + '&t=' + Date.now();
    }
  };

  useEffect(() => {
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, []);

  return (
    <Card className='h-full w-full'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <BarChart3 className='w-5 h-5 text-blue-500' />
          Relatório de Análise
        </CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col h-full'>
        <div className='flex-1 relative h-full'>
          {isLoading && (
            <div className='absolute inset-0 flex items-center justify-center bg-muted rounded-md'>
              <div className='text-center space-y-2'>
                <div className='w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto' />
                <span className='text-sm text-muted-foreground'>Carregando relatório...</span>
              </div>
            </div>
          )}

          {hasError && (
            <div className='absolute inset-0 flex items-center justify-center bg-muted rounded-md'>
              <div className='text-center space-y-2'>
                <BarChart3 className='w-12 h-12 text-muted-foreground mx-auto' />
                <span className='text-sm text-muted-foreground'>
                  {authError
                    ? 'Erro de autenticação. Faça login no Google primeiro.'
                    : 'Erro ao carregar relatório'}
                </span>
                <div className='flex gap-2'>
                  <Button variant='outline' size='sm' onClick={handleRetryIframe}>
                    Tentar Novamente
                  </Button>
                  <Button variant='outline' size='sm' onClick={handleOpenInNewTab}>
                    Abrir em nova aba
                  </Button>
                </div>
              </div>
            </div>
          )}

          <iframe
            width='100%'
            height='100%'
            src='https://lookerstudio.google.com/embed/reporting/4b3cd1ee-329a-463f-a240-b98b34db061e/page/p_vs1lbn64td?allowEmbedded=true&authuser=0'
            frameBorder='0'
            style={{
              border: 0,
              borderRadius: '6px',
              display: hasError ? 'none' : 'block',
            }}
            allowFullScreen
            sandbox='allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation'
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title='Relatório de Análise - Looker Studio'
            referrerPolicy='no-referrer-when-downgrade'
            allow='fullscreen; clipboard-write; clipboard-read'
          />
        </div>

        <Button
          variant='outline'
          size='sm'
          onClick={handleOpenInNewTab}
          className='w-full flex items-center justify-center gap-2 mt-4'
        >
          Abrir em Tela Cheia
          <ExternalLink className='w-4 h-4' />
        </Button>
      </CardContent>
    </Card>
  );
};
