import { describe, it, expect } from 'vitest';
import {
  EntityType,
  CadEventType,
  type EntityId,
  type CadEntity,
  type EventEnvelope,
  type Actor,
  type CadEvent,
  type CommandResult,
  type Command,
  type Layer,
  type FileFormatAdapter,
} from '../index';

describe('index re-exports', () => {
  it('exports EntityType enum', () => {
    expect(EntityType).toBeDefined();
    expect(EntityType.Line).toBe('Line');
  });

  it('exports CadEventType enum', () => {
    expect(CadEventType).toBeDefined();
    expect(CadEventType.EntityCreated).toBe('EntityCreated');
  });
});

describe('EntityType enum completeness', () => {
  const expectedTypes = [
    'Line',
    'Circle',
    'Arc',
    'Polyline',
    'Rectangle',
    'Text',
    'Dimension',
    'Ellipse',
    'Spline',
    'Point',
    'ConstructionLine',
    'BlockRef',
    'AlignedDimension',
    'AngularDimension',
    'RadialDimension',
    'DiameterDimension',
    'Hatch',
    'MText',
    'Table',
    'RevisionCloud',
  ];

  it('has exactly 20 entity types', () => {
    const values = Object.values(EntityType);
    expect(values).toHaveLength(20);
  });

  it.each(expectedTypes)('includes %s', (t) => {
    expect(Object.values(EntityType)).toContain(t);
  });

  it('enum keys match values (string enum identity)', () => {
    for (const [key, value] of Object.entries(EntityType)) {
      expect(key).toBe(value);
    }
  });
});

describe('CadEventType enum completeness', () => {
  const expectedEvents = [
    'EntityCreated',
    'EntityDeleted',
    'EntityMoved',
    'EntityRotated',
    'EntityScaled',
    'EntityCopied',
    'EntityModified',
    'EntityStyleChanged',
    'TextStyleCreated',
    'TextStyleModified',
    'TextStyleDeleted',
    'CompoundEvent',
  ];

  it('has exactly 12 event types', () => {
    const values = Object.values(CadEventType);
    expect(values).toHaveLength(12);
  });

  it.each(expectedEvents)('includes %s', (e) => {
    expect(Object.values(CadEventType)).toContain(e);
  });
});

describe('EntityId branded type', () => {
  it('accepts string at runtime but carries brand at type level', () => {
    const id = 'ent_001' as EntityId;
    expect(typeof id).toBe('string');
    expect(id).toBe('ent_001');
  });
});

describe('EventEnvelope structure', () => {
  it('accepts a valid envelope', () => {
    const actor: Actor = { type: 'user', session_id: 'sess_1' };
    const event: CadEvent = {
      type: CadEventType.EntityCreated,
      id: 'ent_1',
      payload: {},
    };
    const envelope: EventEnvelope = {
      seq: 1,
      timestamp_ms: Date.now(),
      actor,
      schema_version: 1,
      prev_hash: '0000000000000000',
      payload: event,
    };
    expect(envelope.seq).toBe(1);
    expect(envelope.prev_hash).toBe('0000000000000000');
    expect(envelope.actor.type).toBe('user');
  });

  it('accepts agent actor', () => {
    const actor: Actor = { type: 'agent', agent_id: 'a1', model: 'gpt-4' };
    expect(actor.type).toBe('agent');
  });

  it('accepts system actor', () => {
    const actor: Actor = { type: 'system' };
    expect(actor.type).toBe('system');
  });
});

describe('CommandResult structure', () => {
  it('accepts success result', () => {
    const result: CommandResult = {
      success: true,
      created_ids: ['ent_1', 'ent_2'],
    };
    expect(result.success).toBe(true);
    expect(result.created_ids).toHaveLength(2);
  });

  it('accepts error result', () => {
    const result: CommandResult = {
      success: false,
      created_ids: [],
      error: 'Layer not found',
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe('Layer not found');
  });
});

describe('CadEntity discriminated union', () => {
  it('narrows LineEntity by type', () => {
    const entity: CadEntity = {
      id: 'ent_1' as EntityId,
      type: EntityType.Line,
      layerId: '0',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
    };
    if (entity.type === EntityType.Line) {
      expect(entity.start.x).toBe(0);
      expect(entity.end.x).toBe(10);
    }
  });

  it('narrows CircleEntity by type', () => {
    const entity: CadEntity = {
      id: 'ent_2' as EntityId,
      type: EntityType.Circle,
      layerId: '0',
      center: { x: 5, y: 5 },
      radius: 3,
    };
    if (entity.type === EntityType.Circle) {
      expect(entity.center.x).toBe(5);
      expect(entity.radius).toBe(3);
    }
  });
});

describe('Command type narrowing', () => {
  it('CreateLine has correct fields', () => {
    const cmd: Command = {
      type: 'CreateLine',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 10,
      layer_id: '0',
    };
    expect(cmd.type).toBe('CreateLine');
  });

  it('Undo has no extra fields', () => {
    const cmd: Command = { type: 'Undo' };
    expect(cmd.type).toBe('Undo');
  });

  it('Fillet has geometry params', () => {
    const cmd: Command = {
      type: 'Fillet',
      id_a: 'e1',
      id_b: 'e2',
      radius: 5,
    };
    expect(cmd.type).toBe('Fillet');
  });
});

describe('FileFormatAdapter contract', () => {
  it('accepts a minimal adapter implementation', () => {
    const adapter: FileFormatAdapter = {
      id: 'test',
      name: 'Test Format',
      extensions: ['.test'],
      mimeType: 'application/test',
      capabilities: { import: true, export: false },
    };
    expect(adapter.capabilities.import).toBe(true);
    expect(adapter.capabilities.export).toBe(false);
    expect(adapter.extensions).toContain('.test');
  });
});

describe('Layer interface', () => {
  it('accepts required and optional fields', () => {
    const layer: Layer = {
      id: 'layer_0',
      name: '0',
      color: '#FFFFFF',
      visible: true,
      locked: false,
      linetype: 'Continuous',
      lineweight: 0.25,
    };
    expect(layer.id).toBe('layer_0');
    expect(layer.linetype).toBe('Continuous');
  });

  it('accepts without optional fields', () => {
    const layer: Layer = {
      id: 'layer_1',
      name: 'Walls',
      color: '#FF0000',
      visible: true,
      locked: false,
    };
    expect(layer.linetype).toBeUndefined();
    expect(layer.lineweight).toBeUndefined();
  });
});
