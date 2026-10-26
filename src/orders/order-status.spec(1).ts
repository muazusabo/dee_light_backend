import { canTransition, newOrderNumber, TRANSITIONS } from './order-status';

describe('order status transitions', () => {
  it('allows the normal flow', () => {
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'PREPARING')).toBe(true);
    expect(canTransition('READY', 'COMPLETED')).toBe(true);
  });
  it('blocks skipping and reopening', () => {
    expect(canTransition('PENDING', 'COMPLETED')).toBe(false);
    expect(canTransition('COMPLETED', 'PENDING')).toBe(false);
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
  });
  it('has no outgoing transitions from terminal states', () => {
    expect(TRANSITIONS.COMPLETED).toEqual([]);
    expect(TRANSITIONS.CANCELLED).toEqual([]);
  });
  it('generates well-formed order numbers', () => {
    expect(newOrderNumber()).toMatch(/^DL-\d{6}-[0-9A-Z]{4}$/);
  });
});
