import { describe, it, expect } from 'vitest';
import { createMockContext } from './mockToolContext';
import { RotateHandler } from '../RotateHandler';
import { ScaleHandler } from '../ScaleHandler';
import { MirrorHandler } from '../MirrorHandler';
import { DeleteHandler } from '../DeleteHandler';
import { OffsetHandler } from '../OffsetHandler';
import { TrimHandler } from '../TrimHandler';
import { ExtendHandler } from '../ExtendHandler';
import { FilletHandler } from '../FilletHandler';
import { ChamferHandler } from '../ChamferHandler';
import { ExplodeHandler } from '../ExplodeHandler';
import { JoinHandler } from '../JoinHandler';
import { ArrayHandler } from '../ArrayHandler';
import { MatchPropHandler } from '../MatchPropHandler';
import { LengthenHandler } from '../LengthenHandler';
import { BreakHandler } from '../BreakHandler';
import { TrimExtendHandler } from '../TrimExtendHandler';
import { EllipseHandler } from '../EllipseHandler';
import { SplineHandler } from '../SplineHandler';
import { ConstructionLineHandler } from '../ConstructionLineHandler';
import { TextHandler } from '../TextHandler';
import { DimensionHandler } from '../DimensionHandler';
import { AlignedDimensionHandler } from '../AlignedDimensionHandler';
import { MeasureDistanceHandler } from '../MeasureDistanceHandler';
import { MeasureAreaHandler } from '../MeasureAreaHandler';
import { RevCloudHandler } from '../RevCloudHandler';
import { ZoomWindowHandler } from '../ZoomWindowHandler';

describe('RotateHandler', () => {
  function setup(ids: string[] = ['e1']) {
    const ctx = createMockContext({ selectedIds: ids });
    const h = new RotateHandler();
    h.activate(ctx);
    return { h, ctx };
  }

  it('rotates by click', () => {
    const { h, ctx } = setup();
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCoordinateInput(1, { x: 1, y: 0 });
    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({ type: 'RotateEntity', id: 'e1' });
    expect(ctx.cancelled).toBe(true);
  });

  it('rotates by typed angle', () => {
    const { h, ctx } = setup();
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCommandInput(1, '90');
    expect(ctx.commands).toHaveLength(1);
    expect((ctx.commands[0] as any).angle).toBeCloseTo(Math.PI / 2);
  });

  it('no selection sets status -1', () => {
    const { h } = setup([]);
    expect(h.status).toBe(-1);
  });
});

describe('ScaleHandler', () => {
  function setup(ids: string[] = ['e1']) {
    const ctx = createMockContext({ selectedIds: ids });
    const h = new ScaleHandler();
    h.activate(ctx);
    return { h, ctx };
  }

  it('scales by typed factor', () => {
    const { h, ctx } = setup();
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCommandInput(1, '2.5');
    expect(ctx.commands).toHaveLength(1);
    expect((ctx.commands[0] as any).factor).toBe(2.5);
  });

  it('no selection sets status -1', () => {
    const { h } = setup([]);
    expect(h.status).toBe(-1);
  });
});

describe('MirrorHandler', () => {
  function setup(ids: string[] = ['e1']) {
    const ctx = createMockContext({ selectedIds: ids });
    const h = new MirrorHandler();
    h.activate(ctx);
    return { h, ctx };
  }

  it('mirrors by two points', () => {
    const { h, ctx } = setup();
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCoordinateInput(1, { x: 0, y: 10 });
    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'MirrorEntity',
      id: 'e1',
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 10,
    });
  });
});

describe('DeleteHandler', () => {
  it('deletes selected entities immediately', () => {
    const ctx = createMockContext({ selectedIds: ['e1', 'e2'] });
    const h = new DeleteHandler();
    h.activate(ctx);
    expect(ctx.commands).toHaveLength(2);
    expect(ctx.commands[0]).toMatchObject({ type: 'DeleteEntity', id: 'e1' });
    expect(ctx.cancelled).toBe(true);
  });

  it('no selection sets status -1', () => {
    const ctx = createMockContext({ selectedIds: [] });
    const h = new DeleteHandler();
    h.activate(ctx);
    expect(h.status).toBe(-1);
  });
});

