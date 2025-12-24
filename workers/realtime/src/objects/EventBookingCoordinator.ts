/**
 * EventBookingCoordinator Durable Object
 *
 * Handles real-time coordination for event bookings:
 * - Atomic capacity tracking to prevent overselling
 * - WebSocket connections for live availability updates
 * - Reservation holds for checkout flow
 */

interface BookingState {
  eventId: string;
  tenantId: string;
  maxAttendees: number;
  confirmedCount: number;
  pendingCount: number;
  reservations: Map<string, ReservationHold>;
}

interface ReservationHold {
  userId: string;
  pricingTier: string;
  createdAt: number;
  expiresAt: number;
}

interface ReserveRequest {
  type: 'reserve';
  userId: string;
  pricingTier: string;
  holdDurationMs?: number;
}

interface ReleaseRequest {
  type: 'release';
  userId: string;
}

interface ConfirmRequest {
  type: 'confirm';
  userId: string;
  bookingId: string;
}

interface CancelRequest {
  type: 'cancel';
  bookingId: string;
}

interface InitRequest {
  type: 'init';
  eventId: string;
  tenantId: string;
  maxAttendees: number;
  confirmedCount: number;
  pendingCount: number;
}

interface GetStatusRequest {
  type: 'status';
}

type CoordinatorRequest =
  | ReserveRequest
  | ReleaseRequest
  | ConfirmRequest
  | CancelRequest
  | InitRequest
  | GetStatusRequest;

interface CoordinatorResponse {
  success: boolean;
  error?: string;
  data?: {
    availableSpots?: number;
    reservationId?: string;
    expiresAt?: number;
    confirmed?: number;
    pending?: number;
  };
}

const DEFAULT_HOLD_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

