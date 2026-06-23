'use client';

import { InfiniteData, useQueries } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Layers, Loader2, LocateFixed, Minus, Plus } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { MapRef } from 'react-map-gl/mapbox';

import DialogPlotDetails from '@/components/DialogPlotDetails';
import MapContent from '@/components/MapContent';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import * as FarmService from '@/services/farm.service';
import { Farm } from '@/types/farm.type';
import { convertDatabasePlotsToMapViewerPlotsFeatureCollection } from '@/utils/map-utils';

export default function MapPage() {
  // Temporário: token fixo no código até corrigir NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN no build do Amplify (diagnóstico / contornar env ausente no cliente).
  // const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const mapboxToken =
    'pk.eyJ1IjoiYW50b25pb3Zpbmk0NyIsImEiOiJjbWJoNW9wM2swNmlyMmlvbGlmb3J6NW4xIn0.wKznYpMm2m5Z0Opjjkpa-Q';
  const mapRef = useRef<MapRef | null>(null);
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/satellite-streets-v12');

  const [selectedFarmIds, setSelectedFarmIds] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('');
  const [clickedPlot, setClickedPlot] = useState<{ farmId: string; plotId: string } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const customerFarmIdsRef = useRef<Set<string>>(new Set());

  const {
    data: farmsFromInfiniteQuery,
    fetchNextPage: fetchNextPageFarms,
    hasNextPage: hasNextPageFarms,
    isFetchingNextPage: isFetchingNextPageFarms,
    isLoading: isLoadingFarms,
  } = useGetAllFarmsInfinite(
    undefined,
    {
      includeGeoJson: 'false',
      limit: '10',
      search: debouncedSearchValue || undefined,
    },
    {
      queryKey: ['farms', 'map', 'infinite', debouncedSearchValue || ''],
    }
  );

  const {
    data: customersFromInfiniteQuery,
    fetchNextPage: fetchNextPageCustomers,
    hasNextPage: hasNextPageCustomers,
    isFetchingNextPage: isFetchingNextPageCustomers,
    isLoading: isLoadingCustomers,
  } = useGetAllCustomersInfinite(
    {
      limit: '10',
      search: debouncedSearchValue || undefined,
    },
    {
      queryKey: ['customers', 'map', 'infinite', debouncedSearchValue || ''],
    }
  );

  const {
    data: farmsByCustomerInfinite,
    fetchNextPage: fetchNextPageFarmsByCustomer,
    hasNextPage: hasNextPageFarmsByCustomer,
    isFetchingNextPage: isFetchingNextPageFarmsByCustomer,
    isLoading: isLoadingFarmsByCustomer,
  } = useGetAllFarmsInfinite(
    selectedCustomerId || undefined,
    {
      includeGeoJson: 'false',
      limit: '10',
      search: undefined,
    },
    {
      queryKey: ['farms', 'byCustomer', 'infinite', selectedCustomerId || ''],
      enabled: !!selectedCustomerId,
    }
  );

  // Fetch multiple farms using useQueries
  const farmQueries = useQueries({
    queries: selectedFarmIds.map((farmId) => ({
      queryKey: ['farm', farmId, { includeGeoJson: 'true', includePlots: 'true' }],
      queryFn: () =>
        FarmService.getFarmById(farmId, {
          includeGeoJson: 'true',
          includePlots: 'true',
        }),
      enabled: !!farmId,
    })),
  });

  const selectedFarms = farmQueries
    .filter((query) => query.data?.farm)
    .map((query) => query.data!.farm);

  const isLoadingSelectedFarms = farmQueries.some((query) => query.isLoading);

  const listedFarms = useMemo(() => {
    return (
      (farmsFromInfiniteQuery as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap(
        (page) => page.data
      ) || []
    );
  }, [farmsFromInfiniteQuery]);

  const listedCustomers = useMemo(() => {
    return (
      (
        customersFromInfiniteQuery as unknown as InfiniteData<{
          data: { id: string; name: string }[];
        }>
      )?.pages?.flatMap((page) => page.data) || []
    );
  }, [customersFromInfiniteQuery]);

  const debouncedSearchFarms = debounce((searchTerm: string) => {
    setDebouncedSearchValue(searchTerm);
  }, 500);

  const geoData = useMemo(() => {
    const allPlots = selectedFarms.flatMap(
      (farm) => farm?.plots.filter((plot) => !plot.deletedAt) ?? []
    );
    return convertDatabasePlotsToMapViewerPlotsFeatureCollection(allPlots, selectedFarms);
  }, [selectedFarms]);

  const handlePlotClick = (plotId: string) => {
    const plot = selectedFarms.flatMap((farm) => farm?.plots || []).find((p) => p.id === plotId);

    if (plot && plot.farmId && plot.id) {
      setClickedPlot({ farmId: plot.farmId, plotId: plot.id });
      setIsDialogOpen(true);
    }
  };

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleToggleMapStyle = () => {
    setMapStyle((currentStyle) =>
      currentStyle.includes('satellite')
        ? 'mapbox://styles/mapbox/outdoors-v12'
        : 'mapbox://styles/mapbox/satellite-streets-v12'
    );
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      mapRef.current?.flyTo({
        center: [position.coords.longitude, position.coords.latitude],
        zoom: 13,
      });
    });
  };

  useEffect(() => {
    if (selectedCustomerId && hasNextPageFarmsByCustomer && !isFetchingNextPageFarmsByCustomer) {
      fetchNextPageFarmsByCustomer();
    }
  }, [
    selectedCustomerId,
    farmsByCustomerInfinite,
    hasNextPageFarmsByCustomer,
    isFetchingNextPageFarmsByCustomer,
    fetchNextPageFarmsByCustomer,
  ]);

  useEffect(() => {
    if (!selectedCustomerId) return;
    const farms =
      (farmsByCustomerInfinite as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap(
        (page) => page.data
      ) || [];
    customerFarmIdsRef.current = new Set(farms.map((f) => f.id));
    if (farms.length > 0) {
      setSelectedFarmIds((prev) => {
        const next = new Set(prev);
        farms.forEach((f) => next.add(f.id));
        return Array.from(next);
      });
    }
  }, [selectedCustomerId, farmsByCustomerInfinite]);

  useEffect(() => {
    if (mapRef.current && selectedFarmIds.length === 0) {
      mapRef.current.flyTo({
        zoom: 2,
      });
    }
  }, [selectedFarmIds]);

  if (!mapboxToken) {
    return (
      <div className='flex h-[calc(100vh)] w-full items-center justify-center p-6 text-center text-muted-foreground'>
        <p>
          Mapa indisponível: defina NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN no ambiente de build (ex.:
          variáveis do Amplify para o frontend).
        </p>
      </div>
    );
  }

  return (
    <div className='h-full min-h-[calc(100svh-5rem)] p-5 lg:p-6'>
      <div
        className={`relative h-[calc(100svh-8rem)] min-h-[560px] overflow-hidden rounded-[22px] border border-border/60 bg-card shadow-[0_16px_38px_rgba(15,23,42,0.08)] ${
          isLoadingSelectedFarms ? 'opacity-50' : 'opacity-100'
        }`}
      >
        <Map
          ref={mapRef}
          mapboxAccessToken={mapboxToken}
          style={{ width: '100%', height: '100%', zIndex: 8 }}
          mapStyle={mapStyle}
          logoPosition='bottom-right'
          attributionControl={false}
        >
          {selectedFarms.length > 0 && (
            <MapContent geoData={geoData} onPlotClick={handlePlotClick} />
          )}
        </Map>
        {isLoadingSelectedFarms && (
          <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/50'>
            <Loader2 className='h-10 w-10 animate-spin text-white' />
          </div>
        )}
        <div className='absolute right-6 top-6 z-50 w-[82%] max-w-[320px] rounded-2xl border border-border/60 bg-card p-2 shadow-[0_12px_28px_rgba(15,23,42,0.14)]'>
          <SearchableSelectQuery
            className='h-14 w-full justify-between rounded-xl border-0 bg-card px-4 text-sm shadow-none hover:bg-primary/5'
            options={[
              ...(listedCustomers?.map((c: { id: string; name: string }) => ({
                value: `customer:${c.id}`,
                label: `${c.name} (Cliente)`,
              })) ?? []),
              ...(listedFarms?.map((farm: Farm) => ({
                value: farm.id,
                label: farm.name,
              })) ?? []),
            ]}
            value={[
              ...(selectedCustomerId ? [`customer:${selectedCustomerId}`] : []),
              ...selectedFarmIds,
            ]}
            onValueChange={(value) => {
              const values = value as string[];
              const customerToken = values.find((v) => v.startsWith('customer:')) || null;
              const newCustomerId = customerToken ? customerToken.split(':')[1] || null : null;
              const farmValues = values.filter((v) => !v.startsWith('customer:')) as string[];
              let removedSet = new Set<string>();
              if (!newCustomerId && selectedCustomerId) {
                removedSet = new Set(customerFarmIdsRef.current);
              } else if (newCustomerId && newCustomerId !== selectedCustomerId) {
                removedSet = new Set(customerFarmIdsRef.current);
              }
              const adjustedFarmValues = farmValues.filter((id) => !removedSet.has(id));
              setSelectedFarmIds(adjustedFarmValues);
              if (newCustomerId !== selectedCustomerId) {
                setSelectedCustomerId(newCustomerId);
              }
            }}
            placeholder='Buscar fazendas...'
            searchPlaceholder='Buscar fazendas...'
            onSearchChange={debouncedSearchFarms}
            isFetchingNextPage={isFetchingNextPageFarms || isFetchingNextPageCustomers}
            isLoading={isLoadingFarms || isLoadingCustomers || isLoadingFarmsByCustomer}
            disabled={isLoadingSelectedFarms}
            onScrollEnd={() => {
              if (hasNextPageCustomers) fetchNextPageCustomers();
              if (hasNextPageFarms) fetchNextPageFarms();
            }}
            hasNextPage={hasNextPageFarms || hasNextPageCustomers}
            isMultipleSelections={true}
            showCheckbox={true}
          />
        </div>
        <div className='absolute bottom-8 left-8 z-40 rounded-2xl border border-border/60 bg-card/95 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.14)] backdrop-blur'>
          <div className='space-y-4 text-sm text-foreground'>
            {[
              ['Todos os itens', '#1f7a2d'],
              ['Aplicação realizada', '#5CB85C'],
              ['Aplicação planejada', '#95BD75'],
              ['Talhões', '#F6DC7F'],
            ].map(([label, color]) => (
              <div key={label} className='flex items-center gap-4'>
                <span
                  className='h-6 w-6 rounded-md border border-black/10 shadow-sm'
                  style={{ backgroundColor: color }}
                />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className='absolute right-8 top-1/2 z-40 flex -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_12px_28px_rgba(15,23,42,0.14)]'>
          {[
            { label: 'Aproximar', icon: Plus, onClick: handleZoomIn },
            { label: 'Afastar', icon: Minus, onClick: handleZoomOut },
            { label: 'Camadas', icon: Layers, onClick: handleToggleMapStyle },
            { label: 'Localizar', icon: LocateFixed, onClick: handleLocateUser },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type='button'
                aria-label={item.label}
                onClick={item.onClick}
                className='flex size-14 items-center justify-center border-b border-border/60 text-foreground transition-colors last:border-b-0 hover:bg-primary/10 hover:text-primary'
              >
                <Icon className='h-5 w-5' />
              </button>
            );
          })}
        </div>
        {clickedPlot && (
          <DialogPlotDetails
            farmId={clickedPlot.farmId}
            plotId={clickedPlot.plotId}
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
          />
        )}
      </div>
    </div>
  );
}