describe('OffsetHandler', () => {
  it('advances to side-pick after object is picked; no command yet', () => {
    const ctx = createMockContext({ hitTestResult: 'e1' });
    const h = new OffsetHandler();
    h.activate(ctx);
    h.onCommandInput(0, '5');
    expect(h.status).toBe(1);
    h.onCoordinateInput(1, { x: 10, y: 10 });
    expect(h.status).toBe(2);
    expect(ctx.commands).toHaveLength(0);
  });

  it('emits offset after side is clicked and loops back to select', () => {
    const ctx = createMockContext({ hitTestResult: 'e1' });
    const h = new OffsetHandler();
    h.activate(ctx);
    h.onCommandInput(0, '5');
    h.onCoordinateInput(1, { x: 10, y: 10 });
    h.onCoordinateInput(2, { x: 10, y: 20 }); // side pick
    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({ type: 'OffsetEntity', id: 'e1', distance: 5 });
    expect(h.status).toBe(1);
  });
});

describe('TrimHandler', () => {
  it('trims after boundary selection', () => {
    const ctx = createMockContext({ hitTestResult: 'boundary1' });
    const h = new TrimHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    expect(h.status).toBe(1);
    ctx.hitTestResult = 'target1';
    h.onCoordinateInput(1, { x: 5, y: 5 });
    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'TrimEntity',
      id: 'target1',
      boundary_id: 'boundary1',
    });
  });
});

describe('ExtendHandler', () => {
  it('extends after boundary selection', () => {
    const ctx = createMockContext({ hitTestResult: 'boundary1' });
    const h = new ExtendHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    ctx.hitTestResult = 'target1';
    h.onCoordinateInput(1, { x: 5, y: 5 });
    expect(ctx.commands[0]).toMatchObject({
      type: 'ExtendEntity',
      id: 'target1',
      boundary_id: 'boundary1',
    });
  });
});

describe('TrimExtendHandler', () => {
  it('enter at boundary prompt uses select-all default', () => {
    const ctx = createMockContext({ hitTestResult: 'e1' });
    const h = new TrimExtendHandler('trim');
    h.activate(ctx);
    expect(h.status).toBe(0);
    // Enter with no picks → select all, advance to state 1
    h.onCommandInput(0, '');
    expect(h.status).toBe(1);
  });

  it('picks boundary then enters trim mode', () => {
    const ctx = createMockContext({ hitTestResult: 'boundary1' });
    const h = new TrimExtendHandler('trim');
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 }); // pick boundary
    expect(h.status).toBe(0); // still in boundary selection
    h.onCommandInput(0, ''); // Enter to confirm
    expect(h.status).toBe(1); // now in trim mode
  });

  it('extend mode inverts trim/extend behavior', () => {
    const ctx = createMockContext({ hitTestResult: 'e1' });
    const h = new TrimExtendHandler('extend');
    h.activate(ctx);
    expect(h.id).toBe('modify_extend');
  });
});

describe('FilletHandler', () => {
  it('fillets two entities', () => {
    const ctx = createMockContext({ hitTestResult: 'e1' });
    const h = new FilletHandler();
    h.activate(ctx);
    h.onCommandInput(0, '5');
    h.onCoordinateInput(0, { x: 0, y: 0 });
    ctx.hitTestResult = 'e2';
    h.onCoordinateInput(1, { x: 5, y: 5 });
    expect(ctx.commands[0]).toMatchObject({ type: 'Fillet', id_a: 'e1', id_b: 'e2', radius: 5 });
  });
});

