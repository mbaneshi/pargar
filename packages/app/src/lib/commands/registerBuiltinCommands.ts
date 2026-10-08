import { commandRegistry } from './CommandRegistry';
import {
  LineHandler,
  CircleHandler,
  RectHandler,
  ArcHandler,
  PolylineHandler,
  MoveHandler,
  CopyHandler,
  PointHandler,
  RotateHandler,
  ScaleHandler,
  MirrorHandler,
  DeleteHandler,
  OffsetHandler,
  TrimExtendHandler,
  FilletHandler,
  ChamferHandler,
  ExplodeHandler,
  JoinHandler,
  ArrayHandler,
  MatchPropHandler,
  LengthenHandler,
  BreakHandler,
  EllipseHandler,
  SplineHandler,
  ConstructionLineHandler,
  TextHandler,
  MTextHandler,
  DimensionHandler,
  AlignedDimensionHandler,
  MeasureDistanceHandler,
  MeasureAreaHandler,
  RevCloudHandler,
  HatchHandler,
  TableHandler,
  ZoomWindowHandler,
  PolygonHandler,
  RayHandler,
  DonutHandler,
  BlockCreateHandler,
  BlockInsertHandler,
} from '../shell/tools';
import type { AppState } from '../stores/AppState.svelte';

export function registerBuiltinCommands(app: AppState): void {
  // --- Selection mode ---

  commandRegistry.register({
    id: 'select',
    label: 'Select',
    description: 'Select and manipulate entities',
    aliases: ['s', 'select'],
    category: 'select',
    execute: () => {},
  });

  // --- Draw tools ---

  commandRegistry.register({
    id: 'draw_line',
    label: 'Line',
    description: 'Draw a straight line between two points',
    aliases: ['l', 'li', 'line'],
    category: 'draw',
    execute: (params: { x1: number; y1: number; x2: number; y2: number; layer_id?: string }) => {
      app.executeCommand({
        type: 'CreateLine',
        x1: params.x1,
        y1: params.y1,
        x2: params.x2,
        y2: params.y2,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => new LineHandler(),
    schema: {
      type: 'object',
      properties: {
        x1: { type: 'number', description: 'Start X coordinate' },
        y1: { type: 'number', description: 'Start Y coordinate' },
        x2: { type: 'number', description: 'End X coordinate' },
        y2: { type: 'number', description: 'End Y coordinate' },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['x1', 'y1', 'x2', 'y2'],
    },
  });

  commandRegistry.register({
    id: 'draw_circle',
    label: 'Circle',
    description: 'Draw a circle by center and radius',
    aliases: ['c', 'circle'],
    category: 'draw',
    execute: (params: { cx: number; cy: number; radius: number; layer_id?: string }) => {
      app.executeCommand({
        type: 'CreateCircle',
        cx: params.cx,
        cy: params.cy,
        radius: params.radius,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => new CircleHandler(),
    schema: {
      type: 'object',
      properties: {
        cx: { type: 'number', description: 'Center X' },
        cy: { type: 'number', description: 'Center Y' },
        radius: { type: 'number', description: 'Radius' },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['cx', 'cy', 'radius'],
    },
  });

  commandRegistry.register({
    id: 'draw_rectangle',
    label: 'Rectangle',
    description: 'Draw a rectangle by two corner points',
    aliases: ['r', 'rec', 'rect', 'rectangle'],
    category: 'draw',
    execute: (params: {
      x: number;
      y: number;
      width: number;
      height: number;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'CreateRectangle',
        x: params.x,
        y: params.y,
        width: params.width,
        height: params.height,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => new RectHandler(),
    schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Lower-left X' },
        y: { type: 'number', description: 'Lower-left Y' },
        width: { type: 'number', description: 'Width' },
        height: { type: 'number', description: 'Height' },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['x', 'y', 'width', 'height'],
    },
  });

  commandRegistry.register({
    id: 'draw_arc',
    label: 'Arc',
    description: 'Draw a circular arc by three points',
    aliases: ['a', 'arc'],
    category: 'draw',
    execute: (params: {
      cx: number;
      cy: number;
      radius: number;
      start_angle: number;
      end_angle: number;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'CreateArc',
        cx: params.cx,
        cy: params.cy,
        radius: params.radius,
        start_angle: params.start_angle,
        end_angle: params.end_angle,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => new ArcHandler(),
    schema: {
      type: 'object',
      properties: {
        cx: { type: 'number', description: 'Center X' },
        cy: { type: 'number', description: 'Center Y' },
        radius: { type: 'number', description: 'Radius' },
        start_angle: { type: 'number', description: 'Start angle (radians)' },
        end_angle: { type: 'number', description: 'End angle (radians)' },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['cx', 'cy', 'radius', 'start_angle', 'end_angle'],
    },
  });

  commandRegistry.register({
    id: 'draw_polyline',
    label: 'Polyline',
    description: 'Draw a connected sequence of line segments',
    aliases: ['p', 'pl', 'pline', 'polyline'],
    category: 'draw',
    execute: (params: { vertices: [number, number][]; closed?: boolean; layer_id?: string }) => {
      app.executeCommand({
        type: 'CreatePolyline',
        vertices: params.vertices,
        closed: params.closed ?? false,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => new PolylineHandler(),
    schema: {
      type: 'object',
      properties: {
        vertices: {
          type: 'array',
          items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          description: 'Array of [x, y] coordinate pairs',
        },
        closed: { type: 'boolean', description: 'Whether to close the polyline', default: false },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['vertices'],
    },
  });

  commandRegistry.register({
    id: 'draw_point',
    label: 'Point',
    description: 'Place a point marker at a location',
    aliases: ['po', 'point'],
    category: 'draw',
    execute: (params: { x: number; y: number; layer_id?: string }) => {
      app.executeCommand({
        type: 'CreatePoint',
        x: params.x,
        y: params.y,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => new PointHandler(),
    schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['x', 'y'],
    },
  });

  commandRegistry.register({
    id: 'draw_ellipse',
    label: 'Ellipse',
    description: 'Draw an ellipse by center and axes',
    aliases: ['el', 'ellipse'],
    category: 'draw',
    execute: (params: {
      cx: number;
      cy: number;
      semi_major: number;
      semi_minor: number;
      rotation?: number;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'CreateEllipse',
        cx: params.cx,
        cy: params.cy,
        semi_major: params.semi_major,
        semi_minor: params.semi_minor,
        rotation: params.rotation ?? 0,
        layer_id: params.layer_id ?? app.activeLayerId,
      });
    },
    invoke: () => new EllipseHandler(),
    schema: {
      type: 'object',
      properties: {
        cx: { type: 'number', description: 'Center X' },
        cy: { type: 'number', description: 'Center Y' },
        semi_major: { type: 'number', description: 'Semi-major axis length' },
        semi_minor: { type: 'number', description: 'Semi-minor axis length' },
        rotation: { type: 'number', description: 'Rotation angle (radians)', default: 0 },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['cx', 'cy', 'semi_major', 'semi_minor'],
    },
  });

  commandRegistry.register({
    id: 'draw_spline',
    label: 'Spline',
    description: 'Draw a smooth curve through control points',
    aliases: ['spl', 'spline'],
    category: 'draw',
    execute: (params: {
      control_points: [number, number][];
      degree?: number;
      closed?: boolean;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'CreateSpline',
        control_points: params.control_points,
        degree: params.degree ?? 3,
        closed: params.closed ?? false,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => new SplineHandler(),
    schema: {
      type: 'object',
      properties: {
        control_points: {
          type: 'array',
          items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          description: 'Array of [x, y] control points',
        },
        degree: { type: 'number', description: 'Spline degree', default: 3 },
        closed: { type: 'boolean', description: 'Whether to close the spline', default: false },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['control_points'],
    },
  });

  commandRegistry.register({
    id: 'draw_xline',
    label: 'Construction Line',
    description: 'Draw an infinite construction line',
    aliases: ['xl', 'xline'],
    category: 'draw',
    execute: (params: { ox: number; oy: number; dx: number; dy: number; layer_id?: string }) => {
      app.executeCommand({
        type: 'CreateConstructionLine',
        ox: params.ox,
        oy: params.oy,
        dx: params.dx,
        dy: params.dy,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => new ConstructionLineHandler(),
    schema: {
      type: 'object',
      properties: {
        ox: { type: 'number', description: 'Origin X' },
        oy: { type: 'number', description: 'Origin Y' },
        dx: { type: 'number', description: 'Direction X' },
        dy: { type: 'number', description: 'Direction Y' },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['ox', 'oy', 'dx', 'dy'],
    },
  });

  commandRegistry.register({
    id: 'draw_revcloud',
    label: 'Revision Cloud',
    description: 'Draw a revision cloud to highlight changes',
    aliases: ['rc', 'revcloud'],
    category: 'draw',
    execute: (params: { vertices: [number, number][]; arc_length?: number; layer_id?: string }) => {
      app.executeCommand({
        type: 'CreateRevisionCloud',
        vertices: params.vertices,
        arc_length: params.arc_length ?? 0.5,
        layer_id: params.layer_id ?? app.activeLayerId,
      });
    },
    invoke: () => new RevCloudHandler(),
    schema: {
      type: 'object',
      properties: {
        vertices: {
          type: 'array',
          items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          description: 'Array of [x, y] coordinate pairs forming the cloud boundary',
        },
        arc_length: { type: 'number', description: 'Size of arc bumps', default: 0.5 },
        layer_id: { type: 'string', description: 'Layer ID' },
      },
      required: ['vertices'],
    },
  });

  commandRegistry.register({
    id: 'draw_polygon',
    label: 'Polygon',
    description: 'Draw a regular polygon',
    aliases: ['pol', 'polygon'],
    category: 'draw',
    execute: (params: {
      cx: number;
      cy: number;
      radius: number;
      sides: number;
      inscribed?: boolean;
      rotation?: number;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'CreatePolygon',
        cx: params.cx,
        cy: params.cy,
        radius: params.radius,
        sides: params.sides,
        inscribed: params.inscribed ?? true,
        rotation: params.rotation ?? 0,
        layer_id: params.layer_id ?? app.activeLayerId,
      });
    },
    invoke: () => new PolygonHandler(),
    schema: {
      type: 'object',
      properties: {
        cx: { type: 'number', description: 'Center X' },
        cy: { type: 'number', description: 'Center Y' },
        radius: { type: 'number', description: 'Radius' },
        sides: { type: 'number', description: 'Number of sides' },
        inscribed: { type: 'boolean', description: 'Inscribed (true) or circumscribed (false)' },
        rotation: { type: 'number', description: 'Rotation angle in radians' },
      },
      required: ['cx', 'cy', 'radius', 'sides'],
    },
  });

  commandRegistry.register({
    id: 'draw_ray',
    label: 'Ray',
    description: 'Draw a half-infinite ray',
    aliases: ['ray'],
    category: 'draw',
    execute: (params: { ox: number; oy: number; dx: number; dy: number; layer_id?: string }) => {
      app.executeCommand({
        type: 'CreateRay',
        ox: params.ox,
        oy: params.oy,
        dx: params.dx,
        dy: params.dy,
        layer_id: params.layer_id ?? app.activeLayerId,
      });
    },
    invoke: () => new RayHandler(),
    schema: {
      type: 'object',
      properties: {
        ox: { type: 'number', description: 'Origin X' },
        oy: { type: 'number', description: 'Origin Y' },
        dx: { type: 'number', description: 'Direction X' },
        dy: { type: 'number', description: 'Direction Y' },
      },
      required: ['ox', 'oy', 'dx', 'dy'],
    },
  });

  commandRegistry.register({
    id: 'draw_donut',
    label: 'Donut',
    description: 'Draw a donut (filled ring)',
    aliases: ['do', 'donut'],
    category: 'draw',
    execute: (params: {
      cx: number;
      cy: number;
      inner_radius: number;
      outer_radius: number;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'CreateDonut',
        cx: params.cx,
        cy: params.cy,
        inner_radius: params.inner_radius,
        outer_radius: params.outer_radius,
        layer_id: params.layer_id ?? app.activeLayerId,
      });
    },
    invoke: () => new DonutHandler(),
    schema: {
      type: 'object',
      properties: {
        cx: { type: 'number', description: 'Center X' },
        cy: { type: 'number', description: 'Center Y' },
        inner_radius: { type: 'number', description: 'Inner radius' },
        outer_radius: { type: 'number', description: 'Outer radius' },
      },
      required: ['cx', 'cy', 'inner_radius', 'outer_radius'],
    },
  });

  commandRegistry.register({
    id: 'draw_hatch',
    label: 'Hatch',
    aliases: ['h', 'hatch', 'bh'],
    category: 'draw',
    execute: (params: {
      boundary_ids: string[];
      pattern?: string;
      scale?: number;
      angle?: number;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'CreateHatch',
        boundary_ids: params.boundary_ids,
        pattern: params.pattern ?? 'SOLID',
        scale: params.scale ?? 1.0,
        angle: params.angle ?? 0,
        layer_id: params.layer_id ?? app.activeLayerId,
      });
    },
    invoke: () => new HatchHandler(),
    schema: {
      type: 'object',
      properties: {
        boundary_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of entities forming the closed boundary',
        },
        pattern: { type: 'string', description: 'Hatch pattern name', default: 'SOLID' },
        scale: { type: 'number', description: 'Pattern scale', default: 1.0 },
        angle: { type: 'number', description: 'Pattern angle in degrees', default: 0 },
        layer_id: { type: 'string', description: 'Layer ID' },
      },
      required: ['boundary_ids'],
    },
  });

  // --- Modify tools ---

  commandRegistry.register({
    id: 'modify_move',
    label: 'Move',
    description: 'Move selected entities by a displacement',
    aliases: ['m', 'move'],
    category: 'edit',
    execute: (params: { ids: string[]; dx: number; dy: number }) => {
      for (const id of params.ids) {
        app.executeCommand({ type: 'MoveEntity', id, dx: params.dx, dy: params.dy });
      }
    },
    invoke: () => new MoveHandler(),
    schema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs to move' },
        dx: { type: 'number', description: 'X displacement' },
        dy: { type: 'number', description: 'Y displacement' },
      },
      required: ['ids', 'dx', 'dy'],
    },
  });

  commandRegistry.register({
    id: 'modify_copy',
    label: 'Copy',
    description: 'Duplicate selected entities to a new location',
    aliases: ['co', 'copy'],
    category: 'edit',
    execute: (params: { ids: string[]; dx: number; dy: number }) => {
      for (const id of params.ids) {
        const result = app.executeCommand({ type: 'CopyEntity', id });
        if (result.success && result.created_ids[0]) {
          app.executeCommand({
            type: 'MoveEntity',
            id: result.created_ids[0],
            dx: params.dx,
            dy: params.dy,
          });
        }
      }
    },
    invoke: () => new CopyHandler(),
    schema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs to copy' },
        dx: { type: 'number', description: 'X displacement' },
        dy: { type: 'number', description: 'Y displacement' },
      },
      required: ['ids', 'dx', 'dy'],
    },
  });

  commandRegistry.register({
    id: 'modify_rotate',
    label: 'Rotate',
    description: 'Rotate selected entities around a base point',
    aliases: ['ro', 'rotate'],
    category: 'edit',
    execute: (params: { ids: string[]; cx: number; cy: number; angle: number }) => {
      for (const id of params.ids) {
        app.executeCommand({
          type: 'RotateEntity',
          id,
          cx: params.cx,
          cy: params.cy,
          angle: params.angle,
        });
      }
    },
    invoke: () => new RotateHandler(),
    schema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs' },
        cx: { type: 'number', description: 'Center X' },
        cy: { type: 'number', description: 'Center Y' },
        angle: { type: 'number', description: 'Rotation angle (radians)' },
      },
      required: ['ids', 'cx', 'cy', 'angle'],
    },
  });

  commandRegistry.register({
    id: 'modify_scale',
    label: 'Scale',
    description: 'Resize selected entities by a scale factor',
    aliases: ['sc', 'scale'],
    category: 'edit',
    execute: (params: { ids: string[]; cx: number; cy: number; factor: number }) => {
      for (const id of params.ids) {
        app.executeCommand({
          type: 'ScaleEntity',
          id,
          cx: params.cx,
          cy: params.cy,
          factor: params.factor,
        });
      }
    },
    invoke: () => new ScaleHandler(),
    schema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs' },
        cx: { type: 'number', description: 'Center X' },
        cy: { type: 'number', description: 'Center Y' },
        factor: { type: 'number', description: 'Scale factor' },
      },
      required: ['ids', 'cx', 'cy', 'factor'],
    },
  });

  commandRegistry.register({
    id: 'modify_mirror',
    label: 'Mirror',
    description: 'Create a mirrored copy across a line',
    aliases: ['mi', 'mirror'],
    category: 'edit',
    execute: (params: { ids: string[]; x1: number; y1: number; x2: number; y2: number }) => {
      for (const id of params.ids) {
        app.executeCommand({
          type: 'MirrorEntity',
          id,
          x1: params.x1,
          y1: params.y1,
          x2: params.x2,
          y2: params.y2,
        });
      }
    },
    invoke: () => new MirrorHandler(),
    schema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs' },
        x1: { type: 'number', description: 'Mirror line point 1 X' },
        y1: { type: 'number', description: 'Mirror line point 1 Y' },
        x2: { type: 'number', description: 'Mirror line point 2 X' },
        y2: { type: 'number', description: 'Mirror line point 2 Y' },
      },
      required: ['ids', 'x1', 'y1', 'x2', 'y2'],
    },
  });

  commandRegistry.register({
    id: 'modify_offset',
    label: 'Offset',
    description: 'Create a parallel copy at a specified distance',
    aliases: ['o', 'offset'],
    category: 'edit',
    execute: (params: { id: string; distance: number }) => {
      app.executeCommand({ type: 'OffsetEntity', id: params.id, distance: params.distance });
    },
    invoke: () => new OffsetHandler(),
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Entity ID' },
        distance: { type: 'number', description: 'Offset distance' },
      },
      required: ['id', 'distance'],
    },
  });

  commandRegistry.register({
    id: 'modify_trim',
    label: 'Trim',
    description: 'Trim entities at a cutting boundary',
    aliases: ['tr', 'trim'],
    category: 'edit',
    execute: (params: { id: string; boundary_id: string; pick_x: number; pick_y: number }) => {
      app.executeCommand({
        type: 'TrimEntity',
        id: params.id,
        boundary_id: params.boundary_id,
        pick_x: params.pick_x,
        pick_y: params.pick_y,
      });
    },
    invoke: () => new TrimExtendHandler('trim'),
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Entity ID to trim' },
        boundary_id: { type: 'string', description: 'Cutting boundary entity ID' },
        pick_x: { type: 'number', description: 'Pick point X' },
        pick_y: { type: 'number', description: 'Pick point Y' },
      },
      required: ['id', 'boundary_id', 'pick_x', 'pick_y'],
    },
  });

  commandRegistry.register({
    id: 'modify_extend',
    label: 'Extend',
    description: 'Extend entities to meet a boundary',
    aliases: ['ex', 'extend'],
    category: 'edit',
    execute: (params: { id: string; boundary_id: string }) => {
      app.executeCommand({ type: 'ExtendEntity', id: params.id, boundary_id: params.boundary_id });
    },
    invoke: () => new TrimExtendHandler('extend'),
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Entity ID to extend' },
        boundary_id: { type: 'string', description: 'Boundary entity ID' },
      },
      required: ['id', 'boundary_id'],
    },
  });

  commandRegistry.register({
    id: 'modify_fillet',
    label: 'Fillet',
    description: 'Round the corner between two entities',
    aliases: ['f', 'fillet'],
    category: 'edit',
    execute: (params: { id_a: string; id_b: string; radius: number }) => {
      app.executeCommand({
        type: 'Fillet',
        id_a: params.id_a,
        id_b: params.id_b,
        radius: params.radius,
      });
    },
    invoke: () => new FilletHandler(),
    schema: {
      type: 'object',
      properties: {
        id_a: { type: 'string', description: 'First entity ID' },
        id_b: { type: 'string', description: 'Second entity ID' },
        radius: { type: 'number', description: 'Fillet radius' },
      },
      required: ['id_a', 'id_b', 'radius'],
    },
  });

  commandRegistry.register({
    id: 'modify_chamfer',
    label: 'Chamfer',
    description: 'Bevel the corner between two entities',
    aliases: ['cha', 'chamfer'],
    category: 'edit',
    execute: (params: { id_a: string; id_b: string; dist_a: number; dist_b: number }) => {
      app.executeCommand({
        type: 'Chamfer',
        id_a: params.id_a,
        id_b: params.id_b,
        dist_a: params.dist_a,
        dist_b: params.dist_b,
      });
    },
    invoke: () => new ChamferHandler(),
    schema: {
      type: 'object',
      properties: {
        id_a: { type: 'string', description: 'First entity ID' },
        id_b: { type: 'string', description: 'Second entity ID' },
        dist_a: { type: 'number', description: 'Distance on first entity' },
        dist_b: { type: 'number', description: 'Distance on second entity' },
      },
      required: ['id_a', 'id_b', 'dist_a', 'dist_b'],
    },
  });

  commandRegistry.register({
    id: 'modify_explode',
    label: 'Explode',
    description: 'Break a compound entity into individual parts',
    aliases: ['x', 'explode'],
    category: 'edit',
    execute: (params: { entity_id: string }) => {
      app.executeCommand({ type: 'Explode', entity_id: params.entity_id });
    },
    invoke: () => new ExplodeHandler(),
    schema: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'Entity ID to explode' },
      },
      required: ['entity_id'],
    },
  });

  commandRegistry.register({
    id: 'modify_join',
    label: 'Join',
    description: 'Join connected entities into one',
    aliases: ['j', 'join'],
    category: 'edit',
    execute: (params: { ids: string[] }) => {
      app.executeCommand({ type: 'JoinEntities', ids: params.ids });
    },
    invoke: () => new JoinHandler(),
    schema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs to join' },
      },
      required: ['ids'],
    },
  });

  commandRegistry.register({
    id: 'modify_array',
    label: 'Array',
    description: 'Create rectangular or polar copies of entities',
    aliases: ['ar', 'array'],
    category: 'edit',
    execute: (params: {
      type: string;
      entity_ids: string[];
      rows?: number;
      cols?: number;
      row_spacing?: number;
      col_spacing?: number;
      center_x?: number;
      center_y?: number;
      count?: number;
      angle?: number;
    }) => {
      if (params.type === 'rectangular') {
        app.executeCommand({
          type: 'ArrayRectangular',
          entity_ids: params.entity_ids,
          rows: params.rows ?? 2,
          cols: params.cols ?? 2,
          row_spacing: params.row_spacing ?? 10,
          col_spacing: params.col_spacing ?? 10,
        });
      } else {
        app.executeCommand({
          type: 'ArrayPolar',
          entity_ids: params.entity_ids,
          center_x: params.center_x ?? 0,
          center_y: params.center_y ?? 0,
          count: params.count ?? 4,
          angle: params.angle ?? 360,
          rotate_items: true,
        });
      }
    },
    invoke: () => new ArrayHandler(),
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['rectangular', 'polar'], description: 'Array type' },
        entity_ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs' },
        rows: { type: 'number', description: 'Number of rows (rectangular)' },
        cols: { type: 'number', description: 'Number of columns (rectangular)' },
        row_spacing: { type: 'number', description: 'Row spacing (rectangular)' },
        col_spacing: { type: 'number', description: 'Column spacing (rectangular)' },
        center_x: { type: 'number', description: 'Center X (polar)' },
        center_y: { type: 'number', description: 'Center Y (polar)' },
        count: { type: 'number', description: 'Number of items (polar)' },
        angle: { type: 'number', description: 'Total angle in degrees (polar)' },
      },
      required: ['type', 'entity_ids'],
    },
  });

  commandRegistry.register({
    id: 'modify_matchprop',
    label: 'Match Properties',
    description: 'Copy properties from one entity to others',
    aliases: ['matchprop', 'ma'],
    category: 'edit',
    execute: (params: { source_id: string; target_ids: string[] }) => {
      app.executeCommand({
        type: 'MatchProperties',
        source_id: params.source_id,
        target_ids: params.target_ids,
      });
    },
    invoke: () => new MatchPropHandler(),
    schema: {
      type: 'object',
      properties: {
        source_id: { type: 'string', description: 'Source entity ID' },
        target_ids: { type: 'array', items: { type: 'string' }, description: 'Target entity IDs' },
      },
      required: ['source_id', 'target_ids'],
    },
  });

  commandRegistry.register({
    id: 'modify_lengthen',
    label: 'Lengthen',
    description: 'Change the length of lines and arcs',
    aliases: ['len', 'lengthen'],
    category: 'edit',
    execute: (params: { entity_id: string; mode: string; value: number; end: string }) => {
      app.executeCommand({
        type: 'Lengthen',
        entity_id: params.entity_id,
        mode: params.mode,
        value: params.value,
        end: params.end,
      });
    },
    invoke: () => new LengthenHandler(),
    schema: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'Entity ID' },
        mode: { type: 'string', enum: ['delta', 'percent', 'total'], description: 'Lengthen mode' },
        value: { type: 'number', description: 'Lengthen value' },
        end: { type: 'string', enum: ['start', 'end'], description: 'Which end to lengthen' },
      },
      required: ['entity_id', 'mode', 'value', 'end'],
    },
  });

  commandRegistry.register({
    id: 'modify_break',
    label: 'Break',
    description: 'Split an entity at one or two points',
    aliases: ['break', 'br'],
    category: 'edit',
    execute: (params: { entity_id: string; x1: number; y1: number; x2?: number; y2?: number }) => {
      if (params.x2 !== undefined && params.y2 !== undefined) {
        app.executeCommand({
          type: 'Break',
          entity_id: params.entity_id,
          x1: params.x1,
          y1: params.y1,
          x2: params.x2,
          y2: params.y2,
        });
      } else {
        app.executeCommand({
          type: 'BreakAtPoint',
          entity_id: params.entity_id,
          px: params.x1,
          py: params.y1,
        });
      }
    },
    invoke: () => new BreakHandler(),
    schema: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'Entity ID' },
        x1: { type: 'number', description: 'First break point X' },
        y1: { type: 'number', description: 'First break point Y' },
        x2: { type: 'number', description: 'Second break point X (omit for break-at-point)' },
        y2: { type: 'number', description: 'Second break point Y (omit for break-at-point)' },
      },
      required: ['entity_id', 'x1', 'y1'],
    },
  });

  commandRegistry.register({
    id: 'modify_delete',
    label: 'Delete',
    description: 'Remove selected entities from the drawing',
    aliases: ['del', 'erase'],
    category: 'edit',
    execute: (params: { ids?: string[] }) => {
      const ids = params?.ids ?? [];
      for (const id of ids) {
        app.executeCommand({ type: 'DeleteEntity', id });
      }
    },
    invoke: () => new DeleteHandler(),
    schema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs to delete' },
      },
      required: ['ids'],
    },
  });

  // --- Annotate tools ---

  commandRegistry.register({
    id: 'annotate_text',
    label: 'Text',
    description: 'Place single-line text annotation',
    aliases: ['dt', 'text', 'dtext'],
    category: 'annotate',
    execute: (params: {
      x: number;
      y: number;
      content: string;
      height?: number;
      rotation?: number;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'CreateText',
        x: params.x,
        y: params.y,
        content: params.content,
        height: params.height ?? 2.5,
        rotation: params.rotation ?? 0,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => new TextHandler(),
    schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Insertion X' },
        y: { type: 'number', description: 'Insertion Y' },
        content: { type: 'string', description: 'Text content' },
        height: { type: 'number', description: 'Text height', default: 2.5 },
        rotation: { type: 'number', description: 'Text rotation (radians)', default: 0 },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['x', 'y', 'content'],
    },
  });

  commandRegistry.register({
    id: 'draw_mtext',
    label: 'Multiline Text',
    aliases: ['mt', 'mtext'],
    category: 'annotate',
    execute: (params: {
      x: number;
      y: number;
      content: string;
      width?: number;
      height?: number;
      rotation?: number;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'CreateMText',
        x: params.x,
        y: params.y,
        content: params.content,
        width: params.width ?? 10,
        height: params.height ?? 2.5,
        rotation: params.rotation ?? 0,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => {
      const handler = new MTextHandler();
      handler.setEditorCallback((req) => {
        if (req) {
          app.mtextEditorState = {
            x: req.x,
            y: req.y,
            content: '',
            onSave: req.onSave,
            onCancel: req.onCancel,
          };
        } else {
          app.mtextEditorState = null;
        }
      });
      return handler;
    },
    schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Insertion X' },
        y: { type: 'number', description: 'Insertion Y' },
        content: { type: 'string', description: 'Multiline text content' },
        width: { type: 'number', description: 'Text box width', default: 10 },
        height: { type: 'number', description: 'Text height', default: 2.5 },
        rotation: { type: 'number', description: 'Text rotation (radians)', default: 0 },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['x', 'y', 'content'],
    },
  });

  commandRegistry.register({
    id: 'annotate_dimension',
    label: 'Dimension',
    description: 'Add a linear dimension between two points',
    aliases: ['dim', 'dimension', 'dimlinear'],
    category: 'annotate',
    execute: (params: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      offset: number;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'CreateDimension',
        x1: params.x1,
        y1: params.y1,
        x2: params.x2,
        y2: params.y2,
        offset: params.offset,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => new DimensionHandler(),
    schema: {
      type: 'object',
      properties: {
        x1: { type: 'number', description: 'First point X' },
        y1: { type: 'number', description: 'First point Y' },
        x2: { type: 'number', description: 'Second point X' },
        y2: { type: 'number', description: 'Second point Y' },
        offset: { type: 'number', description: 'Offset distance' },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['x1', 'y1', 'x2', 'y2', 'offset'],
    },
  });

  commandRegistry.register({
    id: 'annotate_aligneddim',
    label: 'Aligned Dimension',
    description: 'Add a dimension aligned to two points',
    aliases: ['dal', 'dimaligned', 'aligneddim'],
    category: 'annotate',
    execute: (params: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      offset: number;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'CreateAlignedDimension',
        x1: params.x1,
        y1: params.y1,
        x2: params.x2,
        y2: params.y2,
        offset: params.offset,
        layer_id: params.layer_id ?? 'default',
      });
    },
    invoke: () => new AlignedDimensionHandler(),
    schema: {
      type: 'object',
      properties: {
        x1: { type: 'number', description: 'First point X' },
        y1: { type: 'number', description: 'First point Y' },
        x2: { type: 'number', description: 'Second point X' },
        y2: { type: 'number', description: 'Second point Y' },
        offset: { type: 'number', description: 'Offset distance' },
        layer_id: { type: 'string', description: 'Layer ID', default: 'default' },
      },
      required: ['x1', 'y1', 'x2', 'y2', 'offset'],
    },
  });

  commandRegistry.register({
    id: 'annotate_measuredist',
    label: 'Measure Distance',
    description: 'Measure the distance between two points',
    aliases: ['dist', 'measuredist'],
    category: 'annotate',
    execute: (params: { x1: number; y1: number; x2: number; y2: number }) => {
      return app.executeCommand({
        type: 'MeasureDistance',
        x1: params.x1,
        y1: params.y1,
        x2: params.x2,
        y2: params.y2,
      });
    },
    invoke: () => new MeasureDistanceHandler(),
    schema: {
      type: 'object',
      properties: {
        x1: { type: 'number', description: 'First point X' },
        y1: { type: 'number', description: 'First point Y' },
        x2: { type: 'number', description: 'Second point X' },
        y2: { type: 'number', description: 'Second point Y' },
      },
      required: ['x1', 'y1', 'x2', 'y2'],
    },
  });

  commandRegistry.register({
    id: 'annotate_measurearea',
    label: 'Measure Area',
    description: 'Calculate the area of a closed entity',
    aliases: ['area', 'measurearea'],
    category: 'annotate',
    execute: (params: { entity_id: string }) => {
      return app.executeCommand({ type: 'MeasureArea', entity_id: params.entity_id });
    },
    invoke: () => new MeasureAreaHandler(),
    schema: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'Entity ID to measure' },
      },
      required: ['entity_id'],
    },
  });

  commandRegistry.register({
    id: 'draw_table',
    label: 'Table',
    description: 'Insert a table with rows and columns',
    aliases: ['table'],
    category: 'annotate',
    execute: (params: {
      x: number;
      y: number;
      rows?: number;
      cols?: number;
      row_height?: number;
      col_widths?: number[];
      cells?: string[];
      layer_id?: string;
    }) => {
      const rows = params.rows ?? 5;
      const cols = params.cols ?? 3;
      app.executeCommand({
        type: 'CreateTable',
        x: params.x,
        y: params.y,
        rows,
        cols,
        row_height: params.row_height ?? 1.0,
        col_widths: params.col_widths ?? Array(cols).fill(3.0),
        cells: params.cells ?? Array(rows * cols).fill(''),
        layer_id: params.layer_id ?? app.activeLayerId,
      });
    },
    invoke: () => new TableHandler(),
    schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Insertion point X' },
        y: { type: 'number', description: 'Insertion point Y' },
        rows: { type: 'number', description: 'Number of rows', default: 5 },
        cols: { type: 'number', description: 'Number of columns', default: 3 },
        row_height: { type: 'number', description: 'Height of each row', default: 1.0 },
        col_widths: {
          type: 'array',
          items: { type: 'number' },
          description: 'Width of each column',
        },
        cells: {
          type: 'array',
          items: { type: 'string' },
          description: 'Cell contents in row-major order',
        },
        layer_id: { type: 'string', description: 'Layer ID' },
      },
      required: ['x', 'y'],
    },
  });

  // --- Block tools ---

  commandRegistry.register({
    id: 'create_block',
    label: 'Block',
    description: 'Create a block definition from selected entities',
    aliases: ['block', 'b'],
    category: 'block',
    execute: (params: { name: string; base_x: number; base_y: number; entity_ids: string[] }) => {
      app.executeCommand({
        type: 'CreateBlock',
        name: params.name,
        base_x: params.base_x,
        base_y: params.base_y,
        entity_ids: params.entity_ids,
      });
    },
    invoke: () => new BlockCreateHandler(),
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Block name' },
        base_x: { type: 'number', description: 'Base point X' },
        base_y: { type: 'number', description: 'Base point Y' },
        entity_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Entity IDs to include in block',
        },
      },
      required: ['name', 'base_x', 'base_y', 'entity_ids'],
    },
  });

  commandRegistry.register({
    id: 'insert_block',
    label: 'Insert',
    description: 'Insert a block reference into the drawing',
    aliases: ['insert', 'i'],
    category: 'block',
    execute: (params: {
      block_id: string;
      x: number;
      y: number;
      rotation?: number;
      scale_x?: number;
      scale_y?: number;
      layer_id?: string;
    }) => {
      app.executeCommand({
        type: 'InsertBlock',
        block_id: params.block_id,
        x: params.x,
        y: params.y,
        rotation: params.rotation ?? 0,
        scale_x: params.scale_x ?? 1,
        scale_y: params.scale_y ?? 1,
        layer_id: params.layer_id ?? app.activeLayerId,
      });
    },
    invoke: () => new BlockInsertHandler(),
    schema: {
      type: 'object',
      properties: {
        block_id: { type: 'string', description: 'Block definition ID' },
        x: { type: 'number', description: 'Insertion point X' },
        y: { type: 'number', description: 'Insertion point Y' },
        rotation: { type: 'number', description: 'Rotation angle (radians)', default: 0 },
        scale_x: { type: 'number', description: 'X scale factor', default: 1 },
        scale_y: { type: 'number', description: 'Y scale factor', default: 1 },
        layer_id: { type: 'string', description: 'Layer ID' },
      },
      required: ['block_id', 'x', 'y'],
    },
  });

  // --- Non-tool commands ---

  commandRegistry.register({
    id: 'undo',
    label: 'Undo',
    description: 'Undo the last operation',
    aliases: ['u'],
    category: 'edit',
    execute: () => app.undo(),
  });

  commandRegistry.register({
    id: 'redo',
    label: 'Redo',
    description: 'Redo the last undone operation',
    aliases: [],
    category: 'edit',
    execute: () => app.redo(),
  });

  commandRegistry.register({
    id: 'zoom_extents',
    label: 'Zoom Extents',
    aliases: ['ze', 'zoom extents'],
    category: 'view',
    transparent: true,
    execute: () => {
      app.renderer?.zoomExtents();
    },
  });

  commandRegistry.register({
    id: 'zoom_window',
    label: 'Zoom Window',
    aliases: ['zw', 'zoom window'],
    category: 'view',
    transparent: true,
    execute: () => {},
    invoke: () => new ZoomWindowHandler(),
  });

  commandRegistry.register({
    id: 'zoom_in',
    label: 'Zoom In',
    aliases: ['zi', 'zoom in'],
    category: 'view',
    transparent: true,
    execute: () => {
      app.renderer?.zoomIn();
    },
  });

  commandRegistry.register({
    id: 'zoom_out',
    label: 'Zoom Out',
    aliases: ['zo', 'zoom out'],
    category: 'view',
    transparent: true,
    execute: () => {
      app.renderer?.zoomOut();
    },
  });

  commandRegistry.register({
    id: 'snap_toggle',
    label: 'Object Snap Toggle',
    aliases: ['osnap'],
    category: 'view',
    transparent: true,
    execute: () => {
      app.snapEnabled = !app.snapEnabled;
      if (app.renderer?.snapEngine) app.renderer.snapEngine.config.enabled = app.snapEnabled;
      app.statusText = `OSnap: ${app.snapEnabled ? 'ON' : 'OFF'}`;
    },
  });

  commandRegistry.register({
    id: 'grid_snap_toggle',
    label: 'Grid Snap Toggle',
    aliases: ['gridsnap'],
    category: 'view',
    transparent: true,
    execute: () => {
      app.gridSnapEnabled = !app.gridSnapEnabled;
      if (app.renderer?.snapEngine) app.renderer.snapEngine.config.types.grid = app.gridSnapEnabled;
      app.statusText = `Grid Snap: ${app.gridSnapEnabled ? 'ON' : 'OFF'}`;
    },
  });

  commandRegistry.register({
    id: 'ortho_toggle',
    label: 'Ortho Toggle',
    aliases: ['ortho'],
    category: 'view',
    transparent: true,
    execute: () => {
      app.orthoMode = !app.orthoMode;
      app.statusText = `Ortho: ${app.orthoMode ? 'ON' : 'OFF'}`;
    },
  });

  commandRegistry.register({
    id: 'layer_manager',
    label: 'Layer Manager',
    aliases: ['la', 'layers', 'layer'],
    category: 'view',
    execute: () => {
      app.layerManagerOpen = !app.layerManagerOpen;
    },
  });

  // --- Layer operations ---

  commandRegistry.register({
    id: 'set_layer_visibility',
    label: 'Set Layer Visibility',
    aliases: [],
    category: 'view',
    execute: (params: { layer_id: string; visible: boolean }) => {
      app.executeCommand({
        type: 'SetLayerVisibility',
        layer_id: params.layer_id,
        visible: params.visible,
      });
    },
    schema: {
      type: 'object',
      properties: {
        layer_id: { type: 'string', description: 'Layer ID' },
        visible: { type: 'boolean', description: 'Whether the layer is visible' },
      },
      required: ['layer_id', 'visible'],
    },
  });

  commandRegistry.register({
    id: 'set_layer_lock',
    label: 'Set Layer Lock',
    aliases: [],
    category: 'view',
    execute: (params: { layer_id: string; locked: boolean }) => {
      app.executeCommand({
        type: 'SetLayerLock',
        layer_id: params.layer_id,
        locked: params.locked,
      });
    },
    schema: {
      type: 'object',
      properties: {
        layer_id: { type: 'string', description: 'Layer ID' },
        locked: { type: 'boolean', description: 'Whether the layer is locked' },
      },
      required: ['layer_id', 'locked'],
    },
  });

  // --- Design Center ---

  commandRegistry.register({
    id: 'design_center',
    label: 'Design Center',
    aliases: ['dc', 'designcenter'],
    category: 'view',
    execute: () => {
      app.designCenterOpen = !app.designCenterOpen;
    },
  });

  // --- Text style manager ---

  commandRegistry.register({
    id: 'text_style_manager',
    label: 'Text Style Manager',
    aliases: ['style', 'st', 'textstyle'],
    category: 'annotate',
    execute: () => {
      app.textStyleManagerOpen = !app.textStyleManagerOpen;
    },
  });

  // --- Dim style manager ---

  commandRegistry.register({
    id: 'dim_style_manager',
    label: 'Dimension Style Manager',
    aliases: ['dimstyle', 'd', 'ddim', 'dst'],
    category: 'annotate',
    execute: () => {
      app.dimStyleManagerOpen = !app.dimStyleManagerOpen;
    },
  });

  // --- MLeader style manager ---

  commandRegistry.register({
    id: 'mleader_style_manager',
    label: 'Multileader Style Manager',
    aliases: ['mleaderstyle', 'mlstyle', 'mlea'],
    category: 'annotate',
    execute: () => {
      app.mleaderStyleManagerOpen = !app.mleaderStyleManagerOpen;
    },
  });

  // --- Table style manager ---

  commandRegistry.register({
    id: 'table_style_manager',
    label: 'Table Style Manager',
    aliases: ['tablestyle', 'tbstyle', 'tstyle'],
    category: 'annotate',
    execute: () => {
      app.tableStyleManagerOpen = !app.tableStyleManagerOpen;
    },
  });

  // --- Drawing properties (DWGPROPS) ---

  commandRegistry.register({
    id: 'drawing_properties',
    label: 'Drawing Properties',
    aliases: ['dwgprops', 'props', 'drawingproperties'],
    category: 'view',
    execute: () => {
      app.drawingPropertiesOpen = !app.drawingPropertiesOpen;
    },
  });

  commandRegistry.register({
    id: 'plugins',
    label: 'Add-in Manager',
    aliases: ['plugins', 'addin'],
    category: 'view',
    execute: () => {
      app.pluginManagerOpen = !app.pluginManagerOpen;
    },
  });

  commandRegistry.register({
    id: 'collab',
    label: 'Collaboration',
    aliases: ['collab', 'share'],
    category: 'view',
    execute: () => {
      app.collabPanelOpen = !app.collabPanelOpen;
    },
  });

  commandRegistry.register({
    id: 'select_all',
    label: 'Select All',
    aliases: ['selectall'],
    category: 'select',
    execute: () => {},
  });

  // --- Constraint commands ---

  commandRegistry.register({
    id: 'constraint_horizontal',
    label: 'Horizontal Constraint',
    description: 'Constrain a line to be horizontal',
    aliases: ['constraint_horizontal'],
    category: 'modify',
    execute: (params: { entity_id: string }) => {
      app.executeCommand({ type: 'AddConstraintHorizontal', entity_id: params.entity_id });
      app.statusText = 'Horizontal constraint added';
    },
    schema: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'Entity ID to constrain' },
      },
      required: ['entity_id'],
    },
  });

  commandRegistry.register({
    id: 'constraint_vertical',
    label: 'Vertical Constraint',
    description: 'Constrain a line to be vertical',
    aliases: ['constraint_vertical'],
    category: 'modify',
    execute: (params: { entity_id: string }) => {
      app.executeCommand({ type: 'AddConstraintVertical', entity_id: params.entity_id });
      app.statusText = 'Vertical constraint added';
    },
    schema: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'Entity ID to constrain' },
      },
      required: ['entity_id'],
    },
  });

  commandRegistry.register({
    id: 'constraint_parallel',
    label: 'Parallel Constraint',
    description: 'Constrain two lines to be parallel',
    aliases: ['constraint_parallel'],
    category: 'modify',
    execute: (params: { entity_a: string; entity_b: string }) => {
      app.executeCommand({
        type: 'AddConstraintParallel',
        entity_a: params.entity_a,
        entity_b: params.entity_b,
      });
      app.statusText = 'Parallel constraint added';
    },
    schema: {
      type: 'object',
      properties: {
        entity_a: { type: 'string', description: 'First entity ID' },
        entity_b: { type: 'string', description: 'Second entity ID' },
      },
      required: ['entity_a', 'entity_b'],
    },
  });

  commandRegistry.register({
    id: 'constraint_perpendicular',
    label: 'Perpendicular Constraint',
    description: 'Constrain two lines to be perpendicular',
    aliases: ['constraint_perpendicular'],
    category: 'modify',
    execute: (params: { entity_a: string; entity_b: string }) => {
      app.executeCommand({
        type: 'AddConstraintPerpendicular',
        entity_a: params.entity_a,
        entity_b: params.entity_b,
      });
      app.statusText = 'Perpendicular constraint added';
    },
    schema: {
      type: 'object',
      properties: {
        entity_a: { type: 'string', description: 'First entity ID' },
        entity_b: { type: 'string', description: 'Second entity ID' },
      },
      required: ['entity_a', 'entity_b'],
    },
  });

  // --- Utilities ---

  commandRegistry.register({
    id: 'purge',
    label: 'Purge Unused',
    description: 'Remove unused layers, blocks, and text styles',
    aliases: ['purge', 'pu'],
    category: 'utility',
    execute: () => {
      const result = app.executeCommand({ type: 'PurgeUnused' });
      if (result.success) {
        app.statusText = 'Purge complete — unused items removed';
      } else {
        app.statusText = `Purge failed: ${result.error || 'unknown error'}`;
      }
    },
  });

  commandRegistry.register({
    id: 'audit',
    label: 'Audit',
    description: 'Check drawing integrity and report statistics',
    aliases: ['audit'],
    category: 'utility',
    execute: () => {
      if (!app.kernel) {
        app.statusText = 'Audit: kernel not initialized';
        return;
      }
      const entityCount = app.kernel.entity_count();
      const layers = app.getLayers();
      let blockCount = 0;
      try {
        const blocks = JSON.parse(app.kernel.get_block_defs_json());
        blockCount = Array.isArray(blocks) ? blocks.length : 0;
      } catch {
        blockCount = 0;
      }
      const constraintCount = app.kernel.constraint_count();
      const eventCount = app.kernel.event_count();

      const lines = [
        `Audit report:`,
        `  Entities: ${entityCount}`,
        `  Layers: ${layers.length}`,
        `  Blocks: ${blockCount}`,
        `  Constraints: ${constraintCount}`,
        `  Events: ${eventCount}`,
      ];
      app.statusText = lines.join(' | ');
    },
  });

  // --- Named views ---

  commandRegistry.register({
    id: 'view_save',
    label: 'Save View',
    description: 'Save the current view state with a name',
    aliases: ['view', 'v'],
    category: 'view',
    execute: (params: { name?: string }) => {
      const name = params?.name;
      if (!name) {
        app.statusText = 'VIEW: Enter a name to save the current view';
        return;
      }
      app.saveNamedView(name);
    },
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the saved view' },
      },
      required: ['name'],
    },
  });

  commandRegistry.register({
    id: 'view_restore',
    label: 'Restore View',
    description: 'Restore a previously saved named view',
    aliases: ['vr', 'restore-view'],
    category: 'view',
    execute: (params: { name?: string }) => {
      const name = params?.name;
      if (!name) {
        const names = Array.from(app.namedViews.keys());
        if (names.length === 0) {
          app.statusText = 'No saved views. Use VIEW to save one first.';
        } else {
          app.statusText = `Saved views: ${names.join(', ')}. Enter a name to restore.`;
        }
        return;
      }
      app.restoreNamedView(name);
    },
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the view to restore' },
      },
      required: ['name'],
    },
  });

  // --- Quick Select ---

  commandRegistry.register({
    id: 'quick_select',
    label: 'Quick Select',
    aliases: ['qselect', 'qs'],
    category: 'select',
    execute: () => {
      app.quickSelectDialogOpen = true;
    },
  });

  // --- Managers ---

  commandRegistry.register({
    id: 'xref_manager',
    label: 'External References',
    aliases: ['xr', 'xref'],
    category: 'view',
    execute: () => {
      app.xrefManagerOpen = !app.xrefManagerOpen;
    },
  });

  commandRegistry.register({
    id: 'action_recorder',
    label: 'Action Recorder',
    aliases: ['actrecord'],
    category: 'view',
    execute: () => {
      app.actionRecorderOpen = !app.actionRecorderOpen;
    },
  });

  // --- Settings ---

  commandRegistry.register({
    id: 'units',
    label: 'Drawing Units',
    aliases: ['un', 'units', 'ddunits'],
    category: 'view',
    execute: () => {
      app.unitsDialogOpen = true;
    },
    schema: {
      type: 'object',
      properties: {
        linear_type: {
          type: 'string',
          enum: ['Decimal', 'Engineering', 'Architectural', 'Fractional', 'Scientific'],
          description: 'Linear unit format',
        },
        linear_precision: { type: 'number', description: 'Decimal places (0-8)' },
        angular_type: {
          type: 'string',
          enum: ['DecimalDegrees', 'DMS', 'Grads', 'Radians'],
          description: 'Angular unit format',
        },
        angular_precision: { type: 'number', description: 'Angular decimal places (0-8)' },
        insertion_scale: { type: 'number', description: 'Block insertion scale factor' },
      },
    },
  });
}
