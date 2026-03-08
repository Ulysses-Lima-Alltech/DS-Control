'use client';

import { InfiniteData, useQueries } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Loader2 } from 'lucide-react';
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
  const mapRef = useRef<MapRef | null>(null);

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

  const handlePlotClick = (plotLayerName: string) => {
    const plot = selectedFarms
      .flatMap((farm) => farm?.plots || [])
      .find((plot) => plot.name === plotLayerName);

    if (plot && plot.farmId && plot.id) {
      setClickedPlot({ farmId: plot.farmId, plotId: plot.id });
      setIsDialogOpen(true);
    }
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

  return (
    <div className={`h-[calc(100vh)] ${isLoadingSelectedFarms ? 'opacity-50' : 'opacity-100'}`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        style={{ width: '100%', height: '100%', zIndex: 8 }}
        mapStyle='mapbox://styles/mapbox/satellite-streets-v12'
        logoPosition='bottom-right'
        attributionControl={false}
      >
        {selectedFarms.length > 0 && <MapContent geoData={geoData} onPlotClick={handlePlotClick} />}
      </Map>
      {isLoadingSelectedFarms && (
        <div className='absolute top-0 left-0 w-full h-full bg-black/50 z-50 flex items-center justify-center'>
          <Loader2 className='h-10 w-10 text-white animate-spin' />
        </div>
      )}
      <div className='absolute top-20 left-1/2 -translate-x-1/2 md:left-auto md:right-10 md:translate-x-0 w-[80%] max-w-[400px] z-50 bg-black rounded-lg'>
        <SearchableSelectQuery
          className='w-full'
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
      {clickedPlot && (
        <DialogPlotDetails
          farmId={clickedPlot.farmId}
          plotId={clickedPlot.plotId}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </div>
  );
}
