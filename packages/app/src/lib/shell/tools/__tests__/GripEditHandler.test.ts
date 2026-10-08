import { describe, it, expect, vi } from 'vitest';
import { GripEditHandler } from '../GripEditHandler';
import { createMockContext } from './mockToolContext';
import type { GripHit } from '@nexus/renderer';

function makeGripHit(overrides?: Partial<GripHit>): GripHit {
  return {
    entityId: 'e1',
    gripIndex: 0,
    gripType: 'endpoint',
    point: { x: 0, y: 0 },
    ...overrides,
  };
}

function setup(gripHit?: GripHit, entityGeometry?: any) {
  const hit = gripHit ?? makeGripHit();
  const previewGeometryCalls: any[] = [];
  const ctx = createMockContext({
    selectedIds: [hit.entityId],
    renderer: {
      setPreview: () => {},
      clearPreview: () => {},
      hitTest: () => null,
      setPreviewGeometry: (geom: any) => {
        previewGeometryCalls.push(geom);
      },
      getEntityById: (id: string) => {
        if (id === hit.entityId && entityGeometry) {
          return { id: hit.entityId, geometry: entityGeometry };
        }
        return null;
      },
    },
  });
  const handler = new GripEditHandler(hit);
  handler.activate(ctx);
  return { handler, ctx, previewGeometryCalls };
}

