export type ToolCategory =
  | 'draw'
  | 'edit'
  | 'query'
  | 'state'
  | 'layer'
  | 'constraint'
  | 'style'
  | 'measure'
  | 'block'
  | 'text_style'
  | 'dim_style'
  | 'mleader_style'
  | 'table_style'
  | 'group'
  | 'ucs'
  | 'view'
  | 'array';

export type ParamType = 'number' | 'string' | 'boolean' | 'number[][]' | 'string[]' | 'number[]';

export interface ParamDef {
  type: ParamType;
  description: string;
  optional?: boolean;
  default?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: Record<string, ParamDef>;
  commandType: string;
  parameterMapping?: Record<string, string>;
  /** Tool uses per-entity dispatch (ids[] → one command per entity) */
  perEntity?: boolean;
  /** Extra defaults to inject into the command (e.g., layer_id fallback) */
  defaults?: Record<string, unknown>;
}

// ─── Drawing Tools ───────────────────────────────────────────────────────────

const DRAW_TOOLS: ToolDefinition[] = [
  {
    name: 'draw_line',
    description: 'Draw a line segment between two points',
    category: 'draw',
    commandType: 'CreateLine',
    parameters: {
      x1: { type: 'number', description: 'Start X coordinate' },
      y1: { type: 'number', description: 'Start Y coordinate' },
      x2: { type: 'number', description: 'End X coordinate' },
      y2: { type: 'number', description: 'End Y coordinate' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_circle',
    description: 'Draw a circle defined by center point and radius',
    category: 'draw',
    commandType: 'CreateCircle',
    parameters: {
      cx: { type: 'number', description: 'Center X coordinate' },
      cy: { type: 'number', description: 'Center Y coordinate' },
      radius: { type: 'number', description: 'Radius' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_circle_3p',
    description: 'Draw a circle through three points',
    category: 'draw',
    commandType: 'CreateCircle3P',
    parameters: {
      x1: { type: 'number', description: 'First point X' },
      y1: { type: 'number', description: 'First point Y' },
      x2: { type: 'number', description: 'Second point X' },
      y2: { type: 'number', description: 'Second point Y' },
      x3: { type: 'number', description: 'Third point X' },
      y3: { type: 'number', description: 'Third point Y' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_circle_2p',
    description: 'Draw a circle defined by two diametrically opposite points',
    category: 'draw',
    commandType: 'CreateCircle2P',
    parameters: {
      x1: { type: 'number', description: 'First point X' },
      y1: { type: 'number', description: 'First point Y' },
      x2: { type: 'number', description: 'Second point X' },
      y2: { type: 'number', description: 'Second point Y' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_circle_ttr',
    description:
      'Draw a circle tangent to two entities with a given radius (Tangent-Tangent-Radius)',
    category: 'draw',
    commandType: 'CreateCircleTtr',
    parameters: {
      entity1_id: { type: 'string', description: 'First tangent entity ID' },
      pick1_x: { type: 'number', description: 'Pick point X on first entity' },
      pick1_y: { type: 'number', description: 'Pick point Y on first entity' },
      entity2_id: { type: 'string', description: 'Second tangent entity ID' },
      pick2_x: { type: 'number', description: 'Pick point X on second entity' },
      pick2_y: { type: 'number', description: 'Pick point Y on second entity' },
      radius: { type: 'number', description: 'Circle radius' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_rectangle',
    description: 'Draw a rectangle from an origin corner with width and height',
    category: 'draw',
    commandType: 'CreateRectangle',
    parameters: {
      x: { type: 'number', description: 'Origin X coordinate' },
      y: { type: 'number', description: 'Origin Y coordinate' },
      width: { type: 'number', description: 'Width' },
      height: { type: 'number', description: 'Height' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_arc',
    description: 'Draw an arc defined by center, radius, and start/end angles (radians)',
    category: 'draw',
    commandType: 'CreateArc',
    parameters: {
      cx: { type: 'number', description: 'Center X coordinate' },
      cy: { type: 'number', description: 'Center Y coordinate' },
      radius: { type: 'number', description: 'Radius' },
      start_angle: { type: 'number', description: 'Start angle in radians' },
      end_angle: { type: 'number', description: 'End angle in radians' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_polyline',
    description: 'Draw a polyline through a series of [x,y] coordinate pairs',
    category: 'draw',
    commandType: 'CreatePolyline',
    parameters: {
      vertices: { type: 'number[][]', description: 'Array of [x, y] coordinate pairs' },
      closed: {
        type: 'boolean',
        description: 'Close the polyline to form a polygon',
        optional: true,
        default: false,
      },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_point',
    description: 'Draw a point at the specified coordinates',
    category: 'draw',
    commandType: 'CreatePoint',
    parameters: {
      x: { type: 'number', description: 'X coordinate' },
      y: { type: 'number', description: 'Y coordinate' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_text',
    description: 'Place single-line text at a position',
    category: 'draw',
    commandType: 'CreateText',
    parameters: {
      x: { type: 'number', description: 'X coordinate' },
      y: { type: 'number', description: 'Y coordinate' },
      content: { type: 'string', description: 'Text content' },
      height: {
        type: 'number',
        description: 'Text height',
        optional: true,
        default: 2.5,
      },
      rotation: {
        type: 'number',
        description: 'Rotation angle in radians',
        optional: true,
        default: 0,
      },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_ellipse',
    description: 'Draw an ellipse defined by center, semi-major/minor axes, and rotation',
    category: 'draw',
    commandType: 'CreateEllipse',
    parameters: {
      cx: { type: 'number', description: 'Center X coordinate' },
      cy: { type: 'number', description: 'Center Y coordinate' },
      semi_major: { type: 'number', description: 'Semi-major axis length' },
      semi_minor: { type: 'number', description: 'Semi-minor axis length' },
      rotation: {
        type: 'number',
        description: 'Rotation angle in radians',
        optional: true,
        default: 0,
      },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_spline',
    description: 'Draw a spline curve through control points',
    category: 'draw',
    commandType: 'CreateSpline',
    parameters: {
      control_points: { type: 'number[][]', description: 'Array of [x, y] control points' },
      degree: {
        type: 'number',
        description: 'Spline degree (2=quadratic, 3=cubic)',
        optional: true,
        default: 3,
      },
      closed: {
        type: 'boolean',
        description: 'Close the spline',
        optional: true,
        default: false,
      },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_construction_line',
    description: 'Draw an infinite construction line (xline) through a point with a direction',
    category: 'draw',
    commandType: 'CreateConstructionLine',
    parameters: {
      ox: { type: 'number', description: 'Origin X coordinate' },
      oy: { type: 'number', description: 'Origin Y coordinate' },
      dx: { type: 'number', description: 'Direction X component' },
      dy: { type: 'number', description: 'Direction Y component' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_dimension',
    description: 'Draw a linear dimension between two points with an offset',
    category: 'draw',
    commandType: 'CreateDimension',
    parameters: {
      x1: { type: 'number', description: 'First point X' },
      y1: { type: 'number', description: 'First point Y' },
      x2: { type: 'number', description: 'Second point X' },
      y2: { type: 'number', description: 'Second point Y' },
      offset: { type: 'number', description: 'Offset distance for dimension line' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_aligned_dimension',
    description: 'Draw an aligned dimension that measures true distance between two points',
    category: 'draw',
    commandType: 'CreateAlignedDimension',
    parameters: {
      x1: { type: 'number', description: 'First point X' },
      y1: { type: 'number', description: 'First point Y' },
      x2: { type: 'number', description: 'Second point X' },
      y2: { type: 'number', description: 'Second point Y' },
      offset: { type: 'number', description: 'Offset distance for dimension line' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_angular_dimension',
    description: 'Draw an angular dimension showing the angle between two lines',
    category: 'draw',
    commandType: 'CreateAngularDimension',
    parameters: {
      cx: { type: 'number', description: 'Center/vertex X' },
      cy: { type: 'number', description: 'Center/vertex Y' },
      sx: { type: 'number', description: 'Start ray point X' },
      sy: { type: 'number', description: 'Start ray point Y' },
      ex: { type: 'number', description: 'End ray point X' },
      ey: { type: 'number', description: 'End ray point Y' },
      radius: { type: 'number', description: 'Dimension arc radius' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_radial_dimension',
    description: 'Draw a radial dimension showing the radius of a circle or arc',
    category: 'draw',
    commandType: 'CreateRadialDimension',
    parameters: {
      cx: { type: 'number', description: 'Center X of circle/arc' },
      cy: { type: 'number', description: 'Center Y of circle/arc' },
      px: { type: 'number', description: 'Point on circumference X' },
      py: { type: 'number', description: 'Point on circumference Y' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_diameter_dimension',
    description: 'Draw a diameter dimension showing the diameter of a circle or arc',
    category: 'draw',
    commandType: 'CreateDiameterDimension',
    parameters: {
      cx: { type: 'number', description: 'Center X of circle/arc' },
      cy: { type: 'number', description: 'Center Y of circle/arc' },
      px: { type: 'number', description: 'Point on circumference X' },
      py: { type: 'number', description: 'Point on circumference Y' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'dim_continue',
    description: 'Create a chained dimension starting from the end point of a previous dimension',
    category: 'draw',
    commandType: 'DimContinue',
    parameters: {
      prev_dim_id: { type: 'string', description: 'ID of the previous dimension to chain from' },
      x: { type: 'number', description: 'New endpoint X' },
      y: { type: 'number', description: 'New endpoint Y' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'dim_baseline',
    description:
      'Create a stacked dimension sharing the start point of a base dimension, offset by an increment',
    category: 'draw',
    commandType: 'DimBaseline',
    parameters: {
      base_dim_id: { type: 'string', description: 'ID of the base dimension to stack from' },
      x: { type: 'number', description: 'New endpoint X' },
      y: { type: 'number', description: 'New endpoint Y' },
      offset_increment: {
        type: 'number',
        description: 'Additional offset distance from the base dimension line',
        optional: true,
        default: 5,
      },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_hatch',
    description: 'Fill a closed boundary with a hatch pattern',
    category: 'draw',
    commandType: 'CreateHatch',
    parameters: {
      boundary_ids: { type: 'string[]', description: 'Entity IDs forming the closed boundary' },
      pattern: { type: 'string', description: 'Hatch pattern name (e.g. "ANSI31", "SOLID")' },
      scale: {
        type: 'number',
        description: 'Pattern scale',
        optional: true,
        default: 1.0,
      },
      angle: {
        type: 'number',
        description: 'Pattern angle in radians',
        optional: true,
        default: 0,
      },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_mtext',
    description: 'Place multi-line text with a bounding width',
    category: 'draw',
    commandType: 'CreateMText',
    parameters: {
      x: { type: 'number', description: 'Insertion X coordinate' },
      y: { type: 'number', description: 'Insertion Y coordinate' },
      content: { type: 'string', description: 'Text content (supports \\n for line breaks)' },
      width: { type: 'number', description: 'Text box width' },
      height: {
        type: 'number',
        description: 'Text height',
        optional: true,
        default: 2.5,
      },
      rotation: {
        type: 'number',
        description: 'Rotation angle in radians',
        optional: true,
        default: 0,
      },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_table',
    description: 'Insert a table with specified rows, columns, and cell contents',
    category: 'draw',
    commandType: 'CreateTable',
    parameters: {
      x: { type: 'number', description: 'Top-left X coordinate' },
      y: { type: 'number', description: 'Top-left Y coordinate' },
      rows: { type: 'number', description: 'Number of rows' },
      cols: { type: 'number', description: 'Number of columns' },
      row_height: {
        type: 'number',
        description: 'Height of each row',
        optional: true,
        default: 5,
      },
      col_widths: {
        type: 'number[]',
        description: 'Width of each column',
      },
      cells: {
        type: 'string[]',
        description: 'Cell contents in row-major order',
      },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_revision_cloud',
    description: 'Draw a revision cloud through a series of points',
    category: 'draw',
    commandType: 'CreateRevisionCloud',
    parameters: {
      vertices: {
        type: 'number[][]',
        description: 'Array of [x, y] points forming the cloud path',
      },
      arc_length: {
        type: 'number',
        description: 'Arc segment length',
        optional: true,
      },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_leader',
    description:
      'Draw a leader annotation (arrow line with text label). Vertices define the leader path, text appears at the last vertex.',
    category: 'draw',
    commandType: 'CreateLeader',
    parameters: {
      vertices: {
        type: 'number[][]',
        description:
          'Array of [x, y] points forming the leader path (arrow at first point, text at last)',
      },
      text: { type: 'string', description: 'Annotation text' },
      arrow_size: {
        type: 'number',
        description: 'Arrowhead size',
        optional: true,
        default: 2.5,
      },
      text_height: {
        type: 'number',
        description: 'Text height',
        optional: true,
        default: 2.5,
      },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_polygon',
    description:
      'Draw a regular polygon (triangle, square, pentagon, hexagon, etc.) as a closed polyline',
    category: 'draw',
    commandType: 'CreatePolygon',
    parameters: {
      cx: { type: 'number', description: 'Center X coordinate' },
      cy: { type: 'number', description: 'Center Y coordinate' },
      radius: {
        type: 'number',
        description: 'Radius (circumradius if inscribed, apothem if circumscribed)',
      },
      sides: {
        type: 'number',
        description: 'Number of sides (3=triangle, 4=square, 6=hexagon, etc.)',
      },
      inscribed: {
        type: 'boolean',
        description:
          'true=inscribed in circle (vertices on circle), false=circumscribed (edges tangent to circle)',
        optional: true,
        default: true,
      },
      rotation: {
        type: 'number',
        description: 'Rotation angle in radians',
        optional: true,
        default: 0,
      },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_ray',
    description: 'Draw a half-infinite ray from an origin point in a direction',
    category: 'draw',
    commandType: 'CreateRay',
    parameters: {
      ox: { type: 'number', description: 'Origin X coordinate' },
      oy: { type: 'number', description: 'Origin Y coordinate' },
      dx: { type: 'number', description: 'Direction X component' },
      dy: { type: 'number', description: 'Direction Y component' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_donut',
    description: 'Draw a donut (annular ring) defined by center, inner radius, and outer radius',
    category: 'draw',
    commandType: 'CreateDonut',
    parameters: {
      cx: { type: 'number', description: 'Center X coordinate' },
      cy: { type: 'number', description: 'Center Y coordinate' },
      inner_radius: { type: 'number', description: 'Inner radius (0 for filled circle)' },
      outer_radius: { type: 'number', description: 'Outer radius' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
];

// ─── Edit Tools ──────────────────────────────────────────────────────────────

const EDIT_TOOLS: ToolDefinition[] = [
  {
    name: 'move_entities',
    description: 'Move entities by a displacement vector',
    category: 'edit',
    commandType: 'MoveEntity',
    perEntity: true,
    parameters: {
      ids: { type: 'string[]', description: 'Entity IDs to move' },
      dx: { type: 'number', description: 'X displacement' },
      dy: { type: 'number', description: 'Y displacement' },
    },
  },
  {
    name: 'copy_entities',
    description: 'Copy entities with a displacement offset',
    category: 'edit',
    commandType: 'CopyEntity',
    perEntity: true,
    parameters: {
      ids: { type: 'string[]', description: 'Entity IDs to copy' },
      dx: { type: 'number', description: 'X displacement for copies' },
      dy: { type: 'number', description: 'Y displacement for copies' },
    },
  },
  {
    name: 'rotate_entities',
    description: 'Rotate entities around a center point by an angle (radians)',
    category: 'edit',
    commandType: 'RotateEntity',
    perEntity: true,
    parameters: {
      ids: { type: 'string[]', description: 'Entity IDs to rotate' },
      cx: { type: 'number', description: 'Center of rotation X' },
      cy: { type: 'number', description: 'Center of rotation Y' },
      angle: { type: 'number', description: 'Rotation angle in radians' },
    },
  },
  {
    name: 'scale_entities',
    description: 'Scale entities from a base point by a factor',
    category: 'edit',
    commandType: 'ScaleEntity',
    perEntity: true,
    parameters: {
      ids: { type: 'string[]', description: 'Entity IDs to scale' },
      cx: { type: 'number', description: 'Base point X' },
      cy: { type: 'number', description: 'Base point Y' },
      factor: { type: 'number', description: 'Scale factor (>1 enlarges, <1 shrinks)' },
    },
  },
  {
    name: 'mirror_entities',
    description: 'Mirror entities across a line defined by two points',
    category: 'edit',
    commandType: 'MirrorEntity',
    perEntity: true,
    parameters: {
      ids: { type: 'string[]', description: 'Entity IDs to mirror' },
      x1: { type: 'number', description: 'Mirror line point 1 X' },
      y1: { type: 'number', description: 'Mirror line point 1 Y' },
      x2: { type: 'number', description: 'Mirror line point 2 X' },
      y2: { type: 'number', description: 'Mirror line point 2 Y' },
    },
  },
  {
    name: 'delete_entities',
    description: 'Delete entities by their IDs',
    category: 'edit',
    commandType: 'DeleteEntity',
    perEntity: true,
    parameters: {
      ids: { type: 'string[]', description: 'Entity IDs to delete' },
    },
  },
  {
    name: 'offset',
    description: 'Offset an entity by a distance to create a parallel copy',
    category: 'edit',
    commandType: 'OffsetEntity',
    parameters: {
      id: { type: 'string', description: 'Entity ID to offset' },
      distance: { type: 'number', description: 'Offset distance (positive = outward)' },
    },
  },
  {
    name: 'offset_through',
    description: 'Offset an entity so it passes through a specific point',
    category: 'edit',
    commandType: 'OffsetEntityThrough',
    parameters: {
      id: { type: 'string', description: 'Entity ID to offset' },
      through_x: { type: 'number', description: 'Point X the offset must pass through' },
      through_y: { type: 'number', description: 'Point Y the offset must pass through' },
    },
  },
  {
    name: 'trim',
    description: 'Trim an entity at its intersection with a boundary entity',
    category: 'edit',
    commandType: 'TrimEntity',
    parameters: {
      id: { type: 'string', description: 'Entity ID to trim' },
      boundary_id: { type: 'string', description: 'Boundary entity ID' },
      pick_x: { type: 'number', description: 'Pick point X (side to keep)' },
      pick_y: { type: 'number', description: 'Pick point Y (side to keep)' },
    },
  },
  {
    name: 'extend',
    description: 'Extend an entity to meet a boundary entity',
    category: 'edit',
    commandType: 'ExtendEntity',
    parameters: {
      id: { type: 'string', description: 'Entity ID to extend' },
      boundary_id: { type: 'string', description: 'Boundary entity ID to extend to' },
    },
  },
  {
    name: 'fillet',
    description: 'Create a rounded corner (fillet) between two entities',
    category: 'edit',
    commandType: 'Fillet',
    parameters: {
      id_a: { type: 'string', description: 'First entity ID' },
      id_b: { type: 'string', description: 'Second entity ID' },
      radius: { type: 'number', description: 'Fillet radius' },
    },
  },
  {
    name: 'fillet_polyline',
    description: 'Apply a fillet radius to all vertices of a polyline',
    category: 'edit',
    commandType: 'FilletPolyline',
    parameters: {
      id: { type: 'string', description: 'Polyline entity ID' },
      radius: { type: 'number', description: 'Fillet radius for all vertices' },
    },
  },
  {
    name: 'chamfer',
    description: 'Create a beveled corner (chamfer) between two entities',
    category: 'edit',
    commandType: 'Chamfer',
    parameters: {
      id_a: { type: 'string', description: 'First entity ID' },
      id_b: { type: 'string', description: 'Second entity ID' },
      dist_a: { type: 'number', description: 'Chamfer distance on first entity' },
      dist_b: { type: 'number', description: 'Chamfer distance on second entity' },
    },
  },
  {
    name: 'explode',
    description: 'Explode a compound entity (block, polyline, etc.) into individual entities',
    category: 'edit',
    commandType: 'Explode',
    parameters: {
      entity_id: { type: 'string', description: 'Entity ID to explode' },
    },
  },
  {
    name: 'join',
    description: 'Join connected entities into a single polyline',
    category: 'edit',
    commandType: 'JoinEntities',
    parameters: {
      ids: { type: 'string[]', description: 'Entity IDs to join' },
    },
  },
  {
    name: 'lengthen',
    description: 'Change the length of a line or arc',
    category: 'edit',
    commandType: 'Lengthen',
    parameters: {
      entity_id: { type: 'string', description: 'Entity ID to lengthen' },
      mode: { type: 'string', description: 'Mode: "delta", "percent", or "total"' },
      value: { type: 'number', description: 'Length value based on mode' },
      end: { type: 'string', description: 'Which end to modify: "start" or "end"' },
    },
  },
  {
    name: 'break_at_point',
    description: 'Break an entity at a single point, splitting it into two',
    category: 'edit',
    commandType: 'BreakAtPoint',
    parameters: {
      entity_id: { type: 'string', description: 'Entity ID to break' },
      px: { type: 'number', description: 'Break point X' },
      py: { type: 'number', description: 'Break point Y' },
    },
  },
  {
    name: 'break_two_points',
    description: 'Break an entity between two points, removing the segment between them',
    category: 'edit',
    commandType: 'Break',
    parameters: {
      entity_id: { type: 'string', description: 'Entity ID to break' },
      x1: { type: 'number', description: 'First break point X' },
      y1: { type: 'number', description: 'First break point Y' },
      x2: { type: 'number', description: 'Second break point X' },
      y2: { type: 'number', description: 'Second break point Y' },
    },
  },
  {
    name: 'match_properties',
    description:
      'Copy properties (layer, color, linetype, lineweight) from a source entity to target entities',
    category: 'edit',
    commandType: 'MatchProperties',
    parameters: {
      source_id: { type: 'string', description: 'Source entity ID to copy properties from' },
      target_ids: { type: 'string[]', description: 'Target entity IDs to apply properties to' },
    },
  },
  {
    name: 'pedit_close',
    description: 'Close an open polyline (connect last vertex to first)',
    category: 'edit',
    commandType: 'PeditClose',
    parameters: {
      id: { type: 'string', description: 'Polyline entity ID' },
    },
  },
  {
    name: 'pedit_open',
    description: 'Open a closed polyline (remove closing segment)',
    category: 'edit',
    commandType: 'PeditOpen',
    parameters: {
      id: { type: 'string', description: 'Polyline entity ID' },
    },
  },
  {
    name: 'pedit_add_vertex',
    description: 'Insert a new vertex into a polyline after the specified index',
    category: 'edit',
    commandType: 'PeditAddVertex',
    parameters: {
      id: { type: 'string', description: 'Polyline entity ID' },
      after_index: {
        type: 'number',
        description: 'Insert after this vertex index (0-based)',
      },
      x: { type: 'number', description: 'New vertex X coordinate' },
      y: { type: 'number', description: 'New vertex Y coordinate' },
    },
  },
  {
    name: 'pedit_delete_vertex',
    description: 'Delete a vertex from a polyline by index (minimum 2 vertices must remain)',
    category: 'edit',
    commandType: 'PeditDeleteVertex',
    parameters: {
      id: { type: 'string', description: 'Polyline entity ID' },
      vertex_index: { type: 'number', description: 'Vertex index to delete (0-based)' },
    },
  },
  {
    name: 'pedit_move_vertex',
    description: 'Move a polyline vertex to a new position',
    category: 'edit',
    commandType: 'PeditMoveVertex',
    parameters: {
      id: { type: 'string', description: 'Polyline entity ID' },
      vertex_index: { type: 'number', description: 'Vertex index to move (0-based)' },
      x: { type: 'number', description: 'New X coordinate' },
      y: { type: 'number', description: 'New Y coordinate' },
    },
  },
  {
    name: 'send_to_back',
    description: 'Send an entity to the back of the draw order',
    category: 'edit',
    commandType: 'SendToBack',
    parameters: {
      id: { type: 'string', description: 'Entity ID to send to back' },
    },
  },
  {
    name: 'bring_to_front',
    description: 'Bring an entity to the front of the draw order',
    category: 'edit',
    commandType: 'BringToFront',
    parameters: {
      id: { type: 'string', description: 'Entity ID to bring to front' },
    },
  },
  {
    name: 'send_backward',
    description: 'Move an entity one step backward in draw order',
    category: 'edit',
    commandType: 'SendBackward',
    parameters: {
      id: { type: 'string', description: 'Entity ID to move backward' },
    },
  },
  {
    name: 'bring_forward',
    description: 'Move an entity one step forward in draw order',
    category: 'edit',
    commandType: 'BringForward',
    parameters: {
      id: { type: 'string', description: 'Entity ID to move forward' },
    },
  },
  {
    name: 'align_entities',
    description:
      'Align entities by mapping source points to destination points. 1 pair = translate, 2 pairs = translate + rotate + scale.',
    category: 'edit',
    commandType: 'AlignEntities',
    parameters: {
      ids: { type: 'string[]', description: 'Entity IDs to align' },
      src1_x: { type: 'number', description: 'Source point 1 X' },
      src1_y: { type: 'number', description: 'Source point 1 Y' },
      dst1_x: { type: 'number', description: 'Destination point 1 X' },
      dst1_y: { type: 'number', description: 'Destination point 1 Y' },
      src2_x: {
        type: 'number',
        description: 'Source point 2 X (optional, for rotate+scale)',
        optional: true,
      },
      src2_y: { type: 'number', description: 'Source point 2 Y', optional: true },
      dst2_x: { type: 'number', description: 'Destination point 2 X', optional: true },
      dst2_y: { type: 'number', description: 'Destination point 2 Y', optional: true },
    },
  },
  {
    name: 'purge',
    description: 'Remove unused layers, blocks, and text styles from the drawing',
    category: 'edit',
    commandType: 'PurgeUnused',
    parameters: {},
  },
  {
    name: 'draw_ellipse_arc',
    description: 'Draw an elliptical arc',
    category: 'draw',
    commandType: 'CreateEllipseArc',
    parameters: {
      cx: { type: 'number', description: 'Center X' },
      cy: { type: 'number', description: 'Center Y' },
      semi_major: { type: 'number', description: 'Semi-major axis' },
      semi_minor: { type: 'number', description: 'Semi-minor axis' },
      rotation: { type: 'number', description: 'Rotation in radians', optional: true, default: 0 },
      start_angle: { type: 'number', description: 'Start angle in radians' },
      end_angle: { type: 'number', description: 'End angle in radians' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_mline',
    description: 'Draw parallel multi-lines along a path with specified offsets',
    category: 'draw',
    commandType: 'CreateMline',
    parameters: {
      vertices: { type: 'number[][]', description: 'Array of [x,y] path points' },
      offsets: { type: 'number[]', description: 'Offset distances for each parallel line' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_wipeout',
    description: 'Draw an opaque masking area that hides entities behind it',
    category: 'draw',
    commandType: 'CreateWipeout',
    parameters: {
      vertices: { type: 'number[][]', description: 'Array of [x,y] boundary points' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_ordinate_dimension',
    description: 'Draw an ordinate dimension showing X or Y coordinate of a feature point',
    category: 'draw',
    commandType: 'CreateOrdinateDimension',
    parameters: {
      feature_x: { type: 'number', description: 'Feature point X' },
      feature_y: { type: 'number', description: 'Feature point Y' },
      leader_end_x: { type: 'number', description: 'Leader endpoint X' },
      leader_end_y: { type: 'number', description: 'Leader endpoint Y' },
      use_x_datum: { type: 'boolean', description: 'true=show X ordinate, false=show Y ordinate' },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_tolerance',
    description: 'Draw a GD&T feature control frame (geometric tolerance)',
    category: 'draw',
    commandType: 'CreateTolerance',
    parameters: {
      x: { type: 'number', description: 'Position X' },
      y: { type: 'number', description: 'Position Y' },
      content: { type: 'string', description: 'Tolerance frame content' },
      height: { type: 'number', description: 'Frame height', optional: true, default: 2.5 },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'draw_attdef',
    description: 'Create a block attribute definition (tag + prompt + default value)',
    category: 'draw',
    commandType: 'CreateAttdef',
    parameters: {
      x: { type: 'number', description: 'Position X' },
      y: { type: 'number', description: 'Position Y' },
      tag: { type: 'string', description: 'Attribute tag name' },
      prompt: { type: 'string', description: 'Prompt shown when inserting block' },
      default_value: { type: 'string', description: 'Default attribute value' },
      height: { type: 'number', description: 'Text height', optional: true, default: 2.5 },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'overkill',
    description: 'Remove overlapping/duplicate geometry within tolerance',
    category: 'edit',
    commandType: 'Overkill',
    parameters: {
      ids: { type: 'string[]', description: 'Entity IDs to check for duplicates' },
      tolerance: {
        type: 'number',
        description: 'Distance tolerance',
        optional: true,
        default: 0.001,
      },
    },
  },
  {
    name: 'set_ltscale',
    description: 'Set the global linetype scale factor',
    category: 'state',
    commandType: 'SetLtscale',
    parameters: {
      scale: { type: 'number', description: 'Linetype scale factor' },
    },
  },
  {
    name: 'get_ltscale',
    description: 'Get the current global linetype scale factor',
    category: 'state',
    commandType: 'GetLtscale',
    parameters: {},
  },
  {
    name: 'mass_properties',
    description: 'Calculate area and centroid of a closed entity',
    category: 'measure',
    commandType: 'MassProperties',
    parameters: {
      entity_id: { type: 'string', description: 'Closed entity ID' },
    },
  },
  {
    name: 'write_block',
    description: 'Write a block definition to a file (WBLOCK)',
    category: 'block',
    commandType: 'WriteBlock',
    parameters: {
      block_name: { type: 'string', description: 'Block name to export' },
      file_path: { type: 'string', description: 'Output file path' },
    },
  },
  {
    name: 'attach_xref',
    description: 'Attach an external reference (XREF) to the drawing',
    category: 'block',
    commandType: 'AttachXref',
    parameters: {
      file_path: { type: 'string', description: 'Path to external file' },
      x: { type: 'number', description: 'Insertion X' },
      y: { type: 'number', description: 'Insertion Y' },
      scale: { type: 'number', description: 'Scale factor', optional: true, default: 1 },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'bedit_enter',
    description: 'Enter block editor for in-place editing of a block definition',
    category: 'block',
    commandType: 'BeditEnter',
    parameters: {
      block_id: { type: 'string', description: 'Block definition ID to edit' },
    },
  },
  {
    name: 'bedit_exit',
    description: 'Exit block editor and save changes',
    category: 'block',
    commandType: 'BeditExit',
    parameters: {},
  },
  {
    name: 'toggle_constraint_bar',
    description: 'Toggle visibility of constraint icons on entities',
    category: 'constraint',
    commandType: 'ToggleConstraintBar',
    parameters: {},
  },
  {
    name: 'plot_to_pdf',
    description: 'Export the drawing to PDF with paper size and scale settings',
    category: 'state',
    commandType: 'PlotToPdf',
    parameters: {
      file_path: { type: 'string', description: 'Output PDF file path' },
      paper_width: {
        type: 'number',
        description: 'Paper width in mm',
        optional: true,
        default: 297,
      },
      paper_height: {
        type: 'number',
        description: 'Paper height in mm',
        optional: true,
        default: 210,
      },
      scale: { type: 'number', description: 'Plot scale (1 = 1:1)', optional: true, default: 1 },
    },
  },
  {
    name: 'save_drawing',
    description: 'Save the current drawing to a JSON file',
    category: 'state',
    commandType: 'SaveDrawing',
    parameters: {
      file_path: { type: 'string', description: 'Output file path' },
    },
  },
  {
    name: 'open_drawing',
    description: 'Open a drawing from a JSON file, loading entities and layers',
    category: 'state',
    commandType: 'OpenDrawing',
    parameters: {
      file_path: { type: 'string', description: 'Input file path' },
    },
  },
  {
    name: 'create_region',
    description:
      'Create a 2D region (closed polyline) from closed entity boundaries (circles, rectangles, closed polylines)',
    category: 'draw',
    commandType: 'CreateRegion',
    parameters: {
      boundary_ids: {
        type: 'string[]',
        description: 'IDs of closed entities to create region from',
      },
      layer_id: {
        type: 'string',
        description: 'Layer ID for the region',
        optional: true,
        default: 'layer_0',
      },
    },
  },
  {
    name: 'detect_boundary',
    description:
      'Detect the smallest closed boundary (circle, rectangle, or closed polyline) containing a point. Creates a new closed polyline from the detected boundary.',
    category: 'draw',
    commandType: 'DetectBoundary',
    parameters: {
      x: { type: 'number', description: 'Point X inside the boundary to detect' },
      y: { type: 'number', description: 'Point Y inside the boundary to detect' },
      layer_id: {
        type: 'string',
        description: 'Layer ID for the new boundary',
        optional: true,
        default: 'layer_0',
      },
    },
  },
  {
    name: 'auto_constrain',
    description:
      'Automatically detect and apply geometric constraints (horizontal, vertical, coincident) to entities based on their current geometry',
    category: 'constraint',
    commandType: 'AutoConstrain',
    parameters: {
      ids: { type: 'string[]', description: 'Entity IDs to analyze for constraints' },
      tolerance: {
        type: 'number',
        description:
          'Distance tolerance for detecting near-horizontal/vertical/coincident conditions',
        optional: true,
        default: 1.0,
      },
    },
  },
  {
    name: 'stretch',
    description:
      'Stretch entities by moving vertices inside a crossing window by a displacement. Vertices outside the window stay fixed.',
    category: 'edit',
    commandType: 'StretchEntities',
    parameters: {
      ids: { type: 'string[]', description: 'Entity IDs to stretch' },
      window_x1: { type: 'number', description: 'Crossing window corner 1 X' },
      window_y1: { type: 'number', description: 'Crossing window corner 1 Y' },
      window_x2: { type: 'number', description: 'Crossing window corner 2 X' },
      window_y2: { type: 'number', description: 'Crossing window corner 2 Y' },
      dx: { type: 'number', description: 'X displacement for vertices inside window' },
      dy: { type: 'number', description: 'Y displacement for vertices inside window' },
    },
  },
  {
    name: 'array_path',
    description: 'Create copies of entities evenly spaced along a path (line or polyline)',
    category: 'array',
    commandType: 'ArrayPath',
    parameters: {
      entity_ids: { type: 'string[]', description: 'Entity IDs to array' },
      path_id: { type: 'string', description: 'Path entity ID (line or polyline)' },
      count: { type: 'number', description: 'Total number of copies including original' },
      align_to_path: {
        type: 'boolean',
        description: 'Rotate items to align with path direction',
        optional: true,
        default: true,
      },
    },
  },
];

// ─── Query Tools ─────────────────────────────────────────────────────────────

const QUERY_TOOLS: ToolDefinition[] = [
  {
    name: 'get_entities',
    description: 'Get all entities in the current drawing with their geometry, layer, and style',
    category: 'query',
    commandType: '_query_entities',
    parameters: {},
  },
  {
    name: 'get_entity',
    description: 'Get a single entity by its ID',
    category: 'query',
    commandType: '_query_entity',
    parameters: {
      id: { type: 'string', description: 'Entity ID' },
    },
  },
];

// ─── Measure Tools ───────────────────────────────────────────────────────────

const MEASURE_TOOLS: ToolDefinition[] = [
  {
    name: 'measure_distance',
    description: 'Measure the distance between two points',
    category: 'measure',
    commandType: 'MeasureDistance',
    parameters: {
      x1: { type: 'number', description: 'First point X' },
      y1: { type: 'number', description: 'First point Y' },
      x2: { type: 'number', description: 'Second point X' },
      y2: { type: 'number', description: 'Second point Y' },
    },
  },
  {
    name: 'measure_area',
    description: 'Measure the area of a closed entity (rectangle, circle, closed polyline)',
    category: 'measure',
    commandType: 'MeasureArea',
    parameters: {
      entity_id: { type: 'string', description: 'Closed entity ID to measure' },
    },
  },
  {
    name: 'id_point',
    description: 'Query the coordinates of a point (returns X, Y values)',
    category: 'measure',
    commandType: 'QueryPoint',
    parameters: {
      x: { type: 'number', description: 'X coordinate to query' },
      y: { type: 'number', description: 'Y coordinate to query' },
    },
  },
];

// ─── State Tools ─────────────────────────────────────────────────────────────

const STATE_TOOLS: ToolDefinition[] = [
  {
    name: 'undo',
    description: 'Undo the last operation',
    category: 'state',
    commandType: 'Undo',
    parameters: {},
  },
  {
    name: 'redo',
    description: 'Redo the last undone operation',
    category: 'state',
    commandType: 'Redo',
    parameters: {},
  },
  {
    name: 'get_drawing_info',
    description: 'Get a summary of the current drawing: entity count, layer count, undo/redo state',
    category: 'state',
    commandType: '_query_drawing_info',
    parameters: {},
  },
];

// ─── Layer Tools ─────────────────────────────────────────────────────────────

const LAYER_TOOLS: ToolDefinition[] = [
  {
    name: 'get_layers',
    description: 'Get all layers in the drawing with their properties',
    category: 'layer',
    commandType: '_query_layers',
    parameters: {},
  },
  {
    name: 'create_layer',
    description: 'Create a new layer with a name and color',
    category: 'layer',
    commandType: 'CreateLayer',
    parameters: {
      name: { type: 'string', description: 'Layer name (e.g. "Walls", "Dimensions")' },
      color: { type: 'string', description: 'Hex color (e.g. "#ff0000")' },
    },
  },
  {
    name: 'delete_layer',
    description: 'Delete a layer by ID',
    category: 'layer',
    commandType: 'DeleteLayer',
    parameters: {
      id: { type: 'string', description: 'Layer ID to delete' },
    },
  },
  {
    name: 'set_layer_color',
    description: 'Change the color of an existing layer',
    category: 'layer',
    commandType: 'SetLayerColor',
    parameters: {
      id: { type: 'string', description: 'Layer ID' },
      color: { type: 'string', description: 'New hex color (e.g. "#00ff00")' },
    },
  },
  {
    name: 'set_layer_visible',
    description: 'Toggle layer visibility on or off',
    category: 'layer',
    commandType: 'SetLayerVisible',
    parameters: {
      id: { type: 'string', description: 'Layer ID' },
      visible: { type: 'boolean', description: 'Whether the layer should be visible' },
    },
  },
  {
    name: 'set_layer_locked',
    description: 'Lock or unlock a layer to prevent/allow editing',
    category: 'layer',
    commandType: 'SetLayerLocked',
    parameters: {
      id: { type: 'string', description: 'Layer ID' },
      locked: { type: 'boolean', description: 'Whether the layer should be locked' },
    },
  },
  {
    name: 'rename_layer',
    description: 'Rename an existing layer',
    category: 'layer',
    commandType: 'RenameLayer',
    parameters: {
      id: { type: 'string', description: 'Layer ID' },
      name: { type: 'string', description: 'New layer name' },
    },
  },
  {
    name: 'set_entity_layer',
    description: 'Move an entity to a different layer',
    category: 'layer',
    commandType: 'SetEntityLayer',
    parameters: {
      entity_id: { type: 'string', description: 'Entity ID to move' },
      layer_id: { type: 'string', description: 'Target layer ID' },
    },
  },
];

// ─── Constraint Tools ────────────────────────────────────────────────────────

const CONSTRAINT_TOOLS: ToolDefinition[] = [
  {
    name: 'add_horizontal',
    description: 'Constrain an entity (line) to be horizontal',
    category: 'constraint',
    commandType: 'AddConstraintHorizontal',
    parameters: {
      entity_id: { type: 'string', description: 'Entity ID to constrain' },
    },
  },
  {
    name: 'add_vertical',
    description: 'Constrain an entity (line) to be vertical',
    category: 'constraint',
    commandType: 'AddConstraintVertical',
    parameters: {
      entity_id: { type: 'string', description: 'Entity ID to constrain' },
    },
  },
  {
    name: 'add_coincident',
    description: 'Constrain two points on different entities to be coincident',
    category: 'constraint',
    commandType: 'AddConstraintCoincident',
    parameters: {
      entity_a: { type: 'string', description: 'First entity ID' },
      point_a: { type: 'number', description: 'Point index on first entity (0=start, 1=end)' },
      entity_b: { type: 'string', description: 'Second entity ID' },
      point_b: { type: 'number', description: 'Point index on second entity (0=start, 1=end)' },
    },
  },
  {
    name: 'add_distance',
    description: 'Constrain the distance between two points on different entities',
    category: 'constraint',
    commandType: 'AddConstraintDistance',
    parameters: {
      entity_a: { type: 'string', description: 'First entity ID' },
      point_a: { type: 'number', description: 'Point index on first entity' },
      entity_b: { type: 'string', description: 'Second entity ID' },
      point_b: { type: 'number', description: 'Point index on second entity' },
      distance: { type: 'number', description: 'Required distance between points' },
    },
  },
  {
    name: 'add_fixed',
    description: 'Fix a point on an entity to specific coordinates',
    category: 'constraint',
    commandType: 'AddConstraintFixed',
    parameters: {
      entity_id: { type: 'string', description: 'Entity ID' },
      point_index: { type: 'number', description: 'Point index to fix' },
      x: { type: 'number', description: 'Fixed X coordinate' },
      y: { type: 'number', description: 'Fixed Y coordinate' },
    },
  },
  {
    name: 'add_parallel',
    description: 'Constrain two lines to be parallel',
    category: 'constraint',
    commandType: 'AddConstraintParallel',
    parameters: {
      entity_a: { type: 'string', description: 'First line entity ID' },
      entity_b: { type: 'string', description: 'Second line entity ID' },
    },
  },
  {
    name: 'add_perpendicular',
    description: 'Constrain two lines to be perpendicular (90 degrees)',
    category: 'constraint',
    commandType: 'AddConstraintPerpendicular',
    parameters: {
      entity_a: { type: 'string', description: 'First line entity ID' },
      entity_b: { type: 'string', description: 'Second line entity ID' },
    },
  },
  {
    name: 'add_equal_length',
    description: 'Constrain two entities to have equal length',
    category: 'constraint',
    commandType: 'AddConstraintEqualLength',
    parameters: {
      entity_a: { type: 'string', description: 'First entity ID' },
      entity_b: { type: 'string', description: 'Second entity ID' },
    },
  },
  {
    name: 'add_tangent',
    description: 'Constrain a line to be tangent to a circle or arc',
    category: 'constraint',
    commandType: 'AddConstraintTangent',
    parameters: {
      line_entity: { type: 'string', description: 'Line entity ID' },
      circle_entity: { type: 'string', description: 'Circle or arc entity ID' },
    },
  },
  {
    name: 'add_concentric',
    description: 'Constrain two circles or arcs to share the same center',
    category: 'constraint',
    commandType: 'AddConstraintConcentric',
    parameters: {
      entity_a: { type: 'string', description: 'First circle/arc entity ID' },
      entity_b: { type: 'string', description: 'Second circle/arc entity ID' },
    },
  },
  {
    name: 'add_symmetric',
    description: 'Constrain an entity to be symmetric about an axis entity',
    category: 'constraint',
    commandType: 'AddConstraintSymmetric',
    parameters: {
      entity_id: { type: 'string', description: 'Entity ID to constrain' },
      axis_entity: { type: 'string', description: 'Axis line entity ID' },
    },
  },
  {
    name: 'remove_constraint',
    description: 'Remove a constraint by its ID',
    category: 'constraint',
    commandType: 'RemoveConstraint',
    parameters: {
      id: { type: 'string', description: 'Constraint ID to remove' },
    },
  },
  {
    name: 'analyze_dof',
    description: 'Analyze degrees of freedom in the current constraint system',
    category: 'constraint',
    commandType: 'AnalyzeDof',
    parameters: {},
  },
];

// ─── Style Tools ─────────────────────────────────────────────────────────────

const STYLE_TOOLS: ToolDefinition[] = [
  {
    name: 'set_entity_color',
    description:
      'Set the color of an entity (overrides layer color). Pass null to use layer color.',
    category: 'style',
    commandType: 'SetEntityColor',
    parameters: {
      id: { type: 'string', description: 'Entity ID' },
      color: { type: 'string', description: 'Hex color or null for ByLayer', optional: true },
    },
  },
  {
    name: 'set_entity_linetype',
    description: 'Set the linetype of an entity. Pass null to use layer linetype.',
    category: 'style',
    commandType: 'SetEntityLinetype',
    parameters: {
      id: { type: 'string', description: 'Entity ID' },
      linetype: {
        type: 'string',
        description: 'Linetype name (e.g. "dashed", "dotted") or null for ByLayer',
        optional: true,
      },
    },
  },
  {
    name: 'set_entity_lineweight',
    description: 'Set the lineweight of an entity. Pass null to use layer lineweight.',
    category: 'style',
    commandType: 'SetEntityLineweight',
    parameters: {
      id: { type: 'string', description: 'Entity ID' },
      lineweight: {
        type: 'number',
        description: 'Lineweight value or null for ByLayer',
        optional: true,
      },
    },
  },
  {
    name: 'set_layer_linetype',
    description: 'Set the default linetype for a layer',
    category: 'style',
    commandType: 'SetLayerLinetype',
    parameters: {
      id: { type: 'string', description: 'Layer ID' },
      linetype: { type: 'string', description: 'Linetype name', optional: true },
    },
  },
  {
    name: 'set_layer_lineweight',
    description: 'Set the default lineweight for a layer',
    category: 'style',
    commandType: 'SetLayerLineweight',
    parameters: {
      id: { type: 'string', description: 'Layer ID' },
      lineweight: { type: 'number', description: 'Lineweight value', optional: true },
    },
  },
];

// ─── Block Tools ─────────────────────────────────────────────────────────────

const BLOCK_TOOLS: ToolDefinition[] = [
  {
    name: 'create_block',
    description: 'Create a block definition from existing entities',
    category: 'block',
    commandType: 'CreateBlock',
    parameters: {
      name: { type: 'string', description: 'Block name' },
      base_x: { type: 'number', description: 'Base point X' },
      base_y: { type: 'number', description: 'Base point Y' },
      entity_ids: { type: 'string[]', description: 'Entity IDs to include in the block' },
    },
  },
  {
    name: 'insert_block',
    description: 'Insert a block reference at a position with optional rotation and scale',
    category: 'block',
    commandType: 'InsertBlock',
    parameters: {
      block_id: { type: 'string', description: 'Block definition ID' },
      x: { type: 'number', description: 'Insertion X coordinate' },
      y: { type: 'number', description: 'Insertion Y coordinate' },
      rotation: {
        type: 'number',
        description: 'Rotation angle in radians',
        optional: true,
        default: 0,
      },
      scale_x: { type: 'number', description: 'X scale factor', optional: true, default: 1 },
      scale_y: { type: 'number', description: 'Y scale factor', optional: true, default: 1 },
      layer_id: { type: 'string', description: 'Layer ID', optional: true, default: 'layer_0' },
    },
  },
  {
    name: 'explode_block',
    description: 'Explode a block reference into its constituent entities',
    category: 'block',
    commandType: 'ExplodeBlock',
    parameters: {
      entity_id: { type: 'string', description: 'Block reference entity ID to explode' },
    },
  },
];

// ─── Array Tools ─────────────────────────────────────────────────────────────

const ARRAY_TOOLS: ToolDefinition[] = [
  {
    name: 'array_rectangular',
    description: 'Create a rectangular array of entities with specified rows, columns, and spacing',
    category: 'array',
    commandType: 'ArrayRectangular',
    parameters: {
      entity_ids: { type: 'string[]', description: 'Entity IDs to array' },
      rows: { type: 'number', description: 'Number of rows' },
      cols: { type: 'number', description: 'Number of columns' },
      row_spacing: { type: 'number', description: 'Spacing between rows' },
      col_spacing: { type: 'number', description: 'Spacing between columns' },
    },
  },
  {
    name: 'array_polar',
    description: 'Create a polar (circular) array of entities around a center point',
    category: 'array',
    commandType: 'ArrayPolar',
    parameters: {
      entity_ids: { type: 'string[]', description: 'Entity IDs to array' },
      center_x: { type: 'number', description: 'Center of rotation X' },
      center_y: { type: 'number', description: 'Center of rotation Y' },
      count: { type: 'number', description: 'Number of copies (including original)' },
      angle: {
        type: 'number',
        description: 'Total angle to fill in radians (2*PI for full circle)',
      },
      rotate_items: {
        type: 'boolean',
        description: 'Rotate items as they are arrayed',
        optional: true,
        default: true,
      },
    },
  },
];

// ─── Text Style Tools ───────────────────────────────────────────────────────

const TEXT_STYLE_TOOLS: ToolDefinition[] = [
  {
    name: 'create_text_style',
    description: 'Create a new named text style with font and formatting options',
    category: 'text_style',
    commandType: 'CreateTextStyle',
    parameters: {
      name: { type: 'string', description: 'Text style name' },
      font_family: { type: 'string', description: 'Font family name', optional: true },
      height: { type: 'number', description: 'Default text height', optional: true },
      width_factor: { type: 'number', description: 'Width factor (1.0 = normal)', optional: true },
      oblique_angle: { type: 'number', description: 'Oblique angle in radians', optional: true },
      is_bold: { type: 'boolean', description: 'Bold style', optional: true },
      is_italic: { type: 'boolean', description: 'Italic style', optional: true },
    },
  },
  {
    name: 'modify_text_style',
    description: 'Modify an existing text style properties',
    category: 'text_style',
    commandType: 'ModifyTextStyle',
    parameters: {
      name: { type: 'string', description: 'Text style name to modify' },
      font_family: { type: 'string', description: 'Font family name', optional: true },
      height: { type: 'number', description: 'Default text height', optional: true },
      width_factor: { type: 'number', description: 'Width factor', optional: true },
      oblique_angle: { type: 'number', description: 'Oblique angle in radians', optional: true },
      is_bold: { type: 'boolean', description: 'Bold style', optional: true },
      is_italic: { type: 'boolean', description: 'Italic style', optional: true },
    },
  },
  {
    name: 'delete_text_style',
    description: 'Delete a text style by name',
    category: 'text_style',
    commandType: 'DeleteTextStyle',
    parameters: {
      name: { type: 'string', description: 'Text style name to delete' },
    },
  },
  {
    name: 'set_current_text_style',
    description: 'Set the active text style for new text entities',
    category: 'text_style',
    commandType: 'SetCurrentTextStyle',
    parameters: {
      name: { type: 'string', description: 'Text style name to make current' },
    },
  },
];

// ─── Dimension Style Tools ──────────────────────────────────────────────────

const DIM_STYLE_TOOLS: ToolDefinition[] = [
  {
    name: 'create_dim_style',
    description:
      'Create a new named dimension style. Field names mirror AutoCAD DIMSTYLE variables.',
    category: 'dim_style',
    commandType: 'CreateDimStyle',
    parameters: {
      name: { type: 'string', description: 'Dimension style name' },
      dimscale: { type: 'number', description: 'Overall scale factor (DIMSCALE)', optional: true },
      dimtxt: { type: 'number', description: 'Text height (DIMTXT)', optional: true },
      dimasz: { type: 'number', description: 'Arrow size (DIMASZ)', optional: true },
      dimexo: {
        type: 'number',
        description: 'Extension line offset from origin (DIMEXO)',
        optional: true,
      },
      dimexe: {
        type: 'number',
        description: 'Extension line distance above the dimension line (DIMEXE)',
        optional: true,
      },
      dimgap: {
        type: 'number',
        description: 'Gap between dimension line and text (DIMGAP)',
        optional: true,
      },
      dimtad: {
        type: 'number',
        description: 'Text vertical: 0=center, 1=above, 2=below (DIMTAD)',
        optional: true,
      },
      dimclrt: {
        type: 'string',
        description: 'Text color hex; null = ByBlock (DIMCLRT)',
        optional: true,
      },
      dimclrd: {
        type: 'string',
        description: 'Dim line color hex; null = ByBlock (DIMCLRD)',
        optional: true,
      },
      dimclre: {
        type: 'string',
        description: 'Extension line color hex; null = ByBlock (DIMCLRE)',
        optional: true,
      },
      dimtxsty: {
        type: 'string',
        description: 'Text style name for dimension text (DIMTXSTY)',
        optional: true,
      },
    },
  },
  {
    name: 'modify_dim_style',
    description: 'Modify properties of an existing dimension style',
    category: 'dim_style',
    commandType: 'ModifyDimStyle',
    parameters: {
      name: { type: 'string', description: 'Dimension style name to modify' },
      dimscale: { type: 'number', description: 'Overall scale factor (DIMSCALE)', optional: true },
      dimtxt: { type: 'number', description: 'Text height (DIMTXT)', optional: true },
      dimasz: { type: 'number', description: 'Arrow size (DIMASZ)', optional: true },
      dimexo: {
        type: 'number',
        description: 'Extension line offset from origin (DIMEXO)',
        optional: true,
      },
      dimexe: {
        type: 'number',
        description: 'Extension line distance above the dimension line (DIMEXE)',
        optional: true,
      },
      dimgap: { type: 'number', description: 'Gap around text (DIMGAP)', optional: true },
      dimtad: {
        type: 'number',
        description: 'Text vertical: 0=center, 1=above, 2=below (DIMTAD)',
        optional: true,
      },
      dimclrt: { type: 'string', description: 'Text color hex (DIMCLRT)', optional: true },
      dimclrd: { type: 'string', description: 'Dim line color hex (DIMCLRD)', optional: true },
      dimclre: {
        type: 'string',
        description: 'Extension line color hex (DIMCLRE)',
        optional: true,
      },
      dimtxsty: { type: 'string', description: 'Text style name (DIMTXSTY)', optional: true },
    },
  },
  {
    name: 'delete_dim_style',
    description:
      'Delete a dimension style by name. The Standard style cannot be deleted (matches AutoCAD).',
    category: 'dim_style',
    commandType: 'DeleteDimStyle',
    parameters: {
      name: { type: 'string', description: 'Dimension style name to delete' },
    },
  },
  {
    name: 'set_current_dim_style',
    description: 'Set the active dimension style for new dimension entities',
    category: 'dim_style',
    commandType: 'SetCurrentDimStyle',
    parameters: {
      name: { type: 'string', description: 'Dimension style name to make current' },
    },
  },
];

// ─── MLeader Style Tools ────────────────────────────────────────────────────

const MLEADER_STYLE_TOOLS: ToolDefinition[] = [
  {
    name: 'create_mleader_style',
    description: 'Create a new named multileader style (mirrors AutoCAD MLEADERSTYLE).',
    category: 'mleader_style',
    commandType: 'CreateMLeaderStyle',
    parameters: {
      name: { type: 'string', description: 'MLeader style name' },
      arrow_size: { type: 'number', description: 'Arrow size', optional: true },
      text_height: { type: 'number', description: 'Text height', optional: true },
      text_style_name: {
        type: 'string',
        description: 'Text style reference',
        optional: true,
      },
      landing_distance: {
        type: 'number',
        description: 'Horizontal landing length',
        optional: true,
      },
      enable_landing: {
        type: 'boolean',
        description: 'Draw the landing segment',
        optional: true,
      },
      enable_dogleg: {
        type: 'boolean',
        description: 'Draw the dogleg kink',
        optional: true,
      },
      color: {
        type: 'string',
        description: 'Color hex; null = ByBlock',
        optional: true,
      },
    },
  },
  {
    name: 'modify_mleader_style',
    description: 'Modify properties of an existing multileader style.',
    category: 'mleader_style',
    commandType: 'ModifyMLeaderStyle',
    parameters: {
      name: { type: 'string', description: 'MLeader style name to modify' },
      arrow_size: { type: 'number', description: 'Arrow size', optional: true },
      text_height: { type: 'number', description: 'Text height', optional: true },
      text_style_name: { type: 'string', description: 'Text style reference', optional: true },
      landing_distance: { type: 'number', description: 'Landing length', optional: true },
      enable_landing: { type: 'boolean', description: 'Draw landing', optional: true },
      enable_dogleg: { type: 'boolean', description: 'Draw dogleg', optional: true },
      color: { type: 'string', description: 'Color hex', optional: true },
    },
  },
  {
    name: 'delete_mleader_style',
    description:
      'Delete a multileader style by name. Standard cannot be deleted (matches AutoCAD).',
    category: 'mleader_style',
    commandType: 'DeleteMLeaderStyle',
    parameters: {
      name: { type: 'string', description: 'MLeader style name to delete' },
    },
  },
  {
    name: 'set_current_mleader_style',
    description: 'Set the active multileader style for newly created leaders.',
    category: 'mleader_style',
    commandType: 'SetCurrentMLeaderStyle',
    parameters: {
      name: { type: 'string', description: 'MLeader style name to make current' },
    },
  },
];

// ─── Table Style Tools ──────────────────────────────────────────────────────

const TABLE_STYLE_TOOLS: ToolDefinition[] = [
  {
    name: 'create_table_style',
    description: 'Create a new named table style (mirrors AutoCAD TABLESTYLE).',
    category: 'table_style',
    commandType: 'CreateTableStyle',
    parameters: {
      name: { type: 'string', description: 'Table style name' },
      text_style_name: { type: 'string', description: 'Text style for cells', optional: true },
      data_text_height: {
        type: 'number',
        description: 'Default text height for data rows',
        optional: true,
      },
      header_text_height: {
        type: 'number',
        description: 'Text height for the header row',
        optional: true,
      },
      title_text_height: {
        type: 'number',
        description: 'Text height for the title row',
        optional: true,
      },
      has_title: { type: 'boolean', description: 'Show title row', optional: true },
      has_header: { type: 'boolean', description: 'Show header row', optional: true },
      cell_margin: { type: 'number', description: 'Margin inside cells', optional: true },
      border_color: {
        type: 'string',
        description: 'Border color hex; null = ByBlock',
        optional: true,
      },
      title_fill_color: {
        type: 'string',
        description: 'Title row background color',
        optional: true,
      },
      header_fill_color: {
        type: 'string',
        description: 'Header row background color',
        optional: true,
      },
    },
  },
  {
    name: 'modify_table_style',
    description: 'Modify properties of an existing table style.',
    category: 'table_style',
    commandType: 'ModifyTableStyle',
    parameters: {
      name: { type: 'string', description: 'Table style name to modify' },
      text_style_name: { type: 'string', description: 'Text style for cells', optional: true },
      data_text_height: { type: 'number', description: 'Data row text height', optional: true },
      header_text_height: { type: 'number', description: 'Header text height', optional: true },
      title_text_height: { type: 'number', description: 'Title text height', optional: true },
      has_title: { type: 'boolean', description: 'Show title row', optional: true },
      has_header: { type: 'boolean', description: 'Show header row', optional: true },
      cell_margin: { type: 'number', description: 'Cell margin', optional: true },
      border_color: { type: 'string', description: 'Border color hex', optional: true },
      title_fill_color: { type: 'string', description: 'Title fill color', optional: true },
      header_fill_color: { type: 'string', description: 'Header fill color', optional: true },
    },
  },
  {
    name: 'delete_table_style',
    description: 'Delete a table style by name. Standard cannot be deleted (matches AutoCAD).',
    category: 'table_style',
    commandType: 'DeleteTableStyle',
    parameters: {
      name: { type: 'string', description: 'Table style name to delete' },
    },
  },
  {
    name: 'set_current_table_style',
    description: 'Set the active table style for newly created tables.',
    category: 'table_style',
    commandType: 'SetCurrentTableStyle',
    parameters: {
      name: { type: 'string', description: 'Table style name to make current' },
    },
  },
];

// ─── Group Tools (AutoCAD GROUP / UNGROUP) ──────────────────────────────────

const GROUP_TOOLS: ToolDefinition[] = [
  {
    name: 'create_group',
    description:
      'Create a named group binding a set of entity IDs. Pass an empty name for an anonymous group.',
    category: 'group',
    commandType: 'CreateGroup',
    parameters: {
      name: { type: 'string', description: 'Group name (omit for anonymous)', optional: true },
      entity_ids: { type: 'string[]', description: 'Entity IDs to include' },
      selectable: {
        type: 'boolean',
        description: 'Selecting any member selects the whole group',
        optional: true,
      },
    },
  },
  {
    name: 'delete_group',
    description: 'Delete a named group. Members are not affected.',
    category: 'group',
    commandType: 'DeleteGroup',
    parameters: {
      name: { type: 'string', description: 'Group name to delete' },
    },
  },
  {
    name: 'rename_group',
    description: 'Rename a group. Anonymous groups become named.',
    category: 'group',
    commandType: 'RenameGroup',
    parameters: {
      old_name: { type: 'string', description: 'Existing group name' },
      new_name: { type: 'string', description: 'New group name' },
    },
  },
  {
    name: 'add_to_group',
    description: 'Add entity IDs to an existing group (deduplicated).',
    category: 'group',
    commandType: 'AddToGroup',
    parameters: {
      name: { type: 'string', description: 'Group name' },
      entity_ids: { type: 'string[]', description: 'Entity IDs to add' },
    },
  },
  {
    name: 'remove_from_group',
    description: 'Remove entity IDs from an existing group.',
    category: 'group',
    commandType: 'RemoveFromGroup',
    parameters: {
      name: { type: 'string', description: 'Group name' },
      entity_ids: { type: 'string[]', description: 'Entity IDs to remove' },
    },
  },
  {
    name: 'set_group_selectable',
    description:
      'Toggle whether selecting a member of the group selects the whole group (PICKSTYLE).',
    category: 'group',
    commandType: 'SetGroupSelectable',
    parameters: {
      name: { type: 'string', description: 'Group name' },
      selectable: { type: 'boolean', description: 'Selectable as a unit?' },
    },
  },
];

// ─── Named UCS Tools (AutoCAD UCS) ──────────────────────────────────────────

const UCS_TOOLS: ToolDefinition[] = [
  {
    name: 'save_ucs',
    description:
      'Save a named User Coordinate System with origin and X/Y axis directions. Axes are normalized.',
    category: 'ucs',
    commandType: 'SaveUcs',
    parameters: {
      name: { type: 'string', description: 'UCS name (cannot be "World")' },
      origin_x: { type: 'number', description: 'Origin X in world coordinates' },
      origin_y: { type: 'number', description: 'Origin Y in world coordinates' },
      x_axis_x: { type: 'number', description: 'X axis direction X component' },
      x_axis_y: { type: 'number', description: 'X axis direction Y component' },
      y_axis_x: { type: 'number', description: 'Y axis direction X component' },
      y_axis_y: { type: 'number', description: 'Y axis direction Y component' },
    },
  },
  {
    name: 'delete_ucs',
    description: 'Delete a named UCS. The World UCS cannot be deleted.',
    category: 'ucs',
    commandType: 'DeleteUcs',
    parameters: {
      name: { type: 'string', description: 'UCS name to delete' },
    },
  },
  {
    name: 'set_current_ucs',
    description: 'Set the active UCS by name. Use "World" to return to the world UCS.',
    category: 'ucs',
    commandType: 'SetCurrentUcs',
    parameters: {
      name: { type: 'string', description: 'UCS name to activate' },
    },
  },
];

// ─── Named View Tools (AutoCAD VIEW) ────────────────────────────────────────

const VIEW_TOOLS: ToolDefinition[] = [
  {
    name: 'save_named_view',
    description: 'Save a named view (camera center, zoom, optional rotation).',
    category: 'view',
    commandType: 'SaveNamedView',
    parameters: {
      name: { type: 'string', description: 'View name' },
      center_x: { type: 'number', description: 'View center X' },
      center_y: { type: 'number', description: 'View center Y' },
      zoom: { type: 'number', description: 'Zoom level (world units per screen unit)' },
      rotation: { type: 'number', description: 'View rotation in radians', optional: true },
    },
  },
  {
    name: 'delete_named_view',
    description: 'Delete a named view by name.',
    category: 'view',
    commandType: 'DeleteNamedView',
    parameters: {
      name: { type: 'string', description: 'View name to delete' },
    },
  },
  {
    name: 'rename_named_view',
    description: 'Rename a named view.',
    category: 'view',
    commandType: 'RenameNamedView',
    parameters: {
      old_name: { type: 'string', description: 'Existing view name' },
      new_name: { type: 'string', description: 'New view name' },
    },
  },
];

// ─── Drawing Properties (DWGPROPS) Tools ────────────────────────────────────

const DWG_PROPS_TOOLS: ToolDefinition[] = [
  {
    name: 'get_dwg_props',
    description: 'Get the drawing properties (DWGPROPS): title, subject, author, etc.',
    category: 'state',
    commandType: '_query_dwg_props',
    parameters: {},
  },
  {
    name: 'set_dwg_props',
    description: 'Update one or more DWGPROPS metadata fields. Unspecified fields are preserved.',
    category: 'state',
    commandType: 'SetDwgProps',
    parameters: {
      title: { type: 'string', description: 'Drawing title', optional: true },
      subject: { type: 'string', description: 'Subject', optional: true },
      author: { type: 'string', description: 'Author', optional: true },
      keywords: { type: 'string', description: 'Keywords', optional: true },
      comments: { type: 'string', description: 'Comments', optional: true },
      hyperlink_base: {
        type: 'string',
        description: 'Hyperlink base URL or path',
        optional: true,
      },
      last_saved_by: { type: 'string', description: 'Last saved by', optional: true },
    },
  },
];

// ─── System Variable Tools ──────────────────────────────────────────────────

const SYSVAR_TOOLS: ToolDefinition[] = [
  {
    name: 'set_sysvar',
    description: 'Set a system variable (e.g. OFFSETDIST, FILLETRAD, CHAMFERA, CHAMFERB, LTSCALE)',
    category: 'state',
    commandType: 'SetSysvar',
    parameters: {
      name: { type: 'string', description: 'System variable name (e.g. "FILLETRAD")' },
      value: { type: 'number', description: 'Value to set' },
    },
  },
  {
    name: 'get_sysvar',
    description:
      'Get the current value of a system variable (e.g. OFFSETDIST, FILLETRAD, CHAMFERA)',
    category: 'state',
    commandType: 'GetSysvar',
    parameters: {
      name: { type: 'string', description: 'System variable name to query' },
    },
  },
  {
    name: 'set_sysvar_typed',
    description:
      'Set a typed system variable (Int / Float / String / Point2d). Use for OSMODE, GRIDUNIT, CLAYER, CELTYPE, AUTOSNAP, ORTHOMODE, SNAPMODE, etc. value_json is the JSON-encoded SysvarValue.',
    category: 'state',
    commandType: 'SetSysvarTyped',
    parameters: {
      name: { type: 'string', description: 'System variable name (e.g. "OSMODE")' },
      value_json: {
        type: 'string',
        description:
          'JSON-encoded SysvarValue: \'{"Int":4133}\' / \'{"Float":1.0}\' / \'{"String":"ByLayer"}\' / \'{"Point2d":{"x":0.5,"y":0.5}}\'',
      },
    },
  },
  {
    name: 'get_sysvar_typed',
    description:
      'Get a typed system variable as JSON (returned in CommandResult.warnings[0]). Use for non-Float sysvars where get_sysvar would f64-coerce.',
    category: 'state',
    commandType: 'GetSysvarTyped',
    parameters: {
      name: { type: 'string', description: 'System variable name to query' },
    },
  },
];

// ─── Units Tools ────────────────────────────────────────────────────────────

const UNITS_TOOLS: ToolDefinition[] = [
  {
    name: 'set_units',
    description: 'Set drawing units (linear type, angular type, precision, insertion scale)',
    category: 'state',
    commandType: 'SetUnits',
    parameters: {
      linear_type: {
        type: 'string',
        description:
          'Linear unit type: "decimal", "engineering", "architectural", "fractional", "scientific"',
        optional: true,
      },
      linear_precision: {
        type: 'number',
        description: 'Number of decimal places for linear units (0-8)',
        optional: true,
      },
      angular_type: {
        type: 'string',
        description: 'Angular unit type: "decimal_degrees", "dms", "grads", "radians", "surveyor"',
        optional: true,
      },
      angular_precision: {
        type: 'number',
        description: 'Number of decimal places for angular units (0-8)',
        optional: true,
      },
      insertion_scale: {
        type: 'number',
        description: 'Scale factor for block insertion',
        optional: true,
      },
    },
  },
  {
    name: 'get_units',
    description: 'Get the current drawing unit settings',
    category: 'state',
    commandType: 'GetUnits',
    parameters: {},
  },
];

// ─── Export ──────────────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  ...DRAW_TOOLS,
  ...EDIT_TOOLS,
  ...QUERY_TOOLS,
  ...MEASURE_TOOLS,
  ...STATE_TOOLS,
  ...LAYER_TOOLS,
  ...CONSTRAINT_TOOLS,
  ...STYLE_TOOLS,
  ...BLOCK_TOOLS,
  ...ARRAY_TOOLS,
  ...TEXT_STYLE_TOOLS,
  ...DIM_STYLE_TOOLS,
  ...MLEADER_STYLE_TOOLS,
  ...TABLE_STYLE_TOOLS,
  ...GROUP_TOOLS,
  ...UCS_TOOLS,
  ...VIEW_TOOLS,
  ...DWG_PROPS_TOOLS,
  ...SYSVAR_TOOLS,
  ...UNITS_TOOLS,
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((t) => t.category === category);
}

/** Build a map of tool name to kernel command type */
export function buildToolCommandMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of TOOL_DEFINITIONS) {
    map[def.name] = def.commandType;
  }
  return map;
}