describe('ChamferHandler', () => {
  it('chamfers with distances', () => {
    const ctx = createMockContext({ hitTestResult: 'e1' });
    const h = new ChamferHandler();
    h.activate(ctx);
    h.onCommandInput(0, '3,5');
    h.onCoordinateInput(0, { x: 0, y: 0 });
    ctx.hitTestResult = 'e2';
    h.onCoordinateInput(1, { x: 5, y: 5 });
    expect(ctx.commands[0]).toMatchObject({
      type: 'Chamfer',
      id_a: 'e1',
      id_b: 'e2',
      dist_a: 3,
      dist_b: 5,
    });
  });
});

describe('ExplodeHandler', () => {
  it('explodes selected entities immediately', () => {
    const ctx = createMockContext({ selectedIds: ['e1'] });
    const h = new ExplodeHandler();
    h.activate(ctx);
    expect(ctx.commands[0]).toMatchObject({ type: 'Explode', entity_id: 'e1' });
    expect(ctx.cancelled).toBe(true);
  });
});

describe('JoinHandler', () => {
  it('joins selected entities immediately', () => {
    const ctx = createMockContext({ selectedIds: ['e1', 'e2'] });
    const h = new JoinHandler();
    h.activate(ctx);
    expect(ctx.commands[0]).toMatchObject({ type: 'JoinEntities', ids: ['e1', 'e2'] });
    expect(ctx.cancelled).toBe(true);
  });

  it('requires 2+ entities', () => {
    const ctx = createMockContext({ selectedIds: ['e1'] });
    const h = new JoinHandler();
    h.activate(ctx);
    expect(h.status).toBe(-1);
  });
});

describe('ArrayHandler', () => {
  it('creates rectangular array', () => {
    const ctx = createMockContext({ selectedIds: ['e1'] });
    const h = new ArrayHandler();
    h.activate(ctx);
    h.onCommandInput(0, 'r');
    expect(h.status).toBe(1);
    h.onCommandInput(1, '3,4,5,6');
    expect(ctx.commands[0]).toMatchObject({
      type: 'ArrayRectangular',
      rows: 3,
      cols: 4,
      row_spacing: 5,
      col_spacing: 6,
    });
  });

  it('creates polar array', () => {
    const ctx = createMockContext({ selectedIds: ['e1'] });
    const h = new ArrayHandler();
    h.activate(ctx);
    h.onCommandInput(0, 'p');
    h.onCommandInput(1, '8,0,0,360');
    expect(ctx.commands[0]).toMatchObject({ type: 'ArrayPolar', count: 8 });
  });
});

describe('MatchPropHandler', () => {
  it('matches properties from source to targets', () => {
    const ctx = createMockContext({ hitTestResult: 'source1' });
    const h = new MatchPropHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    expect(h.status).toBe(1);
    ctx.hitTestResult = 'target1';
    h.onCoordinateInput(1, { x: 5, y: 5 });
    h.onKeyDown(1, 'Enter');
    expect(ctx.commands[0]).toMatchObject({
      type: 'MatchProperties',
      source_id: 'source1',
      target_ids: ['target1'],
    });
  });
});

describe('LengthenHandler', () => {
  it('follows mode -> value -> select flow', () => {
    const ctx = createMockContext({ hitTestResult: 'e1' });
    const h = new LengthenHandler();
    h.activate(ctx);
    h.onCommandInput(0, 'delta');
    expect(h.status).toBe(1);
    h.onCommandInput(1, '10');
    expect(h.status).toBe(2);
    h.onCoordinateInput(2, { x: 5, y: 5 });
    expect(ctx.commands[0]).toMatchObject({
      type: 'Lengthen',
      entity_id: 'e1',
      mode: 'delta',
      value: 10,
    });
  });
});