describe('GripEditHandler', () => {
  it('starts in stretch mode at status 1', () => {
    const { handler } = setup();
    expect(handler.status).toBe(1);
    expect(handler.getPrompt()).toContain('STRETCH');
  });

  it('spacebar cycles through all modes', () => {
    const { handler } = setup();
    expect(handler.getPrompt()).toContain('STRETCH');

    handler.onKeyDown(1, ' ');
    expect(handler.getPrompt()).toContain('MOVE');

    handler.onKeyDown(1, ' ');
    expect(handler.getPrompt()).toContain('ROTATE');

    handler.onKeyDown(1, ' ');
    expect(handler.getPrompt()).toContain('SCALE');

    handler.onKeyDown(1, ' ');
    expect(handler.getPrompt()).toContain('MIRROR');

    handler.onKeyDown(1, ' ');
    expect(handler.getPrompt()).toContain('STRETCH');
  });

  it('spacebar returns HANDLED', () => {
    const { handler } = setup();
    expect(handler.onKeyDown(1, ' ')).toBe('HANDLED');
  });

  it('escape cancels grip edit', () => {
    const { handler, ctx } = setup();
    handler.onKeyDown(1, 'Escape');
    expect(ctx.cancelled).toBe(true);
  });

  it('move mode dispatches MoveEntity command', () => {
    const { handler, ctx } = setup();
    handler.onKeyDown(1, ' '); // Switch to Move
    handler.onCoordinateInput(1, { x: 5, y: 3 });

    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'MoveEntity',
      id: 'e1',
      dx: 5,
      dy: 3,
    });
    expect(ctx.cancelled).toBe(true);
  });

  it('rotate mode dispatches RotateEntity command', () => {
    const { handler, ctx } = setup();
    handler.onKeyDown(1, ' '); // Move
    handler.onKeyDown(1, ' '); // Rotate
    handler.onCoordinateInput(1, { x: 1, y: 0 });

    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'RotateEntity',
      id: 'e1',
      cx: 0,
      cy: 0,
    });
    expect(ctx.cancelled).toBe(true);
  });

  it('scale mode dispatches ScaleEntity command', () => {
    const { handler, ctx } = setup();
    handler.onKeyDown(1, ' '); // Move
    handler.onKeyDown(1, ' '); // Rotate
    handler.onKeyDown(1, ' '); // Scale
    handler.onCoordinateInput(1, { x: 10, y: 0 });

    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'ScaleEntity',
      id: 'e1',
      cx: 0,
      cy: 0,
    });
    expect(ctx.cancelled).toBe(true);
  });

  it('mirror mode dispatches MirrorEntity command', () => {
    const { handler, ctx } = setup();
    handler.onKeyDown(1, ' '); // Move
    handler.onKeyDown(1, ' '); // Rotate
    handler.onKeyDown(1, ' '); // Scale
    handler.onKeyDown(1, ' '); // Mirror
    handler.onCoordinateInput(1, { x: 5, y: 5 });

    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0]).toMatchObject({
      type: 'MirrorEntity',
      id: 'e1',
      x1: 0,
      y1: 0,
      x2: 5,
      y2: 5,
    });
    expect(ctx.cancelled).toBe(true);
  });

  it('stretch mode on line start grip modifies geometry', () => {
    const lineGeom = {
      Line: {
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
      },
    };
    const { handler, ctx } = setup(makeGripHit({ gripIndex: 0 }), lineGeom);

    handler.onCoordinateInput(1, { x: 3, y: 4 });

    expect(ctx.commands).toHaveLength(1);
    const cmd = ctx.commands[0] as any;
    expect(cmd.type).toBe('ModifyGeometry');
    expect(cmd.id).toBe('e1');
    const geom = JSON.parse(cmd.geometry_json);
    expect(geom.Line.start).toEqual({ x: 3, y: 4 });
    expect(geom.Line.end).toEqual({ x: 10, y: 0 });
  });

  it('stretch mode on line end grip modifies geometry', () => {
    const lineGeom = {
      Line: {
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
      },
    };
    const { handler, ctx } = setup(makeGripHit({ gripIndex: 1 }), lineGeom);

    handler.onCoordinateInput(1, { x: 15, y: 5 });

    const cmd = ctx.commands[0] as any;
    const geom = JSON.parse(cmd.geometry_json);
    expect(geom.Line.start).toEqual({ x: 0, y: 0 });
    expect(geom.Line.end).toEqual({ x: 15, y: 5 });
  });

  it('stretch mode on line midpoint grip moves entire line', () => {
    const lineGeom = {
      Line: {
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
      },
    };
    const hit = makeGripHit({ gripIndex: 2, point: { x: 5, y: 0 } });
    const { handler, ctx } = setup(hit, lineGeom);

    handler.onCoordinateInput(1, { x: 8, y: 3 });

    const cmd = ctx.commands[0] as any;
    const geom = JSON.parse(cmd.geometry_json);
    expect(geom.Line.start).toEqual({ x: 3, y: 3 });
    expect(geom.Line.end).toEqual({ x: 13, y: 3 });
  });

  it('stretch mode on circle cardinal grip changes radius', () => {
    const circleGeom = {
      Circle: {
        center: { x: 0, y: 0 },
        radius: 5,
      },
    };
    const hit = makeGripHit({ gripIndex: 1, point: { x: 5, y: 0 } });
    const { handler, ctx } = setup(hit, circleGeom);

    handler.onCoordinateInput(1, { x: 8, y: 0 });

    const cmd = ctx.commands[0] as any;
    const geom = JSON.parse(cmd.geometry_json);
    expect(geom.Circle.radius).toBe(8);
    expect(geom.Circle.center).toEqual({ x: 0, y: 0 });
  });

  it('stretch mode on polyline vertex moves that vertex', () => {
    const polyGeom = {
      Polyline: {
        vertices: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 5 },
        ],
        closed: false,
      },
    };
    const hit = makeGripHit({ gripIndex: 1, point: { x: 5, y: 0 } });
    const { handler, ctx } = setup(hit, polyGeom);

    handler.onCoordinateInput(1, { x: 7, y: 2 });

    const cmd = ctx.commands[0] as any;
    const geom = JSON.parse(cmd.geometry_json);
    expect(geom.Polyline.vertices[0]).toEqual({ x: 0, y: 0 });
    expect(geom.Polyline.vertices[1]).toEqual({ x: 7, y: 2 });
    expect(geom.Polyline.vertices[2]).toEqual({ x: 5, y: 5 });
  });

  describe('preview geometry', () => {
    it('stretch preview shows modified line geometry', () => {
      const lineGeom = {
        Line: {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
        },
      };
      const { handler, previewGeometryCalls } = setup(makeGripHit({ gripIndex: 0 }), lineGeom);

      handler.onPointerMove(1, { x: 5, y: 3 }, 0, 0);

      expect(previewGeometryCalls).toHaveLength(1);
      expect(previewGeometryCalls[0]).toEqual({
        Line: {
          start: { x: 5, y: 3 },
          end: { x: 10, y: 0 },
        },
      });
    });

    it('stretch preview shows modified circle geometry', () => {
      const circleGeom = {
        Circle: {
          center: { x: 0, y: 0 },
          radius: 5,
        },
      };
      const hit = makeGripHit({ gripIndex: 1, point: { x: 5, y: 0 } });
      const { handler, previewGeometryCalls } = setup(hit, circleGeom);

      handler.onPointerMove(1, { x: 8, y: 0 }, 0, 0);

      expect(previewGeometryCalls).toHaveLength(1);
      expect(previewGeometryCalls[0].Circle.radius).toBe(8);
      expect(previewGeometryCalls[0].Circle.center).toEqual({ x: 0, y: 0 });
    });

    it('move getPreviewCommand returns MoveEntity command', () => {
      const lineGeom = {
        Line: {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
        },
      };
      const { handler } = setup(makeGripHit({ gripIndex: 0 }), lineGeom);

      handler.onKeyDown(1, ' '); // Switch to Move
      const cmd = handler.getPreviewCommand({ x: 3, y: 4 }) as any;

      expect(cmd).toMatchObject({
        type: 'MoveEntity',
        id: 'e1',
        dx: 3,
        dy: 4,
      });
    });

    it('move getPreviewCommand does not call setPreviewGeometry', () => {
      const lineGeom = {
        Line: {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
        },
      };
      const { handler, previewGeometryCalls } = setup(makeGripHit(), lineGeom);

      handler.onKeyDown(1, ' '); // Switch to Move
      handler.onPointerMove(1, { x: 2, y: 1 }, 0, 0);

      expect(previewGeometryCalls).toHaveLength(0);
    });

    it('stretch mode with no entity does not call setPreviewGeometry', () => {
      const hit = makeGripHit();
      const ctx = createMockContext({
        selectedIds: [hit.entityId],
        renderer: {
          setPreview: vi.fn(),
          clearPreview: () => {},
          hitTest: () => null,
          getEntityById: () => null,
        },
      });
      const handler = new GripEditHandler(hit);
      handler.activate(ctx);

      // stretch mode, no entity found — should not throw, no preview
      handler.onPointerMove(1, { x: 5, y: 3 }, 0, 0);
    });

    it('scale getPreviewCommand returns ScaleEntity command', () => {
      const lineGeom = {
        Line: {
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
        },
      };
      const { handler } = setup(makeGripHit(), lineGeom);

      handler.onKeyDown(1, ' '); // Move
      handler.onKeyDown(1, ' '); // Rotate
      handler.onKeyDown(1, ' '); // Scale
      const cmd = handler.getPreviewCommand({ x: 20, y: 0 }) as any;

      expect(cmd).toMatchObject({
        type: 'ScaleEntity',
        id: 'e1',
        cx: 0,
        cy: 0,
      });
      // factor = dist/10 = 20/10 = 2
      expect(cmd.factor).toBeCloseTo(2, 5);
    });

    it('rotate getPreviewCommand returns RotateEntity command', () => {
      const lineGeom = {
        Line: {
          start: { x: 10, y: 0 },
          end: { x: 20, y: 0 },
        },
      };
      const { handler } = setup(makeGripHit(), lineGeom);

      handler.onKeyDown(1, ' '); // Move
      handler.onKeyDown(1, ' '); // Rotate
      // Point at 90 degrees
      const cmd = handler.getPreviewCommand({ x: 0, y: 1 }) as any;

      expect(cmd).toMatchObject({
        type: 'RotateEntity',
        id: 'e1',
        cx: 0,
        cy: 0,
      });
      expect(cmd.angle).toBeCloseTo(Math.PI / 2, 5);
    });
  });
});
