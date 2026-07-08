'use client';

import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import {
  Calendar,
  ChevronDown,
  Eye,
  MapPin,
  Pencil,
  Route as RouteIcon,
  Trash2,
  Users,
} from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import DialogForm from '@/components/DialogForm';
import FormEditRoute from '@/components/Forms/FormEditRoute';
import MapViewer from '@/components/MapViewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import { DataTable, type ColumnDefWithId } from '@/components/ui/table-data';
import { createClickableColumn } from '@/components/ui/table-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteRouteById } from '@/mutations/route.mutation';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { useGetRoutesGroupedByFarm } from '@/queries/route.query';
import { Customer } from '@/types/customer.type';
import { Farm } from '@/types/farm.type';
import {
  Route,
  RouteFarmGroup,
  RouteOrderBy,
  RouteOrderType,
  RouteWithFarmAndCustomer,
} from '@/types/route.type';
import { formatTimestamp } from '@/utils/timestamp-formatter';

type TableRoutesProps = {
  customerId?: string;
  farmId?: string;
};

type LngLatCoordinate = [number, number];

type RouteStats = {
  pointCount: number;
  distanceMeters: number | null;
  sourceFileName?: string;
  externalId?: string;
};

const TABLE_FILTER_CLASS =
  'h-14 rounded-2xl border-border/70 bg-card px-4 shadow-none hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20';

const ROUTE_COLORS = [
  '#22C55E',
  '#38BDF8',
  '#F97316',
  '#A855F7',
  '#EAB308',
  '#14B8A6',
  '#F43F5E',
  '#84CC16',
  '#6366F1',
  '#EC4899',
];

const EARTH_RADIUS_METERS = 6371008.8;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toCoordinate = (value: unknown): LngLatCoordinate | null => {
  if (!Array.isArray(value) || value.length < 2) return null;

  const longitude = Number(value[0]);
  const latitude = Number(value[1]);

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    Math.abs(longitude) > 180 ||
    Math.abs(latitude) > 90
  ) {
    return null;
  }

  return [longitude, latitude];
};

const collectCoordinatesFromGeometry = (geometry: unknown): LngLatCoordinate[] => {
  if (!isRecord(geometry)) return [];

  if (geometry.type === 'Point') {
    const coordinate = toCoordinate(geometry.coordinates);
    return coordinate ? [coordinate] : [];
  }

  if (geometry.type === 'LineString') {
    return Array.isArray(geometry.coordinates)
      ? geometry.coordinates
          .map(toCoordinate)
          .filter((coordinate): coordinate is LngLatCoordinate => Boolean(coordinate))
      : [];
  }

  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') {
    return Array.isArray(geometry.coordinates)
      ? geometry.coordinates.flatMap((line) =>
          Array.isArray(line)
            ? line
                .map(toCoordinate)
                .filter((coordinate): coordinate is LngLatCoordinate => Boolean(coordinate))
            : []
        )
      : [];
  }

  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates)
      ? geometry.coordinates.flatMap((polygon) =>
          Array.isArray(polygon)
            ? polygon.flatMap((ring) =>
                Array.isArray(ring)
                  ? ring
                      .map(toCoordinate)
                      .filter((coordinate): coordinate is LngLatCoordinate => Boolean(coordinate))
                  : []
              )
            : []
        )
      : [];
  }

  if (geometry.type === 'GeometryCollection') {
    return Array.isArray(geometry.geometries)
      ? geometry.geometries.flatMap(collectCoordinatesFromGeometry)
      : [];
  }

  return [];
};

