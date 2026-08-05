import area from '@turf/area';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const KML_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  maxFeatures: 2_000,
  maxCoordinates: 200_000,
  maxXmlDepth: 64,
  maxParseMilliseconds: 5_000,
} as const;

export type ParsedKmlPlot = {
  sourceFeatureIndex: number;
  suggestedName: string;
  normalizedName: string;
  geoJson: Feature<Polygon | MultiPolygon>;
  calculatedAreaHa: number;
  validationErrors: string[];
};

export type KmlFeatureError = {
  sourceFeatureIndex: number;
  suggestedName: string;
  errors: string[];
};

export type KmlParseResult = {
  plots: ParsedKmlPlot[];
  featureErrors: KmlFeatureError[];
  totalCoordinates: number;
};

export class KmlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KmlValidationError';
  }
}

type XmlNode = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (isRecord(value) && typeof value['#text'] === 'string') return value['#text'].trim();
  return undefined;
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

function collectPlacemarks(root: unknown, deadline: number): XmlNode[] {
  const placemarks: XmlNode[] = [];
  const stack: unknown[] = [root];
  let visited = 0;

  while (stack.length > 0) {
    if (Date.now() > deadline) throw new KmlValidationError('Tempo limite de parsing excedido');
    if (++visited > 100_000) throw new KmlValidationError('Estrutura XML excede o limite seguro');

    const current = stack.pop();
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    if (!isRecord(current)) continue;

    for (const [key, value] of Object.entries(current)) {
      if (key === 'Placemark') {
        for (const placemark of asArray(value)) {
          if (isRecord(placemark)) placemarks.push(placemark);
        }
        if (placemarks.length > KML_LIMITS.maxFeatures) {
          throw new KmlValidationError('KML excede o limite de features');
        }
      } else {
        stack.push(value);
      }
    }
  }

  return placemarks;
}

function parseCoordinates(raw: unknown): Position[] {
  const value = textValue(raw);
  if (!value) throw new KmlValidationError('Anel sem coordenadas');

  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((tuple) => {
      const parts = tuple.split(',');
      if (parts.length < 2) throw new KmlValidationError('Coordenada KML inválida');
      const longitude = Number(parts[0]);
      const latitude = Number(parts[1]);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        throw new KmlValidationError('Coordenada KML não numérica');
      }
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        throw new KmlValidationError('Coordenada fora dos limites de longitude/latitude');
      }
      return [longitude, latitude];
    });
}

function samePosition(first: Position, last: Position): boolean {
  return first[0] === last[0] && first[1] === last[1];
}

function parseRing(boundary: unknown): Position[] {
  if (!isRecord(boundary)) throw new KmlValidationError('Limite de polígono inválido');
  const linearRing = boundary.LinearRing;
  if (!isRecord(linearRing)) throw new KmlValidationError('LinearRing ausente');
  const coordinates = parseCoordinates(linearRing.coordinates);
  if (coordinates.length < 4)
    throw new KmlValidationError('Anel deve possuir ao menos quatro posições');
  if (!samePosition(coordinates[0]!, coordinates[coordinates.length - 1]!)) {
    throw new KmlValidationError('Anel de polígono não está fechado');
  }
  return coordinates;
}

function parsePolygon(node: unknown): Position[][] {
  if (!isRecord(node)) throw new KmlValidationError('Polygon inválido');
  const outer = asArray(node.outerBoundaryIs)[0];
  const rings = [parseRing(outer)];
  for (const inner of asArray(node.innerBoundaryIs)) rings.push(parseRing(inner));
  return rings;
}

function polygonNodes(placemark: XmlNode): unknown[] {
  const direct = asArray(placemark.Polygon);
  const multiGeometry = placemark.MultiGeometry;
  if (!isRecord(multiGeometry)) return direct;
  return [...direct, ...asArray(multiGeometry.Polygon)];
}

function buildFeature(placemark: XmlNode, name: string): Feature<Polygon | MultiPolygon> {
  const nodes = polygonNodes(placemark);
  if (nodes.length === 0)
    throw new KmlValidationError('Placemark não contém Polygon ou MultiPolygon');
  const polygons = nodes.map(parsePolygon);
  const geometry: Polygon | MultiPolygon =
    polygons.length === 1
      ? { type: 'Polygon', coordinates: polygons[0]! }
      : { type: 'MultiPolygon', coordinates: polygons };
  return { type: 'Feature', properties: { name }, geometry };
}

function coordinateCount(feature: Feature<Polygon | MultiPolygon>): number {
  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  return polygons.reduce(
    (total, polygon) => total + polygon.reduce((ringTotal, ring) => ringTotal + ring.length, 0),
    0,
  );
}

export function parseKml(input: Buffer | string): KmlParseResult {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  if (buffer.byteLength === 0) throw new KmlValidationError('Arquivo KML vazio');
  if (buffer.byteLength > KML_LIMITS.maxBytes)
    throw new KmlValidationError('Arquivo KML excede 15 MB');

  const xml = buffer.toString('utf8');
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) {
    throw new KmlValidationError('DTD e entidades XML não são permitidos');
  }
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<kml(?:\s|>)/i.test(xml)) {
    throw new KmlValidationError('Conteúdo não é um documento KML válido');
  }

  const validation = XMLValidator.validate(xml, { allowBooleanAttributes: false });
  if (validation !== true) throw new KmlValidationError('XML KML inválido');

  const deadline = Date.now() + KML_LIMITS.maxParseMilliseconds;
  const parser = new XMLParser({
    removeNSPrefix: true,
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
    processEntities: false,
    maxNestedTags: KML_LIMITS.maxXmlDepth,
  });
  const document = parser.parse(xml) as unknown;
  const placemarks = collectPlacemarks(document, deadline);
  if (placemarks.length === 0) throw new KmlValidationError('KML não contém Placemarks');

  const plots: ParsedKmlPlot[] = [];
  const featureErrors: KmlFeatureError[] = [];
  let totalCoordinates = 0;

  for (const [sourceFeatureIndex, placemark] of placemarks.entries()) {
    if (Date.now() > deadline) throw new KmlValidationError('Tempo limite de parsing excedido');
    const suggestedName = textValue(placemark.name) || `Talhão ${sourceFeatureIndex + 1}`;
    try {
      const geoJson = buildFeature(placemark, suggestedName);
      totalCoordinates += coordinateCount(geoJson);
      if (totalCoordinates > KML_LIMITS.maxCoordinates) {
        throw new KmlValidationError('KML excede o limite de coordenadas');
      }
      plots.push({
        sourceFeatureIndex,
        suggestedName,
        normalizedName: normalizeName(suggestedName),
        geoJson,
        calculatedAreaHa: Number((area(geoJson) / 10_000).toFixed(4)),
        validationErrors: [],
      });
    } catch (error) {
      featureErrors.push({
        sourceFeatureIndex,
        suggestedName,
        errors: [error instanceof Error ? error.message : 'Feature KML inválida'],
      });
    }
  }

  const names = new Map<string, ParsedKmlPlot[]>();
  for (const plot of plots) {
    const group = names.get(plot.normalizedName) ?? [];
    group.push(plot);
    names.set(plot.normalizedName, group);
  }
  for (const group of names.values()) {
    if (group.length > 1) {
      for (const plot of group) plot.validationErrors.push('Nome de talhão repetido no arquivo');
    }
  }

  if (plots.length === 0) throw new KmlValidationError('Nenhum polígono KML válido foi encontrado');
  return { plots, featureErrors, totalCoordinates };
}
