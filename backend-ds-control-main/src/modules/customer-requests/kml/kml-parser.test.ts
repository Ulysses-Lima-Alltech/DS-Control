import { describe, expect, it } from 'vitest';

import { KML_LIMITS, parseKml } from './kml-parser';

const polygon = (coordinates: string) => `
  <Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;

const kml = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
  <kml xmlns="http://www.opengis.net/kml/2.2"><Document>${body}</Document></kml>`;

const square = '-48.0000,-16.0000 -47.9990,-16.0000 -47.9990,-15.9990 -48.0000,-16.0000';

describe('secure KML parser', () => {
  it('parses Polygon and calculates hectares from geometry', () => {
    const result = parseKml(kml(`<Placemark><name>Talhão A</name>${polygon(square)}</Placemark>`));

    expect(result.plots).toHaveLength(1);
    expect(result.plots[0]?.geoJson.geometry.type).toBe('Polygon');
    expect(result.plots[0]?.calculatedAreaHa).toBeGreaterThan(0);
    expect(result.plots[0]?.normalizedName).toBe('talhao a');
  });

  it('supports multiple Placemarks and MultiGeometry as MultiPolygon', () => {
    const shifted = '-47.9000,-16.0000 -47.8990,-16.0000 -47.8990,-15.9990 -47.9000,-16.0000';
    const result = parseKml(
      kml(`
        <Placemark><name>A</name>${polygon(square)}</Placemark>
        <Placemark><name>B</name><MultiGeometry>${polygon(square)}${polygon(shifted)}</MultiGeometry></Placemark>
      `),
    );

    expect(result.plots).toHaveLength(2);
    expect(result.plots[1]?.geoJson.geometry.type).toBe('MultiPolygon');
  });

  it('uses a safe fallback when Placemark properties/name are absent', () => {
    const result = parseKml(kml(`<Placemark>${polygon(square)}</Placemark>`));
    expect(result.plots[0]?.suggestedName).toBe('Talhão 1');
  });

  it('ignores false hectare values from KML properties', () => {
    const result = parseKml(
      kml(`<Placemark><name>A</name><ExtendedData><Data name="hectares"><value>999999</value></Data></ExtendedData>${polygon(square)}</Placemark>`),
    );
    expect(result.plots[0]?.calculatedAreaHa).toBeLessThan(999999);
  });

  it('marks repeated normalized plot names without discarding geometry', () => {
    const result = parseKml(
      kml(`
        <Placemark><name>Talhão Á</name>${polygon(square)}</Placemark>
        <Placemark><name>  talhao a </name>${polygon(square)}</Placemark>
      `),
    );
    expect(result.plots.every((plot) => plot.validationErrors.length === 1)).toBe(true);
  });

  it.each([
    ['invalid longitude', '-181,-16 -47.9,-16 -47.9,-15.9 -181,-16'],
    ['invalid latitude', '-48,91 -47.9,-16 -47.9,-15.9 -48,91'],
    ['non numeric', 'x,-16 -47.9,-16 -47.9,-15.9 x,-16'],
    ['open ring', '-48,-16 -47.9,-16 -47.9,-15.9 -48,-15.9'],
  ])('rejects %s coordinates', (_label, coordinates) => {
    expect(() => parseKml(kml(`<Placemark>${polygon(coordinates)}</Placemark>`))).toThrow(
      'Nenhum polígono KML válido',
    );
  });

  it.each([
    '<!DOCTYPE kml [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><kml><Document/></kml>',
    '<!ENTITY xxe "boom"><kml><Document/></kml>',
  ])('blocks DTD and entity declarations', (xml) => {
    expect(() => parseKml(xml)).toThrow('DTD e entidades XML não são permitidos');
  });

  it('rejects invalid XML and non-KML content', () => {
    expect(() => parseKml('<kml><Document>')).toThrow('XML KML inválido');
    expect(() => parseKml('<xml><Placemark /></xml>')).toThrow('não é um documento KML');
  });

  it('rejects files above the configured byte limit', () => {
    const oversized = Buffer.alloc(KML_LIMITS.maxBytes + 1, 0x20);
    expect(() => parseKml(oversized)).toThrow('excede 15 MB');
  });

  it('rejects XML nesting beyond the configured limit', () => {
    const nested = `${'<Folder>'.repeat(KML_LIMITS.maxXmlDepth + 1)}<Placemark>${polygon(square)}</Placemark>${'</Folder>'.repeat(KML_LIMITS.maxXmlDepth + 1)}`;
    expect(() => parseKml(kml(nested))).toThrow();
  });

  it('reports an invalid feature while preserving valid Placemarks', () => {
    const result = parseKml(
      kml(`
        <Placemark><name>Valid</name>${polygon(square)}</Placemark>
        <Placemark><name>Point only</name><Point><coordinates>-48,-16</coordinates></Point></Placemark>
      `),
    );
    expect(result.plots).toHaveLength(1);
    expect(result.featureErrors).toEqual([
      expect.objectContaining({ sourceFeatureIndex: 1, suggestedName: 'Point only' }),
    ]);
  });
});
