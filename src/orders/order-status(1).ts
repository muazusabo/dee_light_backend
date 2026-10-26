import { OrderStatus } from '@prisma/client';
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};
export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to);
export function newOrderNumber(now = new Date()) {
  const d = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4))).map((b) => (b % 36).toString(36)).join('').toUpperCase();
  return `DL-${d}-${rand}`;
}
