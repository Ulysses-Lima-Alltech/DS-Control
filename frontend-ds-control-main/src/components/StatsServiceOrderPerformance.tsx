import { Badge } from '@/components/ui/badge';
import { Application } from '@/types/applications.type';

interface StatsServiceOrderPerformanceProps {
  applications: Application[];
}

export function StatsServiceOrderPerformance({ applications }: StatsServiceOrderPerformanceProps) {
  const totalApplications = applications.length;
  const totalArea = applications.reduce((sum, app) => sum + parseFloat(app.hectares || '0'), 0);

  const stats = [
    {
      title: 'Aplicações Agrícolas',
      count: `${totalApplications} aplicações`,
      values: [
        {
          label: totalArea.toFixed(1),
          status: 'TOTAL APLICADO',
          statusColor: 'text-blue-600',
          count: `somatório de hectares aplicados`,
        },
      ],
    },
  ];

  return (
    <div className='grid grid-cols-1 gap-6'>
      {stats.map((stat, index) => (
        <div key={index} className='bg-card rounded-lg border border-border p-6 h-full'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-sm font-medium text-card-foreground'>{stat.title}</h3>
            <Badge variant='secondary' className='bg-muted text-muted-foreground text-xs'>
              {stat.count}
            </Badge>
          </div>

          <div className='space-y-3'>
            {stat.values.map((value, valueIndex) => (
              <div key={valueIndex} className='flex items-center justify-between'>
                <div className='flex items-center space-x-2'>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      value.status === 'TOTAL APLICADO'
                        ? 'bg-blue-500'
                        : value.status === 'RECENTES'
                          ? 'bg-green-500'
                          : value.status === 'ÁREA MÉDIA'
                            ? 'bg-purple-500'
                            : 'bg-gray-400'
                    }`}
                  />
                  <span className='text-lg font-semibold text-card-foreground'>
                    {value.label} ha
                  </span>
                </div>
                <div className='text-right'>
                  <div className={`text-xs font-medium ${value.statusColor}`}>{value.status}</div>
                  <div className='text-xs text-muted-foreground'>{value.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
