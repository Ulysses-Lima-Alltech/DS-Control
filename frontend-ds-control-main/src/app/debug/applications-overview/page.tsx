'use client';

import { useState } from 'react';

import { ApplicationsOverviewDashboard } from '@/components/ApplicationsOverviewDashboard';
import { Button } from '@/components/ui/button';

/**
 * Página temporária para validar `ApplicationsOverviewDashboard` (evolução temporal) sem autenticação.
 *
 * URL: http://localhost:3001/debug/applications-overview
 *
 * REMOVER: apague `src/app/debug/` inteiro (e props `__dev*` do dashboard, se quiser limpar 100%).
 */
export default function ApplicationsOverviewDebugPage() {
  const [evolutionEmpty, setEvolutionEmpty] = useState(false);

  return (
    <div className='mx-auto max-w-6xl space-y-4 p-6'>
      <div className='space-y-1'>
        <h1 className='text-xl font-semibold'>Debug — Visão Geral (Aplicações)</h1>
        <p className='text-sm text-muted-foreground'>
          Evolução temporal usa mock DEV quando &quot;Série vazia&quot; está desligado. KPIs e outros
          gráficos podem falhar sem API/token — o foco aqui é o card de evolução.
        </p>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <Button
          type='button'
          size='sm'
          variant={!evolutionEmpty ? 'default' : 'outline'}
          onClick={() => setEvolutionEmpty(false)}
        >
          Evolução: mock (empty / single-bar / multi-line via granularidade)
        </Button>
        <Button
          type='button'
          size='sm'
          variant={evolutionEmpty ? 'default' : 'outline'}
          onClick={() => setEvolutionEmpty(true)}
        >
          Evolução: série vazia (branch empty)
        </Button>
      </div>

      <ApplicationsOverviewDashboard
        __devEvolutionMock={!evolutionEmpty}
        __devEvolutionEmpty={evolutionEmpty}
      />
    </div>
  );
}
