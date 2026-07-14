import { Plot } from '@/types/plot.type';

interface StatsServiceOrderPlotProgressProps {
  plots: Plot[];
}

export function StatsServiceOrderPlotProgress({ plots }: StatsServiceOrderPlotProgressProps) {
  const totalPlots = plots?.length || 0;

  const totalHectaresAllPlots = plots.reduce(
    (sum, plot) => sum + parseFloat(plot.hectare || '0'),
    0
  );

  const completedPlots = plots.filter((plot) => plot.status === 'COMPLETED');
  const totalHectaresCompleted = completedPlots.reduce(
    (sum, plot) => sum + parseFloat(plot.hectare || '0'),
    0
  );

  const progressPercentage =
    totalHectaresAllPlots > 0
      ? ((totalHectaresCompleted / totalHectaresAllPlots) * 100).toFixed(1)
      : '0';

  return (
    <div className='bg-card rounded-lg border border-border p-6 h-full'>
      <h3 className='text-2xl font-bold text-card-foreground mb-6'>
        Progressos da Ordem de Serviço
      </h3>

      <div className='grid grid-cols-2 gap-x-8 gap-y-4'>
        <div className='border-b border-border pb-4'>
          <span className='text-sm text-muted-foreground'>Mapas</span>
          <p className='text-2xl font-bold text-card-foreground'>{totalPlots}</p>
        </div>
        <div className='border-b border-border pb-4'>
          <span className='text-sm text-muted-foreground'>Total</span>
          <p className='text-2xl font-bold text-card-foreground'>
            {totalHectaresAllPlots.toFixed(1)} ha
          </p>
        </div>

        <div className='border-b border-border pb-4'>
          <span className='text-sm text-muted-foreground'>Concluído</span>
          <p className='text-2xl font-bold text-card-foreground'>{completedPlots.length}</p>
        </div>
        <div className='border-b border-border pb-4'>
          <span className='text-sm text-muted-foreground'>Total concluído</span>
          <p className='text-2xl font-bold text-card-foreground'>
            {totalHectaresCompleted.toFixed(1)} ha
          </p>
        </div>
      </div>

      <div className='mt-6'>
        <div className='flex items-center gap-4'>
          <span className='text-sm text-muted-foreground'>Progresso</span>
          <span className='text-2xl font-bold text-card-foreground'>{progressPercentage}%</span>
        </div>
        <div className='w-full bg-muted rounded-full h-2.5 mt-2'>
          <div
            className='h-2.5 rounded-full transition-all duration-300 bg-green-500'
            style={{ width: `${Math.min(parseFloat(progressPercentage), 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
