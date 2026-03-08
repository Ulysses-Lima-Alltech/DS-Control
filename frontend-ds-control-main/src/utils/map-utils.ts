import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapboxExpression = any;

export function convertDatabasePlotsToMapViewerPlotsFeatureCollection(
  geoData: Plot[],
  farms?: Farm[]
): GeoJSON.FeatureCollection {
  const formattedPlots: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  };

  // Create a map of farmId to farm name for quick lookup
  const farmMap = new Map<string, string>();
  if (farms) {
    farms.forEach(farm => {
      if (farm?.id && farm?.name) {
        farmMap.set(farm.id, farm.name);
      }
    });
  }

  geoData.forEach((plot) => {
    const plotFeatureCollection = plot.geoJson as GeoJSON.FeatureCollection;
    if (plotFeatureCollection.features && Array.isArray(plotFeatureCollection.features)) {
      // Add farm information to each feature
      const featuresWithFarmInfo = plotFeatureCollection.features.map(feature => ({
        ...feature,
        properties: {
          ...feature.properties,
          farm_name: plot.farmId ? farmMap.get(plot.farmId) || 'Unknown Farm' : 'Unknown Farm',
          farm_id: plot.farmId,
        }
      }));
      formattedPlots.features.push(...featuresWithFarmInfo);
    }
  });

  return formattedPlots;
}

/**
 * Creates a Mapbox expression to get a color property with fallback for invalid values
 * @param propertyName - The property name to get from feature properties
 * @param fallbackColor - The fallback color to use if property is invalid
 * @returns Mapbox expression array
 */
export function createColorPropertyExpression(
  propertyName: string,
  fallbackColor: string
): MapboxExpression {
  return [
    'case',
    [
      'any',
      ['==', ['get', propertyName], null],
      ['==', ['get', propertyName], ''],
      ['!', ['has', propertyName]],
    ],
    fallbackColor,
    ['get', propertyName],
  ];
}

/**
 * Creates a Mapbox expression to get an opacity property with fallback for invalid values
 * @param propertyName - The property name to get from feature properties
 * @param fallbackOpacity - The fallback opacity to use if property is invalid
 * @returns Mapbox expression array
 */
export function createOpacityPropertyExpression(
  propertyName: string,
  fallbackOpacity: number
): MapboxExpression {
  return [
    'case',
    [
      'any',
      ['==', ['get', propertyName], null],
      ['==', ['get', propertyName], ''],
      ['==', ['get', propertyName], 0],
      ['!', ['has', propertyName]],
    ],
    fallbackOpacity,
    ['get', propertyName],
  ];
}

/**
 * Creates a Mapbox expression for plot fill color with blue fallback
 * @returns Mapbox expression for fill color
 */
export function createPlotFillColorExpression(): MapboxExpression {
  return createColorPropertyExpression('fill', 'blue');
}

/**
 * Creates a Mapbox expression for plot fill opacity with 0.5 fallback
 * @returns Mapbox expression for fill opacity
 */
export function createPlotFillOpacityExpression(): MapboxExpression {
  return createOpacityPropertyExpression('fill-opacity', 0.5);
}

/**
 * Creates a Mapbox expression for plot stroke color with blue fallback
 * @returns Mapbox expression for stroke color
 */
export function createPlotStrokeColorExpression(): MapboxExpression {
  return createColorPropertyExpression('stroke', 'blue');
}

/**
 * Creates a condition to check if a plot is invalid (should be red)
 * @returns Mapbox expression for invalid plot condition
 */
export function createInvalidPlotCondition(): MapboxExpression {
  return [
    'any',
    ['==', ['get', 'plot_name'], ''],
    ['==', ['get', 'plot_name'], null],
    ['==', ['get', 'hectare'], ''],
    ['==', ['get', 'hectare'], null],
    ['==', ['get', 'hectare'], 0],
  ];
}

/**
 * Creates a complete paint expression for plot fill color with red/highlight/normal states
 * @param isHighlighted - Mapbox expression or boolean for highlight condition
 * @returns Complete Mapbox expression for fill color
 */
export function createPlotFillColorPaintExpression(
  isHighlighted: MapboxExpression | boolean
): MapboxExpression {
  return [
    'case',
    createInvalidPlotCondition(),
    'red',
    ['case', isHighlighted, 'yellow', createPlotFillColorExpression()],
  ];
}

/**
 * Creates a complete paint expression for plot fill opacity with red/highlight/normal states
 * @param isHighlighted - Mapbox expression or boolean for highlight condition
 * @returns Complete Mapbox expression for fill opacity
 */
export function createPlotFillOpacityPaintExpression(
  isHighlighted: MapboxExpression | boolean
): MapboxExpression {
  return [
    'case',
    createInvalidPlotCondition(),
    0.5,
    ['case', isHighlighted, 0.3, createPlotFillOpacityExpression()],
  ];
}

/**
 * Creates a complete paint expression for plot stroke color with red/highlight/normal states
 * @param isHighlighted - Mapbox expression or boolean for highlight condition
 * @returns Complete Mapbox expression for stroke color
 */
export function createPlotStrokeColorPaintExpression(
  isHighlighted: MapboxExpression | boolean
): MapboxExpression {
  return [
    'case',
    createInvalidPlotCondition(),
    'red',
    ['case', isHighlighted, 'yellow', createPlotStrokeColorExpression()],
  ];
}

/**
 * Creates a hover-aware paint expression for plot fill color
 * @param hoveredPlotId - The ID of the currently hovered plot
 * @param isHighlighted - Mapbox expression or boolean for highlight condition
 * @returns Complete Mapbox expression for hover-aware fill color
 */
export function createHoverPlotFillColorPaintExpression(
  hoveredPlotId: string,
  isHighlighted: MapboxExpression | boolean
): MapboxExpression {
  return [
    'case',
    ['==', ['get', 'plot_name'], hoveredPlotId],
    'yellow',
    createPlotFillColorPaintExpression(isHighlighted),
  ];
}

/**
 * Creates a hover-aware paint expression for plot fill opacity
 * @param hoveredPlotId - The ID of the currently hovered plot
 * @param isHighlighted - Mapbox expression or boolean for highlight condition
 * @returns Complete Mapbox expression for hover-aware fill opacity
 */
export function createHoverPlotFillOpacityPaintExpression(
  hoveredPlotId: string,
  isHighlighted: MapboxExpression | boolean
): MapboxExpression {
  return [
    'case',
    ['==', ['get', 'plot_name'], hoveredPlotId],
    0.8,
    createPlotFillOpacityPaintExpression(isHighlighted),
  ];
}

/**
 * Creates a hover-aware paint expression for plot stroke color
 * @param hoveredPlotId - The ID of the currently hovered plot
 * @param isHighlighted - Mapbox expression or boolean for highlight condition
 * @returns Complete Mapbox expression for hover-aware stroke color
 */
export function createHoverPlotStrokeColorPaintExpression(
  hoveredPlotId: string,
  isHighlighted: MapboxExpression | boolean
): MapboxExpression {
  return [
    'case',
    ['==', ['get', 'plot_name'], hoveredPlotId],
    'yellow',
    createPlotStrokeColorPaintExpression(isHighlighted),
  ];
}