describe('BreakHandler', () => {
  it('breaks with two points', () => {
    const ctx = createMockContext({ hitTestResult: 'e1' });
    const h = new BreakHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 1, y: 2 });
    expect(h.status).toBe(1);
    h.onCoordinateInput(1, { x: 3, y: 4 });
    expect(ctx.commands[0]).toMatchObject({
      type: 'Break',
      entity_id: 'e1',
      x1: 1,
      y1: 2,
      x2: 3,
      y2: 4,
    });
  });

  it('breaks at point with AT sub-command', () => {
    const ctx = createMockContext({ hitTestResult: 'e1' });
    const h = new BreakHandler();
    h.activate(ctx);
    h.onCommandInput(0, 'at');
    h.onCoordinateInput(0, { x: 1, y: 2 });
    expect(ctx.commands[0]).toMatchObject({ type: 'BreakAtPoint', entity_id: 'e1', px: 1, py: 2 });
  });
});

describe('EllipseHandler', () => {
  it('creates ellipse with 3 clicks', () => {
    const ctx = createMockContext();
    const h = new EllipseHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCoordinateInput(1, { x: 10, y: 0 });
    h.onCoordinateInput(2, { x: 0, y: 5 });
    expect(ctx.commands).toHaveLength(1);
    expect((ctx.commands[0] as any).type).toBe('CreateEllipse');
  });
});

describe('SplineHandler', () => {
  it('creates spline on Enter', () => {
    const ctx = createMockContext();
    const h = new SplineHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCoordinateInput(1, { x: 5, y: 5 });
    h.onCoordinateInput(2, { x: 10, y: 0 });
    h.onKeyDown(3, 'Enter');
    expect(ctx.commands[0]).toMatchObject({ type: 'CreateSpline', degree: 3, closed: false });
  });

  it('closes spline with Close command', () => {
    const ctx = createMockContext();
    const h = new SplineHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCoordinateInput(1, { x: 5, y: 5 });
    h.onCoordinateInput(2, { x: 10, y: 0 });
    h.onCommandInput(3, 'close');
    expect((ctx.commands[0] as any).closed).toBe(true);
  });
});

describe('ConstructionLineHandler', () => {
  it('creates xline with two clicks', () => {
    const ctx = createMockContext();
    const h = new ConstructionLineHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCoordinateInput(1, { x: 10, y: 5 });
    expect(ctx.commands[0]).toMatchObject({
      type: 'CreateConstructionLine',
      ox: 0,
      oy: 0,
      dx: 10,
      dy: 5,
    });
  });
});

describe('TextHandler', () => {
  it('creates text after click + type', () => {
    const ctx = createMockContext();
    const h = new TextHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 5, y: 10 });
    expect(h.status).toBe(1);
    h.onCommandInput(1, 'Hello World');
    expect(ctx.commands[0]).toMatchObject({
      type: 'CreateText',
      x: 5,
      y: 10,
      content: 'Hello World',
    });
  });
});

describe('DimensionHandler', () => {
  it('creates dimension with 3 clicks', () => {
    const ctx = createMockContext();
    const h = new DimensionHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCoordinateInput(1, { x: 10, y: 0 });
    h.onCoordinateInput(2, { x: 5, y: 5 });
    expect(ctx.commands[0]).toMatchObject({ type: 'CreateDimension' });
  });

  it('accepts typed offset', () => {
    const ctx = createMockContext();
    const h = new DimensionHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCoordinateInput(1, { x: 10, y: 0 });
    h.onCommandInput(2, '7');
    expect((ctx.commands[0] as any).offset).toBe(7);
  });
});

describe('AlignedDimensionHandler', () => {
  it('creates aligned dimension', () => {
    const ctx = createMockContext();
    const h = new AlignedDimensionHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCoordinateInput(1, { x: 5, y: 5 });
    h.onCoordinateInput(2, { x: 10, y: 10 });
    expect(ctx.commands[0]).toMatchObject({ type: 'CreateAlignedDimension' });
  });
});

describe('MeasureDistanceHandler', () => {
  it('measures distance between two points', () => {
    const ctx = createMockContext();
    const h = new MeasureDistanceHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onCoordinateInput(1, { x: 3, y: 4 });
    expect(ctx.commands[0]).toMatchObject({ type: 'MeasureDistance', x1: 0, y1: 0, x2: 3, y2: 4 });
  });
});

