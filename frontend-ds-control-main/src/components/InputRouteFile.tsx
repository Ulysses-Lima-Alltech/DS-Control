'use client';

import { Check, Loader2, Upload, X } from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import type { ApiResponse as RouteApiResponse } from '@/app/api/file-converter-route/route';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConvertKmlToGeoJson } from '@/mutations/file.mutation';

type InputRouteFileProps = {
  changeGeoJson: (geojson: Record<string, unknown>) => void;
  setConvertErrors: (errors: string[]) => void;
  setFileName: (fileName: string) => void;
};

export default function InputRouteFile({
  changeGeoJson,
  setConvertErrors,
  setFileName,
}: InputRouteFileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

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
        setConvertErrors(result.errors);
        setFileStatus('error');

        try {
          const routeGeoJson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: result.routes.flatMap((route) => {
              if (
                route.geoJson &&
                typeof route.geoJson === 'object' &&
                'features' in route.geoJson
              ) {
                return (route.geoJson as GeoJSON.FeatureCollection).features;
              }
              return [];
            }),
          };

          changeGeoJson(routeGeoJson as unknown as Record<string, unknown>);
        } catch {
          toast('Erro ao tentar processar o arquivo', {
            description: 'Erro ao tentar converter KML para rota',
          });
        }

        if (result.errors.length > 0) return;

        toast('Rota convertida com sucesso');
        setFileStatus('converted');
        setFileName(selectedFileName.split('.kml')[0]);
      },
      onError: (error: Error) => {
        toast(error.message);
        setFileStatus('error');
      },
    });

  const handleDivClick = () => {
    if (!isConvertingKmlToGeoJson) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className='space-y-3 cursor-pointer'>
      <Input
        ref={fileInputRef}
        type='file'
        className='hidden'
        disabled={isConvertingKmlToGeoJson}
        accept='.kml'
        onChange={async (e) => {
          setFileStatus('converting');
          toast('Convertendo KML para rota...');

          const kmlFile = e.target.files?.[0];

          if (!kmlFile || kmlFile.size === 0) {
            toast('Arquivo KML não selecionado');
            setFileStatus('error');
            return;
          }

          setSelectedFileName(kmlFile.name);
          convertKmlToGeoJson({ file: kmlFile, type: 'route' });
        }}
      />

      {!selectedFileName ? (
        <div
          className='border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer'
          onClick={handleDivClick}
        >
          <Upload className='h-8 w-8 text-gray-400 mx-auto mb-2' />
          <div className='text-sm text-gray-600 mb-2'>
            Clique para fazer upload ou arraste o arquivo aqui
          </div>
          <Label className='inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer'>
            Selecionar arquivo KML
          </Label>
        </div>
      ) : (
        <div
          className='flex items-center justify-between p-3 border rounded-lg bg-gray-50'
          onClick={handleDivClick}
        >
          <div className='flex items-center space-x-3'>
            {status[fileStatus]}
            <div>
              <div className='text-sm font-medium text-gray-900'>{selectedFileName}</div>
              <div className='text-xs text-gray-500'>
                {fileStatus === 'converting' && 'Processando arquivo...'}
                {fileStatus === 'converted' && 'Arquivo processado com sucesso'}
                {fileStatus === 'error' && 'Erro no processamento'}
                {fileStatus === 'none' && 'Aguardando processamento'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
