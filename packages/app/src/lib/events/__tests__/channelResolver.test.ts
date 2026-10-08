import { describe, it, expect } from 'vitest';
import { resolveChannels } from '../channelResolver';

describe('resolveChannels', () => {
  it('maps CreateLine to entities:created', () => {
    expect(resolveChannels({ type: 'CreateLine' })).toEqual(['entities:created']);
  });

  it('maps MoveEntity to entities:modified', () => {
    expect(resolveChannels({ type: 'MoveEntity' })).toEqual(['entities:modified']);
  });

  it('maps DeleteEntity to entities:deleted', () => {
    expect(resolveChannels({ type: 'DeleteEntity' })).toEqual(['entities:deleted']);
  });

  it('maps CopyEntity to entities:created (not modified)', () => {
    expect(resolveChannels({ type: 'CopyEntity' })).toEqual(['entities:created']);
  });

  it('maps ArrayRectangular to entities:created (not modified)', () => {
    expect(resolveChannels({ type: 'ArrayRectangular' })).toEqual(['entities:created']);
  });

  it('maps ArrayPolar to entities:created (not modified)', () => {
    expect(resolveChannels({ type: 'ArrayPolar' })).toEqual(['entities:created']);
  });

  it('maps MirrorEntity to entities:created', () => {
    expect(resolveChannels({ type: 'MirrorEntity' })).toEqual(['entities:created']);
  });

  it('maps OffsetEntity to entities:created', () => {
    expect(resolveChannels({ type: 'OffsetEntity' })).toEqual(['entities:created']);
  });

  it('maps CreateLayer to layers:changed', () => {
    expect(resolveChannels({ type: 'CreateLayer' })).toEqual(['layers:changed']);
  });

  it('maps SetLayerColor to layers:changed', () => {
    expect(resolveChannels({ type: 'SetLayerColor' })).toEqual(['layers:changed']);
  });

  it('maps Explode to deleted + created', () => {
    expect(resolveChannels({ type: 'Explode' })).toEqual(['entities:deleted', 'entities:created']);
  });

  it('maps JoinEntities to modified + deleted', () => {
    expect(resolveChannels({ type: 'JoinEntities' })).toEqual([
      'entities:modified',
      'entities:deleted',
    ]);
  });

  it('maps Fillet to modified + created', () => {
    expect(resolveChannels({ type: 'Fillet' })).toEqual(['entities:modified', 'entities:created']);
  });

  it('maps AddConstraintHorizontal to constraints:changed', () => {
    expect(resolveChannels({ type: 'AddConstraintHorizontal' })).toEqual(['constraints:changed']);
  });

  it('maps CreateTextStyle to textstyles:changed', () => {
    expect(resolveChannels({ type: 'CreateTextStyle' })).toEqual(['textstyles:changed']);
  });

  it('maps SetUnits to units:changed', () => {
    expect(resolveChannels({ type: 'SetUnits' })).toEqual(['units:changed']);
  });

  it('maps Undo to multiple channels', () => {
    const channels = resolveChannels({ type: 'Undo' });
    expect(channels).toContain('entities:created');
    expect(channels).toContain('entities:modified');
    expect(channels).toContain('entities:deleted');
    expect(channels).toContain('layers:changed');
  });

  it('returns default for unknown command type', () => {
    expect(resolveChannels({ type: 'FutureCommand' })).toEqual(['entities:modified']);
  });
});
