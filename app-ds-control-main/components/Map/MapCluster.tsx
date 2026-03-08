import { CircleLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import centroid from '@turf/centroid';

export default function MapCluster({ geoData }: { geoData: GeoJSON.FeatureCollection }) {
  const clusterConfigs = {
    plotsAmountLevel1: 100,
    plotsAmountLevel2: 1000,
    zoomLevelToCluster: 9,
    zoomLevelToShowSymbols: 12,
  };

  const getPlotCentroidsForClustering = (): GeoJSON.FeatureCollection | null => {
    if (!geoData || !geoData.features || geoData.features.length === 0) return null;

    const centroidFeatures: GeoJSON.Feature[] = [];

    geoData.features.forEach((feature) => {
      try {
        const centroidPoint = centroid(feature);
        centroidFeatures.push({
          type: 'Feature',
          geometry: centroidPoint.geometry,
          properties: {
            ...feature.properties,
            plot_count: 1,
          },
        });
      } catch (error) {
        console.warn('Error calculating centroid for feature:', error);
      }
    });

    return {
      type: 'FeatureCollection',
      features: centroidFeatures,
    };
  };

  const centroidsData = getPlotCentroidsForClustering();

  if (!centroidsData) return null;

  return (
    <ShapeSource id='plot-centroids-cluster' shape={centroidsData} cluster={true}>
      <CircleLayer
        id='plot-cluster-circles'
        filter={['has', 'point_count']}
        style={{
          circleColor: [
            'step',
            ['get', 'point_count'],
            '#FBBF24',
            clusterConfigs.plotsAmountLevel1,
            '#F59E0B',
            clusterConfigs.plotsAmountLevel2,
            '#B45309',
          ],
          circleRadius: [
            'step',
            ['get', 'point_count'],
            15,
            clusterConfigs.plotsAmountLevel1,
            25,
            clusterConfigs.plotsAmountLevel2,
            35,
          ],
          circleStrokeColor: '#000000',
          circleStrokeWidth: 2,
        }}
        maxZoomLevel={clusterConfigs.zoomLevelToCluster}
      />

      <SymbolLayer
        id='plot-cluster-count'
        filter={['has', 'point_count']}
        style={{
          textField: ['get', 'point_count_abbreviated'],
          textFont: ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          textSize: 12,
          textColor: '#000000',
        }}
        maxZoomLevel={clusterConfigs.zoomLevelToCluster}
      />

      <CircleLayer
        id='individual-plot-points'
        filter={['!', ['has', 'point_count']]}
        style={{
          circleRadius: 0,
          circleOpacity: 0,
        }}
      />
    </ShapeSource>
  );
}
