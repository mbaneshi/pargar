import { describe, it, expect } from 'vitest';
import { WithinCommandUndoStack } from '../WithinCommandUndoStack';

describe('WithinCommandUndoStack', () => {
  it('push and pop in LIFO order', () => {
    const stack = new WithinCommandUndoStack();
    stack.push('CreateLine', ['id_1']);
    stack.push('CreateCircle', ['id_2']);
    expect(stack.pop()).toEqual({ commandType: 'CreateCircle', entityIds: ['id_2'] });
    expect(stack.pop()).toEqual({ commandType: 'CreateLine', entityIds: ['id_1'] });
  });

  it('pop on empty returns null', () => {
    expect(new WithinCommandUndoStack().pop()).toBeNull();
  });

  it('depth tracks stack size', () => {
    const stack = new WithinCommandUndoStack();
    expect(stack.depth).toBe(0);
    stack.push('CreateLine', ['id_1']);
    expect(stack.depth).toBe(1);
    stack.push('CreateCircle', ['id_2']);
    expect(stack.depth).toBe(2);
    stack.pop();
    expect(stack.depth).toBe(1);
  });

  it('clear resets', () => {
    const stack = new WithinCommandUndoStack();
    stack.push('CreateLine', ['id_1']);
    stack.push('CreateCircle', ['id_2']);
    stack.clear();
    expect(stack.depth).toBe(0);
    expect(stack.pop()).toBeNull();
  });
});
