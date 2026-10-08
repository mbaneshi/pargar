import type { ToolbarItem } from './toolbar-layout';

export interface RibbonTab {
  id: string;
  label: string;
  panels: RibbonPanel[];
}

export interface RibbonPanel {
  label: string;
  items: ToolbarItem[];
}

export const RIBBON_LAYOUT: RibbonTab[] = [
  {
    id: 'home',
    label: 'Home',
    panels: [
      {
        label: 'Select',
        items: [{ type: 'tool', commandId: 'select', label: 'Select' }],
      },
      {
        label: 'Draw',
        items: [
          { type: 'tool', commandId: 'draw_point', label: 'Point' },
          { type: 'tool', commandId: 'draw_line', label: 'Line' },
          {
            type: 'split-tool',
            commandId: 'draw_circle',
            label: 'Circle',
            variants: [
              { label: 'Center, Radius', description: 'Specify center point then radius' },
              { label: 'Center, Diameter', description: 'Specify center point then diameter' },
              { label: '2-Point', description: 'Define circle by two diametric points' },
              { label: '3-Point', description: 'Define circle through three points' },
              { label: 'Tan, Tan, Radius', description: 'Tangent to two objects with radius' },
            ],
          },
          {
            type: 'split-tool',
            commandId: 'draw_rectangle',
            label: 'Rect',
            variants: [
              { label: 'Corner', description: 'Two opposite corner points' },
              { label: 'Dimensions', description: 'Specify width and height' },
              { label: 'Chamfer', description: 'Rectangle with chamfered corners' },
              { label: 'Fillet', description: 'Rectangle with filleted corners' },
            ],
          },
          {
            type: 'split-tool',
            commandId: 'draw_arc',
            label: 'Arc',
            variants: [
              { label: '3-Point', description: 'Start, point on arc, end' },
              { label: 'Start, Center, End', description: 'Start point, center, end point' },
              { label: 'Start, End, Radius', description: 'Start point, end point, radius' },
            ],
          },
          { type: 'tool', commandId: 'draw_ellipse', label: 'Ellipse' },
          { type: 'tool', commandId: 'draw_spline', label: 'Spline' },
          { type: 'tool', commandId: 'draw_polyline', label: 'Pline' },
          { type: 'tool', commandId: 'draw_xline', label: 'XLine' },
          { type: 'tool', commandId: 'draw_revcloud', label: 'RevCloud' },
        ],
      },
      {
        label: 'Move',
        items: [
          { type: 'tool', commandId: 'modify_move', label: 'Move' },
          { type: 'tool', commandId: 'modify_copy', label: 'Copy' },
          { type: 'tool', commandId: 'modify_rotate', label: 'Rotate' },
          { type: 'tool', commandId: 'modify_mirror', label: 'Mirror' },
          { type: 'tool', commandId: 'modify_scale', label: 'Scale' },
        ],
      },
      {
        label: 'Modify',
        items: [
          { type: 'tool', commandId: 'modify_offset', label: 'Offset' },
          { type: 'tool', commandId: 'modify_trim', label: 'Trim' },
          { type: 'tool', commandId: 'modify_extend', label: 'Extend' },
          { type: 'tool', commandId: 'modify_fillet', label: 'Fillet' },
          { type: 'tool', commandId: 'modify_chamfer', label: 'Chamfer' },
          { type: 'tool', commandId: 'modify_array', label: 'Array' },
          { type: 'tool', commandId: 'modify_join', label: 'Join' },
          { type: 'tool', commandId: 'modify_explode', label: 'Explode' },
          { type: 'tool', commandId: 'modify_matchprop', label: 'MatchP' },
          { type: 'tool', commandId: 'modify_lengthen', label: 'Lengthen' },
          { type: 'tool', commandId: 'modify_break', label: 'Break' },
        ],
      },
    ],
  },
  {
    id: 'annotate',
    label: 'Annotate',
    panels: [
      {
        label: 'Text',
        items: [{ type: 'tool', commandId: 'annotate_text', label: 'Text' }],
      },
      {
        label: 'Dimensions',
        items: [
          {
            type: 'split-tool',
            commandId: 'annotate_dimension',
            label: 'Dim',
            variants: [
              { label: 'Linear', description: 'Horizontal or vertical distance' },
              { label: 'Aligned', description: 'Distance along an angled line' },
              { label: 'Angular', description: 'Angle between two lines' },
              { label: 'Radius', description: 'Radius of an arc or circle' },
              { label: 'Diameter', description: 'Diameter of an arc or circle' },
            ],
          },
          { type: 'tool', commandId: 'annotate_aligneddim', label: 'AlDim' },
          { type: 'tool', commandId: 'annotate_measuredist', label: 'Dist' },
          { type: 'tool', commandId: 'annotate_measurearea', label: 'Area' },
        ],
      },
    ],
  },
  {
    id: 'view',
    label: 'View',
    panels: [
      {
        label: 'Navigate',
        items: [{ type: 'action', label: 'Zoom Extents', action: 'zoom-extents' }],
      },
      {
        label: 'Edit',
        items: [
          { type: 'action', label: 'Undo', action: 'undo' },
          { type: 'action', label: 'Redo', action: 'redo' },
          { type: 'action', label: 'Delete', action: 'delete-selected' },
        ],
      },
      {
        label: 'Views',
        items: [
          { type: 'action', label: 'Save View', action: 'save-view' },
          { type: 'action', label: 'Restore View', action: 'restore-view' },
        ],
      },
    ],
  },
  {
    id: 'insert',
    label: 'Insert',
    panels: [{ label: 'Block', items: [] }],
  },
  {
    id: 'parametric',
    label: 'Parametric',
    panels: [
      {
        label: 'Constrain',
        items: [
          { type: 'tool', commandId: 'constraint_horizontal', label: 'H' },
          { type: 'tool', commandId: 'constraint_vertical', label: 'V' },
          { type: 'tool', commandId: 'constraint_parallel', label: '\u2225' },
          { type: 'tool', commandId: 'constraint_perpendicular', label: '\u22A5' },
        ],
      },
    ],
  },
];
