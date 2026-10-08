import { describe, it, expect } from 'vitest';
import {
  TOOL_DEFINITIONS,
  getToolByName,
  getToolsByCategory,
  buildToolCommandMap,
} from '../tool-definitions';

describe('Tool Definitions', () => {
  it('has at least 80 tools defined', () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(80);
  });

  it('every tool has a unique name', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every tool has a non-empty description', () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.description.length, `${def.name} missing description`).toBeGreaterThan(0);
    }
  });

  it('every tool has a commandType', () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.commandType.length, `${def.name} missing commandType`).toBeGreaterThan(0);
    }
  });

  it('every parameter has type and description', () => {
    for (const def of TOOL_DEFINITIONS) {
      for (const [key, param] of Object.entries(def.parameters)) {
        expect(param.type, `${def.name}.${key} missing type`).toBeTruthy();
        expect(param.description, `${def.name}.${key} missing description`).toBeTruthy();
      }
    }
  });

  it('exposes set_sysvar_typed and get_sysvar_typed for non-Float sysvars (S4-A)', () => {
    const setTyped = getToolByName('set_sysvar_typed');
    expect(setTyped).toBeDefined();
    expect(setTyped?.commandType).toBe('SetSysvarTyped');
    expect(setTyped?.parameters.value_json).toBeDefined();

    const getTyped = getToolByName('get_sysvar_typed');
    expect(getTyped).toBeDefined();
    expect(getTyped?.commandType).toBe('GetSysvarTyped');
  });

  it('keeps the legacy set_sysvar / get_sysvar tools for back-compat (S4-A)', () => {
    expect(getToolByName('set_sysvar')?.commandType).toBe('SetSysvar');
    expect(getToolByName('get_sysvar')?.commandType).toBe('GetSysvar');
  });

  it('perEntity tools have ids parameter', () => {
    const perEntity = TOOL_DEFINITIONS.filter((d) => d.perEntity);
    for (const def of perEntity) {
      expect(def.parameters.ids, `${def.name} is perEntity but has no ids param`).toBeDefined();
      expect(def.parameters.ids.type).toBe('string[]');
    }
  });

  it('getToolByName returns correct tool', () => {
    const line = getToolByName('draw_line');
    expect(line).toBeDefined();
    expect(line!.commandType).toBe('CreateLine');
  });

  it('getToolByName returns undefined for unknown', () => {
    expect(getToolByName('nonexistent')).toBeUndefined();
  });

  it('getToolsByCategory returns correct tools', () => {
    const drawTools = getToolsByCategory('draw');
    expect(drawTools.length).toBeGreaterThan(5);
    expect(drawTools.every((t) => t.category === 'draw')).toBe(true);
  });

  it('buildToolCommandMap covers all tools', () => {
    const map = buildToolCommandMap();
    expect(Object.keys(map).length).toBe(TOOL_DEFINITIONS.length);
    expect(map.draw_line).toBe('CreateLine');
    expect(map.move_entities).toBe('MoveEntity');
    expect(map.create_layer).toBe('CreateLayer');
    expect(map.add_horizontal).toBe('AddConstraintHorizontal');
  });

  it('draw tools cover all expected kernel create commands', () => {
    const drawCommands = getToolsByCategory('draw').map((t) => t.commandType);
    const expected = [
      'CreateLine',
      'CreateCircle',
      'CreateCircle3P',
      'CreateCircle2P',
      'CreateRectangle',
      'CreateArc',
      'CreatePolyline',
      'CreatePoint',
      'CreateText',
      'CreateEllipse',
      'CreateSpline',
      'CreateConstructionLine',
      'CreateDimension',
      'CreateAlignedDimension',
      'CreateAngularDimension',
      'CreateRadialDimension',
      'CreateDiameterDimension',
      'CreateHatch',
      'CreateMText',
      'CreateTable',
      'CreateRevisionCloud',
    ];
    for (const cmd of expected) {
      expect(drawCommands, `Missing draw tool for ${cmd}`).toContain(cmd);
    }
  });

  it('constraint tools cover all expected kernel constraint commands', () => {
    const constraintCommands = getToolsByCategory('constraint').map((t) => t.commandType);
    const expected = [
      'AddConstraintHorizontal',
      'AddConstraintVertical',
      'AddConstraintCoincident',
      'AddConstraintDistance',
      'AddConstraintFixed',
      'AddConstraintParallel',
      'AddConstraintPerpendicular',
      'AddConstraintEqualLength',
      'AddConstraintTangent',
      'AddConstraintConcentric',
      'AddConstraintSymmetric',
      'RemoveConstraint',
      'AnalyzeDof',
    ];
    for (const cmd of expected) {
      expect(constraintCommands, `Missing constraint tool for ${cmd}`).toContain(cmd);
    }
  });

  it('edit tools cover advanced edit commands', () => {
    const editCommands = getToolsByCategory('edit').map((t) => t.commandType);
    const expected = [
      'OffsetEntity',
      'OffsetEntityThrough',
      'TrimEntity',
      'ExtendEntity',
      'Fillet',
      'FilletPolyline',
      'Chamfer',
      'Explode',
      'JoinEntities',
      'Lengthen',
      'BreakAtPoint',
      'Break',
      'MatchProperties',
    ];
    for (const cmd of expected) {
      expect(editCommands, `Missing edit tool for ${cmd}`).toContain(cmd);
    }
  });
});