export class EventBookingCoordinator implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, { userId?: string }> = new Map();
  private bookingState: BookingState | null = null;
  private cleanupAlarm: boolean = false;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade for real-time updates
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // HTTP API for booking operations
    if (request.method === 'POST') {
      try {
        const body = (await request.json()) as CoordinatorRequest;
        const response = await this.handleRequest(body);
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // GET request for status
    if (request.method === 'GET' && url.pathname === '/status') {
      const status = await this.getStatus();
      return new Response(JSON.stringify(status), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  private async handleWebSocket(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.state.acceptWebSocket(server);
    this.sessions.set(server, {});

    // Send initial state
    const status = await this.getStatus();
    server.send(JSON.stringify({ type: 'status', data: status }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const data = JSON.parse(message as string);

      if (data.type === 'subscribe' && data.userId) {
        const session = this.sessions.get(ws);
        if (session) {
          session.userId = data.userId;
        }
      }
    } catch {
      // Ignore invalid messages
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws);
  }

  private async handleRequest(req: CoordinatorRequest): Promise<CoordinatorResponse> {
    switch (req.type) {
      case 'init':
        return this.handleInit(req);
      case 'reserve':
        return this.handleReserve(req);
      case 'release':
        return this.handleRelease(req);
      case 'confirm':
        return this.handleConfirm(req);
      case 'cancel':
        return this.handleCancel(req);
      case 'status':
        return this.getStatus();
      default:
        return { success: false, error: 'Unknown request type' };
    }
  }

  private async handleInit(req: InitRequest): Promise<CoordinatorResponse> {
    this.bookingState = {
      eventId: req.eventId,
      tenantId: req.tenantId,
      maxAttendees: req.maxAttendees,
      confirmedCount: req.confirmedCount,
      pendingCount: req.pendingCount,
      reservations: new Map(),
    };

    await this.state.storage.put('bookingState', {
      ...this.bookingState,
      reservations: Array.from(this.bookingState.reservations.entries()),
    });

    // Set up cleanup alarm
    if (!this.cleanupAlarm) {
      await this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
      this.cleanupAlarm = true;
    }

    return {
      success: true,
      data: {
        availableSpots: this.getAvailableSpots(),
        confirmed: this.bookingState.confirmedCount,
        pending: this.bookingState.pendingCount,
      },
    };
  }

  private async handleReserve(req: ReserveRequest): Promise<CoordinatorResponse> {
    await this.ensureState();

    if (!this.bookingState) {
      return { success: false, error: 'Event not initialized' };
    }

    // Check if user already has a reservation
    if (this.bookingState.reservations.has(req.userId)) {
      const existing = this.bookingState.reservations.get(req.userId)!;
      return {
        success: true,
        data: {
          reservationId: req.userId,
          expiresAt: existing.expiresAt,
          availableSpots: this.getAvailableSpots(),
        },
      };
    }

    // Check availability
    const availableSpots = this.getAvailableSpots();
    if (availableSpots <= 0) {
      return { success: false, error: 'Event is at capacity' };
    }

    // Create reservation hold
    const holdDuration = req.holdDurationMs || DEFAULT_HOLD_DURATION_MS;
    const reservation: ReservationHold = {
      userId: req.userId,
      pricingTier: req.pricingTier,
      createdAt: Date.now(),
      expiresAt: Date.now() + holdDuration,
    };

    this.bookingState.reservations.set(req.userId, reservation);
    await this.persistState();

    // Broadcast update to all connected clients
    this.broadcastStatus();

    return {
      success: true,
      data: {
        reservationId: req.userId,
        expiresAt: reservation.expiresAt,
        availableSpots: this.getAvailableSpots(),
      },
    };
  }

  private async handleRelease(req: ReleaseRequest): Promise<CoordinatorResponse> {
    await this.ensureState();

    if (!this.bookingState) {
      return { success: false, error: 'Event not initialized' };
    }

    this.bookingState.reservations.delete(req.userId);
    await this.persistState();

    this.broadcastStatus();

    return {
      success: true,
      data: { availableSpots: this.getAvailableSpots() },
    };
  }

  private async handleConfirm(req: ConfirmRequest): Promise<CoordinatorResponse> {
    await this.ensureState();

    if (!this.bookingState) {
      return { success: false, error: 'Event not initialized' };
    }

    // Remove reservation and increment confirmed count
    this.bookingState.reservations.delete(req.userId);
    this.bookingState.confirmedCount++;
    await this.persistState();

    this.broadcastStatus();

    return {
      success: true,
      data: {
        availableSpots: this.getAvailableSpots(),
        confirmed: this.bookingState.confirmedCount,
      },
    };
  }

  private async handleCancel(req: CancelRequest): Promise<CoordinatorResponse> {
    await this.ensureState();

    if (!this.bookingState) {
      return { success: false, error: 'Event not initialized' };
    }

    // Decrement confirmed count
    if (this.bookingState.confirmedCount > 0) {
      this.bookingState.confirmedCount--;
    }
    await this.persistState();

    this.broadcastStatus();

    return {
      success: true,
      data: {
        availableSpots: this.getAvailableSpots(),
        confirmed: this.bookingState.confirmedCount,
      },
    };
  }

  private async getStatus(): Promise<CoordinatorResponse> {
    await this.ensureState();

    if (!this.bookingState) {
      return { success: false, error: 'Event not initialized' };
    }

    return {
      success: true,
      data: {
        availableSpots: this.getAvailableSpots(),
        confirmed: this.bookingState.confirmedCount,
        pending: this.bookingState.reservations.size,
      },
    };
  }

  private getAvailableSpots(): number {
    if (!this.bookingState) return 0;
    const total =
      this.bookingState.confirmedCount +
      this.bookingState.pendingCount +
      this.bookingState.reservations.size;
    return Math.max(0, this.bookingState.maxAttendees - total);
  }

  private async ensureState(): Promise<void> {
    if (this.bookingState) return;

    const stored = await this.state.storage.get<{
      eventId: string;
      tenantId: string;
      maxAttendees: number;
      confirmedCount: number;
      pendingCount: number;
      reservations: [string, ReservationHold][];
    }>('bookingState');

    if (stored) {
      this.bookingState = {
        ...stored,
        reservations: new Map(stored.reservations),
      };
    }
  }

  private async persistState(): Promise<void> {
    if (!this.bookingState) return;

    await this.state.storage.put('bookingState', {
      ...this.bookingState,
      reservations: Array.from(this.bookingState.reservations.entries()),
    });
  }

  private broadcastStatus(): void {
    const status = {
      type: 'status',
      data: {
        availableSpots: this.getAvailableSpots(),
        confirmed: this.bookingState?.confirmedCount ?? 0,
        pending: this.bookingState?.reservations.size ?? 0,
      },
    };

    const message = JSON.stringify(status);
    for (const ws of this.sessions.keys()) {
      try {
        ws.send(message);
      } catch {
        // WebSocket might be closed
        this.sessions.delete(ws);
      }
    }
  }

  async alarm(): Promise<void> {
    await this.ensureState();

    if (!this.bookingState) return;

    // Clean up expired reservations
    const now = Date.now();
    let changed = false;

    for (const [userId, reservation] of this.bookingState.reservations) {
      if (reservation.expiresAt < now) {
        this.bookingState.reservations.delete(userId);
        changed = true;
      }
    }

    if (changed) {
      await this.persistState();
      this.broadcastStatus();
    }

    // Schedule next cleanup
    await this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
  }
}
