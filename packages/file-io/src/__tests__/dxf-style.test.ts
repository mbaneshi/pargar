import { describe, it, expect } from 'vitest';
import { parseDxf, parseDxfFull } from '../dxf-import';
import { exportDxf } from '../dxf-export';

const TEST_DXF = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LTYPE
70
3
0
LTYPE
2
CONTINUOUS
70
0
3
Solid line
72
65
73
0
40
0.0
0
LTYPE
2
HIDDEN
70
0
3
_ _ _ _ _
72
65
73
2
40
0.375
49
0.25
49
-0.125
0
LTYPE
2
CENTER
70
0
3
___ _ ___ _ ___
72
65
73
4
40
2.0
49
1.25
49
-0.25
49
0.25
49
-0.25
0
ENDTAB
0
TABLE
2
LAYER
70
3
0
LAYER
2
RED_LAYER
70
0
62
1
6
CONTINUOUS
0
LAYER
2
GREEN_LAYER
70
0
62
3
6
HIDDEN
0
LAYER
2
BLUE_LAYER
70
0
62
5
6
CENTER
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
RED_LAYER
10
0.0
20
0.0
30
0.0
11
10.0
21
0.0
31
0.0
0
LINE
8
GREEN_LAYER
10
0.0
20
5.0
30
0.0
11
10.0
21
5.0
31
0.0
0
LINE
8
BLUE_LAYER
10
0.0
20
10.0
30
0.0
11
10.0
21
10.0
31
0.0
0
TEXT
8
RED_LAYER
10
0.0
20
-2.0
30
0.0
40
2.5
1
Red text
0
TEXT
8
GREEN_LAYER
10
0.0
20
-5.0
30
0.0
40
2.5
1
Green text
0
TEXT
8
BLUE_LAYER
10
0.0
20
-8.0
30
0.0
40
2.5
1
Blue text
0
LINE
8
RED_LAYER
62
5
10
20.0
20
0.0
30
0.0
11
30.0
21
0.0
31
0.0
0
ENDSEC
0
EOF`;

describe('DXF style pipeline', () => {
  describe('parseDxfFull — layer table parsing', () => {
    it('reads layer definitions from dxf.tables.layer', () => {
      const result = parseDxfFull(TEST_DXF);
      expect(result.layers.length).toBeGreaterThanOrEqual(3);

      const red = result.layers.find((l) => l.name === 'RED_LAYER');
      const green = result.layers.find((l) => l.name === 'GREEN_LAYER');
      const blue = result.layers.find((l) => l.name === 'BLUE_LAYER');

      expect(red).toBeDefined();
      expect(green).toBeDefined();
      expect(blue).toBeDefined();

      expect(red!.color).toBe('#ff0000');
      expect(green!.color).toBe('#00ff00');
      expect(blue!.color).toBe('#0000ff');
    });

    it('reads layer linetypes', () => {
      const result = parseDxfFull(TEST_DXF);

      const green = result.layers.find((l) => l.name === 'GREEN_LAYER');
      const blue = result.layers.find((l) => l.name === 'BLUE_LAYER');

      expect(green!.linetype).toBe('HIDDEN');
      expect(blue!.linetype).toBe('CENTER');
    });
  });

  describe('parseDxfFull — entity color/linetype', () => {
    it('preserves layer colors on entities', () => {
      const result = parseDxfFull(TEST_DXF);
      const lines = result.entities.filter((e) => e.type === 'line');

      const redLine = lines.find((e) => e.layer === 'RED_LAYER' && !e.geometry.Line.start.x);
      const greenLine = lines.find((e) => e.layer === 'GREEN_LAYER');
      const blueLine = lines.find((e) => e.layer === 'BLUE_LAYER');

      expect(redLine).toBeDefined();
      expect(redLine!.color).toBe('#ff0000');
      expect(greenLine!.color).toBe('#00ff00');
      expect(blueLine!.color).toBe('#0000ff');
    });

    it('entity-level color overrides layer color', () => {
      const result = parseDxfFull(TEST_DXF);
      // The last LINE on RED_LAYER has entity color 5 (blue)
      const overrideLine = result.entities.find(
        (e) => e.type === 'line' && e.layer === 'RED_LAYER' && e.geometry.Line.start.x === 20,
      );
      expect(overrideLine).toBeDefined();
      expect(overrideLine!.color).toBe('#0000ff');
    });

    it('preserves text entities on different layers', () => {
      const result = parseDxfFull(TEST_DXF);
      const texts = result.entities.filter((e) => e.type === 'text');

      expect(texts.length).toBe(3);
      const redText = texts.find((e) => e.layer === 'RED_LAYER');
      const greenText = texts.find((e) => e.layer === 'GREEN_LAYER');
      const blueText = texts.find((e) => e.layer === 'BLUE_LAYER');

      expect(redText!.color).toBe('#ff0000');
      expect(greenText!.color).toBe('#00ff00');
      expect(blueText!.color).toBe('#0000ff');
    });
  });

  describe('parseDxf — backward compatibility', () => {
    it('returns flat entity array', () => {
      const entities = parseDxf(TEST_DXF);
      expect(Array.isArray(entities)).toBe(true);
      expect(entities.length).toBe(7);
      expect(entities[0].layer).toBeDefined();
    });
  });

  describe('export → import round-trip', () => {
    it('colors survive round-trip', () => {
      const imported = parseDxfFull(TEST_DXF);

      // Build export-compatible entities (with layer field for name resolution)
      const exportEntities = imported.entities.map((e) => ({
        ...e,
        layer_id: e.layer,
      }));
      const exportLayers = imported.layers.map((l) => ({
        id: l.name,
        name: l.name,
        color: l.color || '#ffffff',
        visible: true,
        locked: false,
        linetype: l.linetype,
      }));

      const dxfOutput = exportDxf(JSON.stringify(exportEntities), JSON.stringify(exportLayers));

      expect(dxfOutput).toContain('RED_LAYER');
      expect(dxfOutput).toContain('GREEN_LAYER');
      expect(dxfOutput).toContain('BLUE_LAYER');

      // Re-import
      const reimported = parseDxfFull(dxfOutput);

      const redLine = reimported.entities.find((e) => e.layer === 'RED_LAYER' && e.type === 'line');
      const greenLine = reimported.entities.find(
        (e) => e.layer === 'GREEN_LAYER' && e.type === 'line',
      );
      const blueLine = reimported.entities.find(
        (e) => e.layer === 'BLUE_LAYER' && e.type === 'line',
      );

      expect(redLine!.color).toBe('#ff0000');
      expect(greenLine!.color).toBe('#00ff00');
      expect(blueLine!.color).toBe('#0000ff');
    });

    it('linetypes survive round-trip', () => {
      const imported = parseDxfFull(TEST_DXF);

      const exportLayers = imported.layers.map((l) => ({
        id: l.name,
        name: l.name,
        color: l.color || '#ffffff',
        visible: true,
        locked: false,
        linetype: l.linetype,
      }));

      const dxfOutput = exportDxf(
        JSON.stringify(imported.entities.map((e) => ({ ...e, layer_id: e.layer }))),
        JSON.stringify(exportLayers),
      );

      // Check LTYPE table is present
      expect(dxfOutput).toContain('LTYPE');
      expect(dxfOutput).toContain('HIDDEN');
      expect(dxfOutput).toContain('CENTER');

      // Re-import and check layer linetypes
      const reimported = parseDxfFull(dxfOutput);
      const greenLayer = reimported.layers.find((l) => l.name === 'GREEN_LAYER');
      const blueLayer = reimported.layers.find((l) => l.name === 'BLUE_LAYER');

      expect(greenLayer!.linetype).toBe('HIDDEN');
      expect(blueLayer!.linetype).toBe('CENTER');
    });
  });

  describe('export — entity-level style codes', () => {
    it('writes entity color group code 62', () => {
      const entities = [
        {
          layer_id: '0',
          color: '#ff0000',
          geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } },
        },
      ];
      const output = exportDxf(JSON.stringify(entities));
      const lines = output.split('\n');
      const lineEntityIdx = lines.indexOf('LINE');
      const entityBlock = lines.slice(lineEntityIdx, lineEntityIdx + 20);
      expect(entityBlock).toContain('62');
      const colorIdx = entityBlock.indexOf('62');
      expect(entityBlock[colorIdx + 1]).toBe('1');
    });

    it('writes entity linetype group code 6', () => {
      const entities = [
        {
          layer_id: '0',
          linetype: 'HIDDEN',
          geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } },
        },
      ];
      const output = exportDxf(JSON.stringify(entities));
      expect(output).toContain('HIDDEN');
    });
  });
});