describe('MeasureAreaHandler', () => {
  it('measures area of hit entity', () => {
    const ctx = createMockContext({ hitTestResult: 'poly1' });
    const h = new MeasureAreaHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 5, y: 5 });
    expect(ctx.commands[0]).toMatchObject({ type: 'MeasureArea', entity_id: 'poly1' });
  });
});

describe('RevCloudHandler', () => {
  it('creates revision cloud with 2 clicks', () => {
    const ctx = createMockContext();
    const h = new RevCloudHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    expect(h.status).toBe(1);
    h.onCoordinateInput(1, { x: 10, y: 8 });
    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({ type: 'CreateRevisionCloud', arc_length: 0.5 });
    expect(h.status).toBe(0);
  });

  it('rejects zero-size cloud', () => {
    const ctx = createMockContext();
    const h = new RevCloudHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 5, y: 5 });
    h.onCoordinateInput(1, { x: 5, y: 5 });
    expect(ctx.commands).toHaveLength(0);
  });

  it('escape resets', () => {
    const ctx = createMockContext();
    const h = new RevCloudHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onKeyDown(1, 'Escape');
    expect(h.status).toBe(0);
  });
});

describe('ZoomWindowHandler', () => {
  function zoomCtx() {
    return createMockContext({
      renderer: {
        setPreview: () => {},
        clearPreview: () => {},
        hitTest: () => null,
        getEntityById: () => null,
        startZoomWindow: () => {},
        cancelZoomWindow: () => {},
        handleZoomWindowClick: () => {},
      },
    });
  }

  it('zoom window with 2 clicks', () => {
    const ctx = zoomCtx();
    const h = new ZoomWindowHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    expect(h.status).toBe(1);
    h.onCoordinateInput(1, { x: 10, y: 10 });
    expect(ctx.cancelled).toBe(true);
  });

  it('escape cancels', () => {
    const ctx = zoomCtx();
    const h = new ZoomWindowHandler();
    h.activate(ctx);
    h.onKeyDown(0, 'Escape');
    expect(ctx.cancelled).toBe(true);
  });
});

describe('LengthenHandler — extra modes', () => {
  it('percent mode', () => {
    const ctx = createMockContext({ hitTestResult: 'e1' });
    const h = new LengthenHandler();
    h.activate(ctx);
    h.onCommandInput(0, 'percent');
    h.onCommandInput(1, '150');
    h.onCoordinateInput(2, { x: 5, y: 5 });
    expect(ctx.commands[0]).toMatchObject({ mode: 'percent', value: 150 });
  });

  it('total mode', () => {
    const ctx = createMockContext({ hitTestResult: 'e1' });
    const h = new LengthenHandler();
    h.activate(ctx);
    h.onCommandInput(0, 'total');
    h.onCommandInput(1, '25');
    h.onCoordinateInput(2, { x: 0, y: 0 });
    expect(ctx.commands[0]).toMatchObject({ mode: 'total', value: 25 });
  });
});

describe('SplineHandler — minimum points', () => {
  it('requires 2+ points', () => {
    const ctx = createMockContext();
    const h = new SplineHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 0, y: 0 });
    h.onKeyDown(1, 'Enter');
    expect(ctx.commands).toHaveLength(0);
  });
});

describe('TextHandler — empty text', () => {
  it('does not create empty text', () => {
    const ctx = createMockContext();
    const h = new TextHandler();
    h.activate(ctx);
    h.onCoordinateInput(0, { x: 5, y: 10 });
    h.onCommandInput(1, '');
    expect(ctx.commands).toHaveLength(0);
  });
});

describe('MirrorHandler — no selection', () => {
  it('sets status -1', () => {
    const ctx = createMockContext({ selectedIds: [] });
    const h = new MirrorHandler();
    h.activate(ctx);
    expect(h.status).toBe(-1);
  });
});