const getDistanceBetweenCoordinatesMeters = (
  firstCoordinate: LngLatCoordinate,
  secondCoordinate: LngLatCoordinate
) => {
  const [firstLongitude, firstLatitude] = firstCoordinate;
  const [secondLongitude, secondLatitude] = secondCoordinate;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const deltaLatitude = toRadians(secondLatitude - firstLatitude);
  const deltaLongitude = toRadians(secondLongitude - firstLongitude);
  const firstLatitudeRadians = toRadians(firstLatitude);
  const secondLatitudeRadians = toRadians(secondLatitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(deltaLongitude / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getDistanceMetersFromCoordinates = (coordinates: LngLatCoordinate[]) => {
  if (coordinates.length < 2) return 0;

  return coordinates.reduce((totalDistance, coordinate, index) => {
    if (index === 0) return totalDistance;
    return totalDistance + getDistanceBetweenCoordinatesMeters(coordinates[index - 1], coordinate);
  }, 0);
};

const getGeoJsonFeatures = (
  routeGeoJson: unknown
): GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>[] => {
  if (!isRecord(routeGeoJson)) return [];

  if (routeGeoJson.type === 'FeatureCollection' && Array.isArray(routeGeoJson.features)) {
    return routeGeoJson.features
      .map((feature) => {
        if (!isRecord(feature) || feature.type !== 'Feature' || !isRecord(feature.geometry)) {
          return null;
        }

        return {
          ...feature,
          properties: isRecord(feature.properties) ? feature.properties : {},
        } as GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
      })
      .filter((feature): feature is GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>> =>
        Boolean(feature)
      );
  }

  if (routeGeoJson.type === 'Feature' && isRecord(routeGeoJson.geometry)) {
    return [
      {
        ...(routeGeoJson as unknown as GeoJSON.Feature<
          GeoJSON.Geometry,
          Record<string, unknown>
        >),
        properties: isRecord(routeGeoJson.properties) ? routeGeoJson.properties : {},
      },
    ];
  }

  if (routeGeoJson.type && routeGeoJson.coordinates) {
    return [
      {
        type: 'Feature',
        geometry: routeGeoJson as unknown as GeoJSON.Geometry,
        properties: {},
      },
    ];
  }

  return [];
};

const getFirstStringProperty = (
  route: RouteWithFarmAndCustomer,
  keys: string[]
): string | undefined => {
  const features = getGeoJsonFeatures(route.geoJson);

  for (const feature of features) {
    for (const key of keys) {
      const value = feature.properties?.[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }

  return undefined;
};

const getFirstNumberProperty = (
  route: RouteWithFarmAndCustomer,
  keys: string[]
): number | undefined => {
  const features = getGeoJsonFeatures(route.geoJson);

  for (const feature of features) {
    for (const key of keys) {
      const value = feature.properties?.[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const numericValue = Number.parseFloat(value);
        if (Number.isFinite(numericValue)) return numericValue;
      }
    }
  }

  return undefined;
};

const getRouteStats = (route: RouteWithFarmAndCustomer): RouteStats => {
  const coordinates = getGeoJsonFeatures(route.geoJson).flatMap((feature) =>
    collectCoordinatesFromGeometry(feature.geometry)
  );
  const distanceFromProperties = getFirstNumberProperty(route, [
    'distance_meters',
    'distanceMeters',
  ]);
  const distanceKmFromProperties = getFirstNumberProperty(route, ['distance_km', 'distanceKm']);
  const pointCountFromProperties = getFirstNumberProperty(route, ['point_count', 'pointCount']);

  return {
    pointCount: pointCountFromProperties ?? coordinates.length,
    distanceMeters:
      distanceFromProperties ??
      (distanceKmFromProperties ? distanceKmFromProperties * 1000 : null) ??
      (coordinates.length > 1 ? getDistanceMetersFromCoordinates(coordinates) : null),
    sourceFileName: getFirstStringProperty(route, [
      'source_file_name',
      'sourceFileName',
      'source_file',
    ]),
    externalId: getFirstStringProperty(route, ['external_id', 'externalId']),
  };
};

const formatDistanceMeters = (distanceMeters?: number | null) => {
  if (!distanceMeters || distanceMeters <= 0) return 'Distancia nao calculada';

  if (distanceMeters < 1000) {
    return `${distanceMeters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m`;
  }

  return `${(distanceMeters / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} km`;
};

const buildFarmRoutesFeatureCollection = (
  routes: RouteWithFarmAndCustomer[]
): GeoJSON.FeatureCollection | null => {
  const features = routes.flatMap((route, routeIndex) => {
    const color = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];

    return getGeoJsonFeatures(route.geoJson).map((feature) => ({
      ...feature,
      properties: {
        ...(feature.properties ?? {}),
        route_id: route.id,
        route_name: route.name,
        farm_id: route.farmId,
        farm_name: route.farm?.name,
        customer_id: route.customerId,
        customer_name: route.customer?.name,
        stroke: color,
      },
    }));
  });

  if (features.length === 0) return null;

  return {
    type: 'FeatureCollection',
    features,
  };
};

export default function TableRoutes({
  customerId: initialCustomerId,
  farmId: initialFarmId,
}: TableRoutesProps) {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [customerSearchValue, setCustomerSearchValue] = React.useState('');
  const [farmSearchValue, setFarmSearchValue] = React.useState('');
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | undefined>(
    initialCustomerId
  );
  const [selectedFarmId, setSelectedFarmId] = React.useState<string | undefined>(initialFarmId);
  const [routeToDelete, setRouteToDelete] = React.useState<Route | null>(null);
  const [routeToEdit, setRouteToEdit] = React.useState<Route | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [selectedRouteByFarmId, setSelectedRouteByFarmId] = React.useState<Record<string, string>>(
    {}
  );
  const [orderBy, setOrderBy] = React.useState<RouteOrderBy | undefined>(undefined);
  const [orderType, setOrderType] = React.useState<RouteOrderType | undefined>(undefined);

  const orderByOptions = [
    { value: RouteOrderBy.CREATEDAT, label: 'Ultima atualizacao' },
    { value: RouteOrderBy.FARM, label: 'Fazenda' },
    { value: RouteOrderBy.CUSTOMER, label: 'Cliente' },
    { value: RouteOrderBy.NAME, label: 'Nome auxiliar da rota' },
  ];

  const orderTypeOptions = [
    { value: RouteOrderType.ASC, label: 'Ascendente' },
    { value: RouteOrderType.DESC, label: 'Descendente' },
  ];

  const {
    data: customersData,
    fetchNextPage: fetchNextCustomerPage,
    hasNextPage: hasNextCustomerPage,
    isFetchingNextPage: isFetchingNextCustomerPage,
    isLoading: isLoadingCustomers,
  } = useGetAllCustomersInfinite({
    limit: '10',
    search: customerSearchValue || undefined,
  });

  const allCustomers =
    (customersData as unknown as InfiniteData<{ data: Customer[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];

  const {
    data: farmsData,
    fetchNextPage: fetchNextFarmPage,
    hasNextPage: hasNextFarmPage,
    isFetchingNextPage: isFetchingNextFarmPage,
    isLoading: isLoadingFarms,
  } = useGetAllFarmsInfinite(selectedCustomerId, {
    limit: '10',
    search: farmSearchValue || undefined,
  });

  const allFarms =
    (farmsData as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap((page) => page.data) ||
    [];

  const {
    data: routesGroupedData,
    isLoading,
    isError,
    error,
  } = useGetRoutesGroupedByFarm({
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: debouncedSearchValue || undefined,
    includeGeoJson: 'true',
    orderBy: orderBy ?? RouteOrderBy.CREATEDAT,
    orderType: orderType ?? RouteOrderType.DESC,
  });

  const { mutate: deleteRouteById, isPending: isDeletingRoute } = useDeleteRouteById({
    onSuccess: () => {
      toast('Rota deletada com sucesso');
      queryClient.invalidateQueries({
        queryKey: ['routes'],
      });
    },
    onError: (error) => {
      toast(error.message);
    },
  });

  const handleDeleteClick = useCallback((route: Route) => {
    setRouteToDelete(route);
  }, []);

  const handleEditClick = useCallback((route: Route) => {
    setRouteToEdit(route);
    setIsEditDialogOpen(true);
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setRouteToEdit(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (routeToDelete) {
      deleteRouteById(routeToDelete.id);
      setRouteToDelete(null);
    }
  }, [routeToDelete, deleteRouteById]);

  const debouncedSearch = useMemo(
    () =>
      debounce((searchTerm: string) => {
        setDebouncedSearchValue(searchTerm);
        setCurrentPage(1);
      }, 600),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    if (
      routesGroupedData &&
      routesGroupedData.totalPages > 0 &&
      currentPage > routesGroupedData.totalPages
    ) {
      setCurrentPage(1);
    }
  }, [routesGroupedData?.totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue]);

  useEffect(() => {
    setExpandedRows(new Set());
  }, [currentPage, debouncedSearchValue, selectedCustomerId, selectedFarmId, orderBy, orderType]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setInputSearchValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  const handleCustomerChange = useCallback(
    (customerId: string | undefined) => {
      if (!initialCustomerId) {
        setSelectedCustomerId(customerId);
        setSelectedFarmId(undefined);
        setCurrentPage(1);
      }
    },
    [initialCustomerId]
  );

  const handleFarmChange = useCallback(
    (farmId: string | undefined) => {
      if (!initialFarmId) {
        setSelectedFarmId(farmId);
        setCurrentPage(1);
      }
    },
    [initialFarmId]
  );

  const handleOrderByChange = (orderBy: RouteOrderBy | undefined) => {
    setOrderBy(orderBy);
    setCurrentPage(1);
  };

  const handleOrderTypeChange = (orderType: RouteOrderType | undefined) => {
    setOrderType(orderType);
    setCurrentPage(1);
  };

  const getGroupRowId = (group: RouteFarmGroup) => {
    const index = routesGroupedData?.data?.findIndex((item) => item.farmId === group.farmId) ?? 0;
    return Math.max(index, 0).toString();
  };

  const toggleRowExpansion = (rowId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const toggleAllRows = () => {
    if (expandedRows.size === 0) {
      const allGroupIds = routesGroupedData?.data?.map((_, index) => index.toString()) || [];
      setExpandedRows(new Set(allGroupIds));
    } else {
      setExpandedRows(new Set());
    }
  };

  const selectRouteInFarm = (farmId: string, routeId: string) => {
    setSelectedRouteByFarmId((current) => ({
      ...current,
      [farmId]: routeId,
    }));
  };

  type RouteColumnId =
    | 'farmName'
    | 'customerName'
    | 'routeCount'
    | 'lastRouteUpdatedAt'
    | 'actions'
    | 'expand';

  const initialColumnVisibility: Partial<Record<RouteColumnId, boolean>> = {};

  const columns: ColumnDefWithId<RouteFarmGroup>[] = [
    createClickableColumn<RouteFarmGroup>(
      'farmName',
      'farmName',
      'Fazenda',
      ({ row }) => {
        const group = row.original;

        return (
          <div className='flex items-start gap-4 py-2'>
            <div className='flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary'>
              <MapPin className='h-6 w-6' />
            </div>
            <div className='flex-1 min-w-0'>
              <h4 className='truncate text-base font-semibold text-[color:color-mix(in_oklch,var(--brand-primary)_72%,black)]'>
                {group.farmName}
              </h4>
              <div className='mt-1 flex items-center gap-2 text-xs text-muted-foreground'>
                <RouteIcon className='h-3 w-3' />
                <span>
                  {group.routeCount}{' '}
                  {group.routeCount === 1 ? 'rota disponivel' : 'rotas disponiveis'}
                </span>
              </div>
            </div>
          </div>
        );
      },
      (group) => toggleRowExpansion(getGroupRowId(group)),
      { width: 260, minWidth: 220, maxWidth: 360 }
    ),
    createClickableColumn<RouteFarmGroup>(
      'customerName',
      'customerName',
      'Cliente',
      ({ row }) => (
        <div className='flex items-center gap-3 py-2'>
          <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
            <Users className='h-4 w-4' />
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium text-[color:color-mix(in_oklch,var(--brand-primary)_72%,black)]'>
              {row.original.customerName}
            </p>
          </div>
        </div>
      ),
      (group) => toggleRowExpansion(getGroupRowId(group)),
      { width: 240, minWidth: 180, maxWidth: 320 }
    ),
    createClickableColumn<RouteFarmGroup>(
      'routeCount',
      'routeCount',
      'Rotas',
      ({ row }) => {
        const count = row.original.routeCount;
        return (
          <Badge variant='outline' className='border-primary/20 bg-primary/10 text-primary'>
            {count} {count === 1 ? 'rota disponivel' : 'rotas disponiveis'}
          </Badge>
        );
      },
      (group) => toggleRowExpansion(getGroupRowId(group)),
      { width: 180, minWidth: 150, maxWidth: 220 }
    ),
    createClickableColumn<RouteFarmGroup>(
      'lastRouteUpdatedAt',
      'lastRouteUpdatedAt',
      'Ultima atualizacao',
      ({ row }) => (
        <div className='flex items-center gap-2 py-2 text-sm text-foreground'>
          <Calendar className='h-4 w-4 text-muted-foreground' />
          <span>
            {row.original.lastRouteUpdatedAt
              ? formatTimestamp(row.original.lastRouteUpdatedAt)
              : 'N/A'}
          </span>
        </div>
      ),
      (group) => toggleRowExpansion(getGroupRowId(group)),
      { width: 190, minWidth: 160, maxWidth: 220 }
    ),
    {
      id: 'actions',
      header: () => <div className='flex justify-center'>Acao</div>,
      label: 'Acao',
      enableHiding: false,
      size: 140,
      cell: ({ row }) => {
        const rowId = row.id;
        const isExpanded = expandedRows.has(rowId);

        return (
          <div className='flex justify-center'>
            <Button
              variant='outline'
              className='h-11 rounded-xl border-border/70 bg-card px-4 text-primary shadow-none hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
              onClick={() => toggleRowExpansion(rowId)}
            >
              <Eye className='mr-2 h-4 w-4' />
              {isExpanded ? 'Fechar' : 'Ver rotas'}
            </Button>
          </div>
        );
      },
    },
    {
      id: 'expand',
      label: 'Expandir',
      header: () => (
        <div className='flex justify-center'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-10 w-10 rounded-xl text-primary hover:bg-primary/10 hover:text-primary'
                onClick={toggleAllRows}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${
                    expandedRows.size > 0 ? 'rotate-180' : ''
                  }`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {expandedRows.size > 0 ? 'Recolher todos' : 'Expandir todos'}
            </TooltipContent>
          </Tooltip>
        </div>
      ),
      cell: ({ row }) => {
        const isExpanded = expandedRows.has(row.id);
        return (
          <div className='flex justify-center'>
            <Button
              variant='ghost'
              size='icon'
              className='h-10 w-10 rounded-xl text-primary hover:bg-primary/10 hover:text-primary'
              onClick={() => toggleRowExpansion(row.id)}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-300 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </TooltipTrigger>
                <TooltipContent>{isExpanded ? 'Recolher' : 'Expandir'}</TooltipContent>
              </Tooltip>
            </Button>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      size: 50,
      minSize: 40,
      maxSize: 60,
    },
  ];

  const renderRouteActions = (route: RouteWithFarmAndCustomer) => (
    <div className='flex items-center gap-2'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='outline'
            size='icon'
            className='h-9 w-9 rounded-xl border-border/70 bg-card text-primary shadow-none hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
            onClick={() => handleEditClick(route)}
          >
            <Pencil className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Editar rota</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='outline'
            size='icon'
            className='h-9 w-9 rounded-xl border-destructive/30 bg-card text-destructive shadow-none hover:bg-destructive/10'
            disabled={isDeletingRoute}
            onClick={() => handleDeleteClick(route)}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Excluir rota</TooltipContent>
      </Tooltip>
    </div>
  );

  const renderExpandedRow = (group: RouteFarmGroup) => {
    const selectedRouteId = selectedRouteByFarmId[group.farmId] ?? group.routes[0]?.id;
    const selectedRoute =
      group.routes.find((route) => route.id === selectedRouteId) ?? group.routes[0] ?? null;
    const selectedRouteStats = selectedRoute ? getRouteStats(selectedRoute) : null;
    const geoJson = buildFarmRoutesFeatureCollection(group.routes);

    return (
      <div className='border-l-4 border-primary/20 bg-primary/5'>
        <div className='space-y-5 p-6'>
          <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
            <div className='flex items-start gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                <RouteIcon className='h-5 w-5' />
              </div>
              <div>
                <h3 className='text-lg font-semibold text-foreground'>
                  Rotas da Fazenda {group.farmName}
                </h3>
                <p className='text-sm text-muted-foreground'>
                  Escolha pelo desenho no mapa. O nome da rota fica como apoio.
                </p>
              </div>
            </div>
            <Badge variant='outline' className='w-fit border-primary/20 bg-primary/10 text-primary'>
              {group.routeCount}{' '}
              {group.routeCount === 1 ? 'rota cadastrada' : 'rotas cadastradas'}
            </Badge>
          </div>

          <div className='grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]'>
            <div
              className='overflow-hidden rounded-2xl border border-border/60 shadow-[0_10px_24px_rgba(15,23,42,0.05)]'
              style={{ height: '460px' }}
            >
              <MapViewer
                geoData={geoJson ?? undefined}
                selectedRouteId={selectedRoute?.id ?? null}
                onRouteClick={(routeId) => selectRouteInFarm(group.farmId, routeId)}
              />
            </div>

            <div className='rounded-2xl border border-border/60 bg-card p-4'>
              <div className='mb-4 flex items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-semibold text-foreground'>Rota selecionada</p>
                  <p className='text-xs text-muted-foreground'>Detalhes operacionais</p>
                </div>
                {selectedRoute ? renderRouteActions(selectedRoute) : null}
              </div>

              {selectedRoute && selectedRouteStats ? (
                <div className='space-y-3 text-sm'>
                  <div>
                    <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                      Nome auxiliar
                    </p>
                    <p className='font-semibold text-foreground'>{selectedRoute.name}</p>
                  </div>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='rounded-xl border border-border/60 bg-muted/30 p-3'>
                      <p className='text-xs text-muted-foreground'>Distancia</p>
                      <p className='font-semibold text-foreground'>
                        {formatDistanceMeters(selectedRouteStats.distanceMeters)}
                      </p>
                    </div>
                    <div className='rounded-xl border border-border/60 bg-muted/30 p-3'>
                      <p className='text-xs text-muted-foreground'>Pontos</p>
                      <p className='font-semibold text-foreground'>
                        {selectedRouteStats.pointCount.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {selectedRouteStats.sourceFileName ? (
                    <div>
                      <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                        Arquivo de origem
                      </p>
                      <p className='break-words text-foreground'>
                        {selectedRouteStats.sourceFileName}
                      </p>
                    </div>
                  ) : null}
                  {selectedRouteStats.externalId ? (
                    <div>
                      <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                        ID externo
                      </p>
                      <p className='break-all font-mono text-xs text-muted-foreground'>
                        {selectedRouteStats.externalId}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>Nenhuma rota selecionada.</p>
              )}
            </div>
          </div>

          <div className='rounded-2xl border border-border/60 bg-card p-4'>
            <div className='mb-3 flex items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-semibold text-foreground'>Lista auxiliar de rotas</p>
                <p className='text-xs text-muted-foreground'>
                  Use a lista como apoio quando o clique na linha nao for preciso.
                </p>
              </div>
            </div>
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {group.routes.map((route, index) => {
                const routeStats = getRouteStats(route);
                const isSelected = selectedRoute?.id === route.id;

                return (
                  <button
                    key={route.id}
                    type='button'
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5'
                    }`}
                    onClick={() => selectRouteInFarm(group.farmId, route.id)}
                  >
                    <div className='mb-2 flex items-start justify-between gap-2'>
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-foreground'>
                          {route.name || `Rota ${index + 1}`}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {formatDistanceMeters(routeStats.distanceMeters)}
                        </p>
                      </div>
                      {isSelected ? (
                        <Badge className='bg-primary text-primary-foreground'>Selecionada</Badge>
                      ) : null}
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-xs text-muted-foreground'>
                        {routeStats.pointCount.toLocaleString('pt-BR')} pontos
                      </span>
                      <span
                        className='h-2.5 w-8 rounded-full'
                        style={{ backgroundColor: ROUTE_COLORS[index % ROUTE_COLORS.length] }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className='w-full'>
      <Dialog open={!!routeToDelete} onOpenChange={(open) => !open && setRouteToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusao</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar a rota {routeToDelete?.name}? Esta acao nao pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRouteToDelete(null)}>
              Cancelar
            </Button>
            <Button variant='destructive' onClick={handleConfirmDelete} disabled={isDeletingRoute}>
              {isDeletingRoute ? 'Deletando...' : 'Deletar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {routeToEdit && (
        <DialogForm
          form={<FormEditRoute routeId={routeToEdit.id} closeDialog={handleCloseEditDialog} />}
          trigger={null}
          isOpen={isEditDialogOpen}
          setIsOpen={setIsEditDialogOpen}
          className='sm:max-w-5xl p-0'
        />
      )}

      <DataTable
        columns={columns}
        data={routesGroupedData?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() =>
          queryClient.invalidateQueries({
            queryKey: ['routes'],
          })
        }
        searchConfig={{
          placeholder: 'Buscar fazenda, cliente ou rota...',
          searchValue: inputSearchValue,
          onSearchChange: handleSearchChange,
        }}
        filters={
          <>
            {!initialCustomerId && (
              <SearchableSelectQuery
                options={allCustomers.map((customer: Customer) => ({
                  value: customer.id,
                  label: customer.name,
                }))}
                value={selectedCustomerId}
                onValueChange={(value) => handleCustomerChange(value as string | undefined)}
                placeholder='Todos os clientes'
                searchPlaceholder='Buscar cliente...'
                className={`${TABLE_FILTER_CLASS} w-[220px]`}
                clearable
                disabled={!!initialCustomerId}
                onSearchChange={(search) => {
                  setCustomerSearchValue(search);
                }}
                onScrollEnd={fetchNextCustomerPage}
                hasNextPage={hasNextCustomerPage}
                isFetchingNextPage={isFetchingNextCustomerPage}
                isLoading={isLoadingCustomers}
              />
            )}

            {!initialFarmId && (
              <SearchableSelectQuery
                options={allFarms.map((farm: Farm) => ({
                  value: farm.id,
                  label: farm.name,
                }))}
                value={selectedFarmId}
                onValueChange={(value) => handleFarmChange(value as string | undefined)}
                placeholder='Todas as fazendas'
                searchPlaceholder='Buscar fazenda...'
                className={`${TABLE_FILTER_CLASS} w-[220px]`}
                clearable
                disabled={!!initialFarmId}
                onSearchChange={(search) => {
                  setFarmSearchValue(search);
                }}
                onScrollEnd={fetchNextFarmPage}
                hasNextPage={hasNextFarmPage}
                isFetchingNextPage={isFetchingNextFarmPage}
                isLoading={isLoadingFarms}
              />
            )}

            <SearchableSelectQuery
              options={orderByOptions}
              value={orderBy}
              onValueChange={(value) => handleOrderByChange(value as RouteOrderBy | undefined)}
              placeholder='Ordenar por'
              searchPlaceholder='Buscar...'
              className={`${TABLE_FILTER_CLASS} w-[190px]`}
              clearable
            />

            <SearchableSelectQuery
              options={orderTypeOptions}
              value={orderType}
              onValueChange={(value) => handleOrderTypeChange(value as RouteOrderType | undefined)}
              placeholder='Ordenacao'
              searchPlaceholder='Buscar...'
              className={`${TABLE_FILTER_CLASS} w-[180px]`}
              clearable
            />
          </>
        }
        pagination={{
          manual: true,
          currentPage,
          pageSize,
          totalPages: routesGroupedData?.totalPages ?? 0,
          totalCount: routesGroupedData?.totalCount,
          onPageChange: setCurrentPage,
          onPageSizeChange: (newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1);
          },
        }}
        initialColumnVisibility={initialColumnVisibility}
        expandedRows={expandedRows}
        renderExpandedRow={renderExpandedRow}
        renderEmptyState={() => (
          <div className='py-8 text-center'>
            <div className='mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-muted'>
              <RouteIcon className='h-8 w-8 text-muted-foreground' />
            </div>
            <p className='text-muted-foreground'>Nenhuma fazenda com rotas encontrada</p>
          </div>
        )}
      />
    </div>
  );
}
