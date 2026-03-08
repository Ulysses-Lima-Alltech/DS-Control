import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useState, useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import {
  ShapeSource,
  FillLayer,
  LineLayer,
  CircleLayer,
  SymbolLayer,
  MapView,
} from '@rnmapbox/maps';
import area from '@turf/area';
import length from '@turf/length';
import { lineString, polygon } from '@turf/turf';
import { usePathname } from 'expo-router';

export type ToolData = {
  distanceTool: {
    isActive: boolean;
    points: number[][];
    distance: number;
  };
  areaTool: {
    isActive: boolean;
    points: number[][];
    area: number;
    isCompleted: boolean;
  };
};

type UndoAction =
  | { type: 'add_point'; toolType: 'distance' | 'area'; point: number[] }
  | { type: 'delete_point'; toolType: 'distance' | 'area'; point: number[]; index: number }
  | {
      type: 'move_point';
      toolType: 'distance' | 'area';
      pointIndex: number;
      fromPoint: number[];
      toPoint: number[];
    };

export type MapToolsHookReturn = {
  toolData: ToolData;
  draggedPointIndex: number | null;
  draggedToolType: 'distance' | 'area' | null;
  isSomeToolActive: boolean;
  undoQueue: UndoAction[];
  // Functions
  handleToggleDistanceTool: () => void;
  handleToggleAreaTool: () => void;
  handleClearDistance: () => void;
  handleClearArea: () => void;
  handleUndo: () => void;
  handleDeletePoint: () => void;
  handleMapPress: (coordinates: number[]) => void;
  handleTouchMove: (event: any, mapRef: React.RefObject<MapView>) => void;
  handleTouchEnd: () => void;
  handlePlusPointClick: (
    segmentIndex: number,
    toolType: 'distance' | 'area',
    coordinates: number[]
  ) => void;
  handlePointPress: (pointIndex: number, toolType: 'distance' | 'area') => void;
  // Layers
  getToolLayers: () => React.ReactElement[];
};

export type MapToolsProps = {
  toolsHookReturn: MapToolsHookReturn;
};

