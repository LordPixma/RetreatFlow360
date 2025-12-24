/**
 * Realtime Worker
 *
 * Exports Durable Objects for real-time coordination:
 * - EventBookingCoordinator: Handles event capacity and booking reservations
 * - RoomAllocationLock: Handles room availability and prevents double-booking
 */

export { EventBookingCoordinator } from './objects/EventBookingCoordinator';
export { RoomAllocationLock } from './objects/RoomAllocationLock';

interface Env {
  EVENT_COORDINATOR: DurableObjectNamespace;
  ROOM_LOCK: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route to appropriate Durable Object
    if (url.pathname.startsWith('/event/')) {
      const eventId = url.pathname.split('/')[2];
      if (!eventId) {
        return new Response('Event ID required', { status: 400 });
      }

      const id = env.EVENT_COORDINATOR.idFromName(eventId);
      const stub = env.EVENT_COORDINATOR.get(id);
      return stub.fetch(request);
    }

    if (url.pathname.startsWith('/room/')) {
      const roomId = url.pathname.split('/')[2];
      if (!roomId) {
        return new Response('Room ID required', { status: 400 });
      }

      const id = env.ROOM_LOCK.idFromName(roomId);
      const stub = env.ROOM_LOCK.get(id);
      return stub.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
