'use client';

import { Check, Loader2, Upload, X } from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import type {
  ApiResponse as RouteApiResponse,
  ConvertedRouteData,
} from '@/app/api/file-converter-route/route';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConvertKmlToGeoJson } from '@/mutations/file.mutation';

type InputRouteFileProps = {
  changeGeoJson?: (geojson: Record<string, unknown>) => void;
  setConvertErrors: (errors: string[]) => void;
  setFileName: (fileName: string) => void;
  onConvertedRoutes?: (routes: ConvertedRouteData[]) => void;
  multiple?: boolean;
};

function buildPreviewFeatureCollection(routes: ConvertedRouteData[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: routes.flatMap((route) => {
      if (route.geoJson?.type !== 'FeatureCollection' || !Array.isArray(route.geoJson.features)) {
        return [];
      }

      return route.geoJson.features.map((feature) => ({
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          route_name: route.name,
          source_file_name: route.sourceFileName,
          source_file: route.sourceFileName,
          external_id: route.externalId,
          externalId: route.externalId,
          point_count: route.pointCount,
          distance_meters: route.distanceMeters,
          start: route.start,
          end: route.end,
        },
      }));
    }),
  };
}

function formatRouteErrors(result: RouteApiResponse) {
  return result.errors.map((error) =>
    error.fileName ? `${error.fileName}: ${error.message}` : error.message
  );
}

export default function InputRouteFile({
  changeGeoJson,
  setConvertErrors,
  setFileName,
  onConvertedRoutes,
  multiple = false,
}: InputRouteFileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);

  const status: Record<string, React.ReactNode> = {
    none: <Upload className='text-gray-500' size={20} />,
    converting: (
      <div className='flex items-center justify-center'>
        <Loader2 className='animate-spin text-blue-500' size={20} />
      </div>
    ),
    converted: <Check className='text-green-500' size={20} />,
    error: <X className='text-red-500' size={20} />,
  };
  const [fileStatus, setFileStatus] = useState<keyof typeof status>('none');

  const { mutate: convertKmlToGeoJson, isPending: isConvertingKmlToGeoJson } =
    useConvertKmlToGeoJson<RouteApiResponse>({
      onSuccess: async (result: RouteApiResponse) => {
        const formattedErrors = formatRouteErrors(result);
        setConvertErrors(formattedErrors);
        onConvertedRoutes?.(result.routes);

        if (result.routes.length === 0) {
          changeGeoJson?.({ type: 'FeatureCollection', features: [] });
          setFileStatus('error');
          toast('Nenhuma rota válida encontrada nos arquivos KML');
          return;
        }

        try {
          const routeGeoJson = buildPreviewFeatureCollection(result.routes);
          changeGeoJson?.(routeGeoJson as unknown as Record<string, unknown>);
        } catch {
          toast('Erro ao tentar processar o arquivo', {
            description: 'Erro ao tentar converter KML para rota',
          });
        }

        setFileName(result.routes[0]?.name || selectedFileNames[0]?.replace(/\.kml$/i, '') || '');
        setFileStatus('converted');

        if (formattedErrors.length > 0) {
          toast(`${result.routes.length} rota(s) convertida(s); revise os erros encontrados.`);
          return;
        }

        toast(
          result.routes.length === 1
            ? 'Rota convertida com sucesso'
            : `${result.routes.length} rotas convertidas com sucesso`
        );
      },
      onError: (error: Error) => {
        toast(error.message);
        setFileStatus('error');
        onConvertedRoutes?.([]);
      },
    });

  const handleDivClick = () => {
    if (!isConvertingKmlToGeoJson) {
      fileInputRef.current?.click();
    }
  };

  const selectedFilesLabel =
    selectedFileNames.length === 1
      ? selectedFileNames[0]
      : `${selectedFileNames.length} arquivos selecionados`;

  return (
    <div className='space-y-3 cursor-pointer'>
      <Input
        ref={fileInputRef}
        type='file'
        className='hidden'
        disabled={isConvertingKmlToGeoJson}
        accept='.kml'
        multiple={multiple}
        onChange={async (e) => {
          const selectedFiles = Array.from(e.target.files ?? []);
          setFileStatus('converting');
          setConvertErrors([]);
          onConvertedRoutes?.([]);
          toast(
            selectedFiles.length > 1
              ? `Convertendo ${selectedFiles.length} KMLs para rotas...`
              : 'Convertendo KML para rota...'
          );

          if (selectedFiles.length === 0 || selectedFiles.every((file) => file.size === 0)) {
            toast('Arquivo KML não selecionado');
            setFileStatus('error');
            setConvertErrors(['Arquivo KML não selecionado']);
            return;
          }

          setSelectedFileNames(selectedFiles.map((file) => file.name));

          if (multiple) {
            convertKmlToGeoJson({ files: selectedFiles, type: 'route' });
            return;
          }

          convertKmlToGeoJson({ file: selectedFiles[0], type: 'route' });
        }}
      />

      {selectedFileNames.length === 0 ? (
        <div
          className='border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer'
          onClick={handleDivClick}
        >
          <Upload className='h-8 w-8 text-gray-400 mx-auto mb-2' />
          <div className='text-sm text-gray-600 mb-2'>
            {multiple
              ? 'Selecione um ou mais arquivos KML'
              : 'Clique para fazer upload ou arraste o arquivo aqui'}
          </div>
          <Label className='inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer'>
            {multiple ? 'Selecionar arquivos KML' : 'Selecionar arquivo KML'}
          </Label>
        </div>
      ) : (
        <div
          className='flex items-start justify-between gap-3 p-3 border rounded-lg bg-gray-50'
          onClick={handleDivClick}
        >
          <div className='flex items-start space-x-3 min-w-0'>
            <div className='mt-0.5'>{status[fileStatus]}</div>
            <div className='min-w-0'>
              <div className='text-sm font-medium text-gray-900'>{selectedFilesLabel}</div>
              <div className='text-xs text-gray-500'>
                {fileStatus === 'converting' && 'Processando arquivo(s)...'}
                {fileStatus === 'converted' && 'Arquivo(s) processado(s) com sucesso'}
                {fileStatus === 'error' && 'Erro no processamento'}
                {fileStatus === 'none' && 'Aguardando processamento'}
              </div>
              {selectedFileNames.length > 1 && (
                <div className='mt-2 space-y-1 text-xs text-gray-600'>
                  {selectedFileNames.slice(0, 4).map((fileName) => (
                    <div key={fileName} className='truncate'>
                      {fileName}
                    </div>
                  ))}
                  {selectedFileNames.length > 4 && (
                    <div>+ {selectedFileNames.length - 4} arquivo(s)</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