// Custom hook for managing map tools logic
export const useMapTools = (): MapToolsHookReturn => {
  const [toolData, setToolData] = useState<ToolData>({
    distanceTool: { isActive: false, points: [], distance: 0 },
    areaTool: { isActive: false, points: [], area: 0, isCompleted: false },
  });

  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [draggedToolType, setDraggedToolType] = useState<'distance' | 'area' | null>(null);
  const [undoQueue, setUndoQueue] = useState<UndoAction[]>([]);
  const [dragStartPosition, setDragStartPosition] = useState<number[] | null>(null);

  const isSomeToolActive = toolData.distanceTool.isActive || toolData.areaTool.isActive;
  const isDraggingSomePoint = draggedPointIndex !== null;

  const formatDistance = useCallback((meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(2)} m`;
  }, []);

  const handleToggleDistanceTool = useCallback(() => {
    setToolData((prev) => ({
      distanceTool: {
        isActive: !prev.distanceTool.isActive,
        points: [],
        distance: 0,
      },
      areaTool: { isActive: false, points: [], area: 0, isCompleted: false },
    }));
  }, []);

  const handleToggleAreaTool = useCallback(() => {
    setToolData((prev) => ({
      areaTool: {
        isActive: !prev.areaTool.isActive,
        points: [],
        area: 0,
        isCompleted: false,
      },
      distanceTool: { isActive: false, points: [], distance: 0 },
    }));
  }, []);

  const handleClearDistance = useCallback(() => {
    setToolData((prev) => ({
      ...prev,
      distanceTool: { ...prev.distanceTool, points: [], distance: 0 },
    }));
  }, []);

  const handleClearArea = useCallback(() => {
    setToolData((prev) => ({
      ...prev,
      areaTool: { ...prev.areaTool, points: [], area: 0, isCompleted: false },
    }));
  }, []);

  const handleMapPress = useCallback(
    (coordinates: number[]) => {
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
        console.warn('Invalid coordinates in map press event:', coordinates);
        return;
      }

      if (isDraggingSomePoint) {
        return;
      }

      setToolData((prev) => {
        if (prev.distanceTool.isActive) {
          const newPoints = [...prev.distanceTool.points, coordinates];
          let distance = 0;

          if (newPoints.length > 1) {
            try {
              const line = lineString(newPoints);
              distance = length(line, { units: 'meters' });
            } catch (error) {
              console.warn('Error calculating distance:', error);
              distance = 0;
            }
          }

          setUndoQueue((prevQueue) => [
            ...prevQueue,
            {
              type: 'add_point',
              toolType: 'distance',
              point: coordinates,
            },
          ]);

          return {
            ...prev,
            distanceTool: { ...prev.distanceTool, points: newPoints, distance },
          };
        }

        if (prev.areaTool.isActive) {
          const newPoints = [...prev.areaTool.points, coordinates];
          let nextIsCompleted = prev.areaTool.isCompleted;
          let nextArea = prev.areaTool.area;

          if (newPoints.length >= 3) {
            try {
              const closed = [...newPoints, newPoints[0]];
              const poly = polygon([closed]);
              nextArea = area(poly) / 10000;
              nextIsCompleted = true;
            } catch (error) {
              console.warn('Error calculating area:', error);
              nextArea = 0;
              nextIsCompleted = false;
            }
          } else {
            nextArea = 0;
            nextIsCompleted = false;
          }

          setUndoQueue((prevQueue) => [
            ...prevQueue,
            {
              type: 'add_point',
              toolType: 'area',
              point: coordinates,
            },
          ]);

          return {
            ...prev,
            areaTool: {
              ...prev.areaTool,
              points: newPoints,
              area: nextArea,
              isCompleted: nextIsCompleted,
            },
          };
        }

        return prev;
      });
    },
    [draggedPointIndex]
  );

  const handleTouchMove = useCallback(
    (event: any, mapRef: React.RefObject<MapView>) => {
      if (draggedPointIndex === null || draggedToolType === null || !mapRef.current) return;

      // Try to get coordinates directly from the event first (similar to onPress)
      let coordinates = event?.geometry?.coordinates || event?.coordinates;

      if (coordinates && coordinates.length >= 2) {
        // Direct coordinates available, use them immediately
        updateToolDataWithCoordinates(coordinates);
        return;
      }

      // Fallback: try to get screen coordinates and convert them
      const touchPoint =
        event.nativeEvent?.locationX !== undefined && event.nativeEvent?.locationY !== undefined
          ? { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }
          : null;

      if (!touchPoint) {
        console.warn('Could not extract touch coordinates from event:', event);
        return;
      }

      mapRef.current
        .getCoordinateFromView([touchPoint.x, touchPoint.y])
        .then((convertedCoordinates: number[]) => {
          if (!convertedCoordinates || convertedCoordinates.length < 2) return;
          updateToolDataWithCoordinates(convertedCoordinates);
        })
        .catch((error) => {
          console.warn('Error converting coordinates:', error);
        });

      function updateToolDataWithCoordinates(coordinates: number[]) {
        setToolData((prev) => {
          if (draggedToolType === 'distance' && draggedPointIndex !== null) {
            const newPoints = [...prev.distanceTool.points];

            if (draggedPointIndex < 0 || draggedPointIndex >= newPoints.length) {
              return prev;
            }

            newPoints[draggedPointIndex] = coordinates;

            let distance = 0;
            if (newPoints.length > 1) {
              try {
                const line = lineString(newPoints);
                distance = length(line, { units: 'meters' });
              } catch (error) {
                console.warn('Error calculating distance:', error);
                distance = 0;
              }
            }

            return {
              ...prev,
              distanceTool: { ...prev.distanceTool, points: newPoints, distance },
            };
          } else if (draggedToolType === 'area' && draggedPointIndex !== null) {
            const newPoints = [...prev.areaTool.points];

            if (draggedPointIndex < 0 || draggedPointIndex >= newPoints.length) {
              return prev;
            }

            newPoints[draggedPointIndex] = coordinates;

            let nextArea = 0;
            let nextIsCompleted = false;
            if (newPoints.length >= 3) {
              try {
                const closed = [...newPoints, newPoints[0]];
                const poly = polygon([closed]);
                nextArea = area(poly) / 10000;
                nextIsCompleted = true;
              } catch (error) {
                console.warn('Error calculating area:', error);
                nextArea = 0;
                nextIsCompleted = false;
              }
            }

            return {
              ...prev,
              areaTool: {
                ...prev.areaTool,
                points: newPoints,
                area: nextArea,
                isCompleted: nextIsCompleted,
              },
            };
          }
          return prev;
        });
      }
    },
    [draggedPointIndex, draggedToolType]
  );

  const handleTouchEnd = useCallback(() => {
    if (isDraggingSomePoint && draggedToolType !== null && dragStartPosition !== null) {
      const currentPoint =
        draggedToolType === 'distance'
          ? toolData.distanceTool.points[draggedPointIndex]
          : toolData.areaTool.points[draggedPointIndex];

      if (
        currentPoint &&
        (currentPoint[0] !== dragStartPosition[0] || currentPoint[1] !== dragStartPosition[1])
      ) {
        setUndoQueue((prevQueue) => [
          ...prevQueue,
          {
            type: 'move_point',
            toolType: draggedToolType,
            pointIndex: draggedPointIndex,
            fromPoint: dragStartPosition,
            toPoint: [...currentPoint],
          },
        ]);
      }
    }

    setDraggedPointIndex(null);
    setDraggedToolType(null);
    setDragStartPosition(null);
  }, [draggedPointIndex, draggedToolType, dragStartPosition, toolData]);

  const handleDeletePoint = useCallback(() => {
    if (draggedPointIndex === null || draggedToolType === null) return;

    setToolData((prev) => {
      if (draggedToolType === 'distance') {
        const deletedPoint = prev.distanceTool.points[draggedPointIndex];
        const newPoints = [...prev.distanceTool.points];
        newPoints.splice(draggedPointIndex, 1);

        setUndoQueue((prevQueue) => [
          ...prevQueue,
          {
            type: 'delete_point',
            toolType: 'distance',
            point: deletedPoint,
            index: draggedPointIndex,
          },
        ]);

        let distance = 0;
        if (newPoints.length > 1) {
          try {
            const line = lineString(newPoints);
            distance = length(line, { units: 'meters' });
          } catch (error) {
            console.warn('Error calculating distance:', error);
            distance = 0;
          }
        }

        return {
          ...prev,
          distanceTool: { ...prev.distanceTool, points: newPoints, distance },
        };
      } else if (draggedToolType === 'area') {
        const deletedPoint = prev.areaTool.points[draggedPointIndex];
        const newPoints = [...prev.areaTool.points];
        newPoints.splice(draggedPointIndex, 1);

        setUndoQueue((prevQueue) => [
          ...prevQueue,
          {
            type: 'delete_point',
            toolType: 'area',
            point: deletedPoint,
            index: draggedPointIndex,
          },
        ]);

        let nextArea = 0;
        let nextIsCompleted = false;
        if (newPoints.length >= 3) {
          try {
            const closed = [...newPoints, newPoints[0]];
            const poly = polygon([closed]);
            nextArea = area(poly) / 10000;
            nextIsCompleted = true;
          } catch (error) {
            console.warn('Error calculating area:', error);
            nextArea = 0;
            nextIsCompleted = false;
          }
        }

        return {
          ...prev,
          areaTool: {
            ...prev.areaTool,
            points: newPoints,
            area: nextArea,
            isCompleted: nextIsCompleted,
          },
        };
      }
      return prev;
    });

    setDraggedPointIndex(null);
    setDraggedToolType(null);
  }, [draggedPointIndex, draggedToolType]);

  const handlePlusPointClick = useCallback(
    (segmentIndex: number, toolType: 'distance' | 'area', coordinates: number[]) => {
      setToolData((prev) => {
        if (toolType === 'distance') {
          const newPoints = [...prev.distanceTool.points];
          newPoints.splice(segmentIndex + 1, 0, coordinates);

          let distance = 0;
          if (newPoints.length > 1) {
            try {
              const line = lineString(newPoints);
              distance = length(line, { units: 'meters' });
            } catch (error) {
              console.warn('Error calculating distance:', error);
              distance = 0;
            }
          }

          setUndoQueue((prevQueue) => [
            ...prevQueue,
            {
              type: 'add_point',
              toolType: 'distance',
              point: coordinates,
            },
          ]);

          return {
            ...prev,
            distanceTool: { ...prev.distanceTool, points: newPoints, distance },
          };
        } else if (toolType === 'area') {
          const newPoints = [...prev.areaTool.points];
          newPoints.splice(segmentIndex + 1, 0, coordinates);

          let nextArea = 0;
          let nextIsCompleted = false;
          if (newPoints.length >= 3) {
            try {
              const closed = [...newPoints, newPoints[0]];
              const poly = polygon([closed]);
              nextArea = area(poly) / 10000;
              nextIsCompleted = true;
            } catch (error) {
              console.warn('Error calculating area:', error);
              nextArea = 0;
              nextIsCompleted = false;
            }
          }

          setUndoQueue((prevQueue) => [
            ...prevQueue,
            {
              type: 'add_point',
              toolType: 'area',
              point: coordinates,
            },
          ]);

          return {
            ...prev,
            areaTool: {
              ...prev.areaTool,
              points: newPoints,
              area: nextArea,
              isCompleted: nextIsCompleted,
            },
          };
        }
        return prev;
      });

      const newPointIndex = segmentIndex + 1;
      setDraggedPointIndex(newPointIndex);
      setDraggedToolType(toolType);
      setDragStartPosition([...coordinates]);
    },
    []
  );

  const handlePointPress = useCallback(
    (pointIndex: number, toolType: 'distance' | 'area') => {
      const originalPoint =
        toolType === 'distance'
          ? toolData.distanceTool.points[pointIndex]
          : toolData.areaTool.points[pointIndex];

      setDragStartPosition([...originalPoint]);
      setDraggedPointIndex(pointIndex);
      setDraggedToolType(toolType);
    },
    [toolData]
  );

  const handleUndo = useCallback(() => {
    if (undoQueue.length === 0) return;

    const lastAction = undoQueue[undoQueue.length - 1];

    setToolData((prev) => {
      if (lastAction.type === 'add_point') {
        if (lastAction.toolType === 'distance' && prev.distanceTool.isActive) {
          const newPoints = prev.distanceTool.points.slice(0, -1);
          let distance = 0;
          if (newPoints.length > 1) {
            try {
              const line = lineString(newPoints);
              distance = length(line, { units: 'meters' });
            } catch (error) {
              console.warn('Error calculating distance in undo:', error);
              distance = 0;
            }
          }
          return {
            ...prev,
            distanceTool: { ...prev.distanceTool, points: newPoints, distance },
          };
        } else if (lastAction.toolType === 'area' && prev.areaTool.isActive) {
          const newPoints = prev.areaTool.points.slice(0, -1);
          let nextArea = 0;
          let nextIsCompleted = false;
          if (newPoints.length >= 3) {
            try {
              const closed = [...newPoints, newPoints[0]];
              const poly = polygon([closed]);
              nextArea = area(poly) / 10000;
              nextIsCompleted = true;
            } catch (error) {
              console.warn('Error calculating area in undo:', error);
              nextArea = 0;
              nextIsCompleted = false;
            }
          }
          return {
            ...prev,
            areaTool: {
              ...prev.areaTool,
              points: newPoints,
              area: nextArea,
              isCompleted: nextIsCompleted,
            },
          };
        }
      } else if (lastAction.type === 'delete_point') {
        if (lastAction.toolType === 'distance' && prev.distanceTool.isActive) {
          const newPoints = [...prev.distanceTool.points];
          newPoints.splice(lastAction.index, 0, lastAction.point);

          let distance = 0;
          if (newPoints.length > 1) {
            try {
              const line = lineString(newPoints);
              distance = length(line, { units: 'meters' });
            } catch (error) {
              console.warn('Error calculating distance in undo:', error);
              distance = 0;
            }
          }
          return {
            ...prev,
            distanceTool: { ...prev.distanceTool, points: newPoints, distance },
          };
        } else if (lastAction.toolType === 'area' && prev.areaTool.isActive) {
          const newPoints = [...prev.areaTool.points];
          newPoints.splice(lastAction.index, 0, lastAction.point);

          let nextArea = 0;
          let nextIsCompleted = false;
          if (newPoints.length >= 3) {
            try {
              const closed = [...newPoints, newPoints[0]];
              const poly = polygon([closed]);
              nextArea = area(poly) / 10000;
              nextIsCompleted = true;
            } catch (error) {
              console.warn('Error calculating area in undo:', error);
              nextArea = 0;
              nextIsCompleted = false;
            }
          }
          return {
            ...prev,
            areaTool: {
              ...prev.areaTool,
              points: newPoints,
              area: nextArea,
              isCompleted: nextIsCompleted,
            },
          };
        }
      } else if (lastAction.type === 'move_point') {
        if (lastAction.toolType === 'distance' && prev.distanceTool.isActive) {
          const newPoints = [...prev.distanceTool.points];
          newPoints[lastAction.pointIndex] = lastAction.fromPoint;

          let distance = 0;
          if (newPoints.length > 1) {
            try {
              const line = lineString(newPoints);
              distance = length(line, { units: 'meters' });
            } catch (error) {
              console.warn('Error calculating distance in undo:', error);
              distance = 0;
            }
          }
          return {
            ...prev,
            distanceTool: { ...prev.distanceTool, points: newPoints, distance },
          };
        } else if (lastAction.toolType === 'area' && prev.areaTool.isActive) {
          const newPoints = [...prev.areaTool.points];
          newPoints[lastAction.pointIndex] = lastAction.fromPoint;

          let nextArea = 0;
          let nextIsCompleted = false;
          if (newPoints.length >= 3) {
            try {
              const closed = [...newPoints, newPoints[0]];
              const poly = polygon([closed]);
              nextArea = area(poly) / 10000;
              nextIsCompleted = true;
            } catch (error) {
              console.warn('Error calculating area in undo:', error);
              nextArea = 0;
              nextIsCompleted = false;
            }
          }
          return {
            ...prev,
            areaTool: {
              ...prev.areaTool,
              points: newPoints,
              area: nextArea,
              isCompleted: nextIsCompleted,
            },
          };
        }
      }

      return prev;
    });

    setUndoQueue((prevQueue) => prevQueue.slice(0, -1));
  }, [undoQueue]);

  // GeoJSON generation functions
  const getDistanceSegmentLabelsGeoJSON = useCallback(() => {
    const pts = toolData.distanceTool.points;
    if (pts.length < 2) return null;

    const features = [] as any[];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let segLenMeters = 0;
      try {
        segLenMeters = length(lineString([a, b]), { units: 'meters' });
      } catch (error) {
        console.warn('Error calculating segment length:', error);
        segLenMeters = 0;
      }
      features.push({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: mid },
        properties: { label: formatDistance(segLenMeters) },
      });
    }

    return { type: 'FeatureCollection' as const, features };
  }, [toolData.distanceTool.points, formatDistance]);

  const getDistancePlusPointsGeoJSON = useCallback(() => {
    const pts = toolData.distanceTool.points;
    if (pts.length < 2) return null;

    const features = [] as any[];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      features.push({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: mid },
        properties: {
          segmentIndex: i - 1,
          isPlusPoint: true,
        },
      });
    }

    return { type: 'FeatureCollection' as const, features };
  }, [toolData.distanceTool.points]);

  const getAreaSegmentLabelsGeoJSON = useCallback(() => {
    const pts = toolData.areaTool.points;
    if (pts.length < 2) return null;

    const pointsToUse = toolData.areaTool.isCompleted ? [...pts, pts[0]] : pts;
    if (pointsToUse.length < 2) return null;

    const features = [] as any[];
    for (let i = 1; i < pointsToUse.length; i++) {
      const a = pointsToUse[i - 1];
      const b = pointsToUse[i];
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let segLenMeters = 0;
      try {
        segLenMeters = length(lineString([a, b]), { units: 'meters' });
      } catch (error) {
        console.warn('Error calculating segment length:', error);
        segLenMeters = 0;
      }
      features.push({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: mid },
        properties: { label: formatDistance(segLenMeters) },
      });
    }

    return { type: 'FeatureCollection' as const, features };
  }, [toolData.areaTool.points, toolData.areaTool.isCompleted, formatDistance]);

  const getAreaPlusPointsGeoJSON = useCallback(() => {
    const pts = toolData.areaTool.points;
    if (pts.length < 2) return null;

    const features = [] as any[];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      features.push({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: mid },
        properties: {
          segmentIndex: i - 1,
          isPlusPoint: true,
        },
      });
    }

    if (toolData.areaTool.isCompleted && pts.length >= 3) {
      const a = pts[pts.length - 1];
      const b = pts[0];
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      features.push({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: mid },
        properties: {
          segmentIndex: pts.length - 1,
          isPlusPoint: true,
        },
      });
    }

    return { type: 'FeatureCollection' as const, features };
  }, [toolData.areaTool.points, toolData.areaTool.isCompleted]);

  const getDistanceLineGeoJSON = useCallback(() => {
    if (toolData.distanceTool.points.length < 2) return null;

    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: toolData.distanceTool.points,
          },
          properties: {},
        },
      ],
    };
  }, [toolData.distanceTool.points]);

  const getDistancePointsGeoJSON = useCallback(() => {
    if (toolData.distanceTool.points.length === 0) return null;

    return {
      type: 'FeatureCollection' as const,
      features: toolData.distanceTool.points.map((point, index) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: point,
        },
        properties: {
          index,
          isDragging: draggedPointIndex === index && draggedToolType === 'distance',
        },
      })),
    };
  }, [toolData.distanceTool.points, draggedPointIndex, draggedToolType]);

  const getAreaGeoJSON = useCallback(() => {
    if (toolData.areaTool.points.length < 3) return null;

    const coordinates = toolData.areaTool.isCompleted
      ? [...toolData.areaTool.points, toolData.areaTool.points[0]]
      : toolData.areaTool.points;

    if (toolData.areaTool.isCompleted) {
      return {
        polygon: {
          type: 'FeatureCollection' as const,
          features: [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'Polygon' as const,
                coordinates: [coordinates],
              },
              properties: {},
            },
          ],
        },
        line: null,
      };
    } else {
      return {
        polygon: null,
        line: {
          type: 'FeatureCollection' as const,
          features: [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'LineString' as const,
                coordinates: coordinates,
              },
              properties: {},
            },
          ],
        },
      };
    }
  }, [toolData.areaTool.points, toolData.areaTool.isCompleted]);

  const getAreaPointsGeoJSON = useCallback(() => {
    if (toolData.areaTool.points.length === 0) return null;

    return {
      type: 'FeatureCollection' as const,
      features: toolData.areaTool.points.map((point, index) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: point,
        },
        properties: {
          index,
          isDragging: draggedPointIndex === index && draggedToolType === 'area',
        },
      })),
    };
  }, [toolData.areaTool.points, draggedPointIndex, draggedToolType]);

  const getToolLayers = useCallback((): React.ReactElement[] => {
    const layers: React.ReactElement[] = [];

    // Distance tool layers
    const distanceLineGeoJSON = getDistanceLineGeoJSON();
    if (distanceLineGeoJSON) {
      layers.push(
        <ShapeSource
          key='distance-measurement'
          id='distance-measurement'
          shape={distanceLineGeoJSON}
        >
          <LineLayer
            id='distance-line'
            style={{
              lineColor: '#EAAE07',
              lineWidth: 3,
              lineDasharray: [2, 2],
            }}
          />
        </ShapeSource>
      );
    }

    const distancePointsGeoJSON = getDistancePointsGeoJSON();
    if (distancePointsGeoJSON) {
      layers.push(
        <ShapeSource
          key='distance-points'
          id='distance-points'
          shape={distancePointsGeoJSON}
          onPress={(event) => {
            if (event.features && event.features.length > 0) {
              const feature = event.features[0];
              const pointIndex = feature.properties?.index;
              if (pointIndex !== undefined) {
                handlePointPress(pointIndex, 'distance');
              }
            }
          }}
        >
          <CircleLayer
            id='distance-point-circles'
            style={{
              circleColor: ['case', ['get', 'isDragging'], '#EAAE07', '#EAAE07'],
              circleRadius: ['case', ['get', 'isDragging'], 30, 15],
              circleStrokeColor: '#FFFFFF',
              circleStrokeWidth: ['case', ['get', 'isDragging'], 3, 2],
              circleOpacity: ['case', ['get', 'isDragging'], 0.4, 0.9],
            }}
          />
        </ShapeSource>
      );
    }

    const distanceSegmentLabelsGeoJSON = getDistanceSegmentLabelsGeoJSON();
    if (distanceSegmentLabelsGeoJSON) {
      layers.push(
        <ShapeSource
          key='distance-segment-labels'
          id='distance-segment-labels'
          shape={distanceSegmentLabelsGeoJSON}
        >
          <SymbolLayer
            id='distance-segment-labels-layer'
            style={{
              textField: ['get', 'label'],
              textSize: 14,
              textColor: '#FFFFFF',
              textHaloColor: '#000000',
              textHaloWidth: 3,
              textAllowOverlap: true,
              textIgnorePlacement: true,
              textOffset: [0, -1.5],
              textAnchor: 'center',
              textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
              symbolZOrder: 'viewport-y',
              symbolSortKey: 999999,
            }}
          />
        </ShapeSource>
      );
    }

    const distancePlusPointsGeoJSON = getDistancePlusPointsGeoJSON();
    if (distancePlusPointsGeoJSON) {
      layers.push(
        <ShapeSource
          key='distance-plus-points'
          id='distance-plus-points'
          shape={distancePlusPointsGeoJSON}
          onPress={(event) => {
            if (event.features && event.features.length > 0) {
              const feature = event.features[0];
              const segmentIndex = feature.properties?.segmentIndex;
              const coordinates = (feature.geometry as any)?.coordinates;
              if (segmentIndex !== undefined && coordinates) {
                handlePlusPointClick(segmentIndex, 'distance', coordinates);
              }
            }
          }}
        >
          <CircleLayer
            id='distance-plus-points-circles'
            style={{
              circleColor: '#EAAE07',
              circleRadius: 8,
              circleStrokeColor: '#FFFFFF',
              circleStrokeWidth: 2,
              circleOpacity: 0.8,
            }}
          />
        </ShapeSource>
      );
    }

    // Area tool layers
    const areaGeoJSON = getAreaGeoJSON();
    if (areaGeoJSON?.polygon) {
      layers.push(
        <ShapeSource
          key='area-measurement-fill'
          id='area-measurement-fill'
          shape={areaGeoJSON.polygon}
        >
          <FillLayer
            id='area-fill'
            style={{
              fillColor: '#EAAE07',
              fillOpacity: 0.3,
            }}
          />
        </ShapeSource>
      );
    }

    if (areaGeoJSON?.line) {
      layers.push(
        <ShapeSource
          key='area-measurement-line'
          id='area-measurement-line'
          shape={areaGeoJSON.line}
        >
          <LineLayer
            id='area-line'
            style={{
              lineColor: '#EAAE07',
              lineWidth: 3,
              lineDasharray: [2, 2],
            }}
          />
        </ShapeSource>
      );
    }

    if (areaGeoJSON?.polygon) {
      layers.push(
        <ShapeSource
          key='area-measurement-outline'
          id='area-measurement-outline'
          shape={areaGeoJSON.polygon}
        >
          <LineLayer
            id='area-outline'
            style={{
              lineColor: '#EAAE07',
              lineWidth: 3,
              lineDasharray: [1],
            }}
          />
        </ShapeSource>
      );
    }

    const areaPointsGeoJSON = getAreaPointsGeoJSON();
    if (areaPointsGeoJSON) {
      layers.push(
        <ShapeSource
          key='area-points'
          id='area-points'
          shape={areaPointsGeoJSON}
          onPress={(event) => {
            if (event.features && event.features.length > 0) {
              const feature = event.features[0];
              const pointIndex = feature.properties?.index;
              if (pointIndex !== undefined) {
                handlePointPress(pointIndex, 'area');
              }
            }
          }}
        >
          <CircleLayer
            id='area-point-circles'
            style={{
              circleColor: ['case', ['get', 'isDragging'], '#EAAE07', '#EAAE07'],
              circleRadius: ['case', ['get', 'isDragging'], 30, 15],
              circleStrokeColor: '#FFFFFF',
              circleStrokeWidth: ['case', ['get', 'isDragging'], 3, 2],
              circleOpacity: ['case', ['get', 'isDragging'], 0.4, 0.9],
            }}
          />
        </ShapeSource>
      );
    }

    const areaSegmentLabelsGeoJSON = getAreaSegmentLabelsGeoJSON();
    if (areaSegmentLabelsGeoJSON) {
      layers.push(
        <ShapeSource
          key='area-segment-labels'
          id='area-segment-labels'
          shape={areaSegmentLabelsGeoJSON}
        >
          <SymbolLayer
            id='area-segment-labels-layer'
            style={{
              textField: ['get', 'label'],
              textSize: 14,
              textColor: '#FFFFFF',
              textHaloColor: '#000000',
              textHaloWidth: 3,
              textAllowOverlap: true,
              textIgnorePlacement: true,
              textOffset: [0, -1.5],
              textAnchor: 'center',
              textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
              symbolZOrder: 'viewport-y',
              symbolSortKey: 999999,
            }}
          />
        </ShapeSource>
      );
    }

    const areaPlusPointsGeoJSON = getAreaPlusPointsGeoJSON();
    if (areaPlusPointsGeoJSON) {
      layers.push(
        <ShapeSource
          key='area-plus-points'
          id='area-plus-points'
          shape={areaPlusPointsGeoJSON}
          onPress={(event) => {
            if (event.features && event.features.length > 0) {
              const feature = event.features[0];
              const segmentIndex = feature.properties?.segmentIndex;
              const coordinates = (feature.geometry as any)?.coordinates;
              if (segmentIndex !== undefined && coordinates) {
                handlePlusPointClick(segmentIndex, 'area', coordinates);
              }
            }
          }}
        >
          <CircleLayer
            id='area-plus-points-circles'
            style={{
              circleColor: '#EAAE07',
              circleRadius: 8,
              circleStrokeColor: '#FFFFFF',
              circleStrokeWidth: 2,
              circleOpacity: 0.8,
            }}
          />
        </ShapeSource>
      );
    }

    return layers;
  }, [
    getDistanceLineGeoJSON,
    getDistancePointsGeoJSON,
    getDistanceSegmentLabelsGeoJSON,
    getDistancePlusPointsGeoJSON,
    getAreaGeoJSON,
    getAreaPointsGeoJSON,
    getAreaSegmentLabelsGeoJSON,
    getAreaPlusPointsGeoJSON,
    handlePointPress,
    handlePlusPointClick,
  ]);

  return {
    toolData,
    draggedPointIndex,
    draggedToolType,
    isSomeToolActive,
    undoQueue,
    handleToggleDistanceTool,
    handleToggleAreaTool,
    handleClearDistance,
    handleClearArea,
    handleUndo,
    handleDeletePoint,
    handleMapPress,
    handleTouchMove,
    handleTouchEnd,
    handlePlusPointClick,
    handlePointPress,
    getToolLayers,
  };
};

const MapTools = React.forwardRef<any, MapToolsProps>(({ toolsHookReturn }, ref) => {
  const isMapFullScreen = usePathname().split('/')[2] === 'map';
  const {
    toolData,
    draggedPointIndex,
    undoQueue,
    handleToggleDistanceTool,
    handleToggleAreaTool,
    handleClearDistance,
    handleClearArea,
    handleUndo,
    handleDeletePoint,
  } = toolsHookReturn;

  const [isOpen, setIsOpen] = useState(false);

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(2)} m`;
  };

  const canUndo =
    toolData.distanceTool.points.length > 0 ||
    toolData.areaTool.points.length > 0 ||
    (undoQueue && undoQueue.length > 0);

  const handleMainButtonPress = () => {
    const hasDistance = toolData.distanceTool.points.length > 0;
    const hasArea = toolData.areaTool.points.length > 0;
    const isDistanceActive = toolData.distanceTool.isActive;
    const isAreaActive = toolData.areaTool.isActive;

    if (isDistanceActive && hasDistance) {
      handleClearDistance();
      return;
    }

    if (isAreaActive && hasArea) {
      handleClearArea();
      return;
    }

    if (!isDistanceActive && !isAreaActive && (hasDistance || hasArea)) {
      if (hasDistance) handleClearDistance();
      if (hasArea) handleClearArea();
      return;
    }

    setIsOpen(!isOpen);
    if (isOpen) {
      if (toolData.distanceTool.isActive) handleToggleDistanceTool();
      if (toolData.areaTool.isActive) handleToggleAreaTool();
    }
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: isMapFullScreen ? 70 : 9,
        left: 9,
        alignItems: 'center',
        zIndex: 2,
      }}
    >
      <TouchableOpacity
        style={[styles.mainButton, isOpen && styles.mainButtonActive]}
        onPress={handleMainButtonPress}
      >
        <Text style={[styles.mainButtonText, isOpen && styles.mainButtonTextActive]}>
          {isOpen ? (
            <FontAwesome name='close' size={18} color='white' />
          ) : (
            <FontAwesome5 name='tools' size={18} color='white' />
          )}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.toolsContainer}>
          <TouchableOpacity
            style={[styles.toolButton, toolData.distanceTool.isActive && styles.activeButton]}
            onPress={handleToggleDistanceTool}
          >
            <Text
              style={[styles.buttonText, toolData.distanceTool.isActive && styles.activeButtonText]}
            >
              <MaterialCommunityIcons name='tape-measure' size={18} color='white' />
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, toolData.areaTool.isActive && styles.activeButton]}
            onPress={handleToggleAreaTool}
          >
            <Text
              style={[styles.buttonText, toolData.areaTool.isActive && styles.activeButtonText]}
            >
              <FontAwesome6
                name='draw-polygon'
                size={18}
                color={toolData.areaTool.isActive ? 'white' : 'white'}
              />
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, !canUndo && styles.disabledButton]}
            onPress={handleUndo}
            disabled={!canUndo}
          >
            <Text style={styles.buttonText}>
              <Ionicons name='arrow-undo' size={18} color='white' />
            </Text>
          </TouchableOpacity>

          {draggedPointIndex !== null && handleDeletePoint && (
            <TouchableOpacity
              style={[styles.toolButton, styles.deleteButton]}
              onPress={handleDeletePoint}
            >
              <Text style={styles.buttonText}>
                <Ionicons name='trash' size={18} color='white' />
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {toolData.distanceTool.isActive && toolData.distanceTool.points.length > 0 && (
        <View style={styles.measurementInfo}>
          <Text style={styles.measurementText}>
            Distância: {formatDistance(toolData.distanceTool.distance)}
          </Text>
          <Text style={styles.hintText}>Toque e arraste os pontos para editar</Text>
        </View>
      )}

      {toolData.areaTool.isActive && toolData.areaTool.points.length > 0 && (
        <View style={styles.measurementInfo}>
          <Text style={styles.measurementText}>
            {toolData.areaTool.isCompleted
              ? `Área: ${toolData.areaTool.area.toFixed(2)} ha`
              : `Pontos: ${toolData.areaTool.points.length}`}
          </Text>
          <Text style={styles.hintText}>Toque e arraste os pontos para editar</Text>
        </View>
      )}
    </View>
  );
});

export default MapTools;

const styles = StyleSheet.create({
  mainButton: {
    width: 38,
    height: 38,
    borderRadius: 20,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  mainButtonActive: {
    backgroundColor: '#FF3B30',
  },
  mainButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  mainButtonTextActive: {
    color: '#fff',
  },
  toolsContainer: {
    marginTop: 15,
    alignItems: 'center',
  },
  toolButton: {
    width: 38,
    height: 38,
    borderRadius: 20,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  disabledButton: {
    opacity: 0.5,
  },
  activeButton: {
    backgroundColor: '#EAAE07',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    fontSize: 20,
  },
  activeButtonText: {
    color: '#fff',
  },
  measurementInfo: {
    position: 'absolute',
    top: 0,
    left: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 14,
    borderRadius: 10,
    minWidth: 200,
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 2,
  },
  measurementText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '700',
    flexWrap: 'nowrap',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  completeButton: {
    backgroundColor: '#EAAE07',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  hintText: {
    color: '#ccc',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
