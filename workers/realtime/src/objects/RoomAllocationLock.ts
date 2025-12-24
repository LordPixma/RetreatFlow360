/**
 * RoomAllocationLock Durable Object
 *
 * Handles real-time coordination for room allocations:
 * - Prevents double-booking of rooms
 * - Tracks room availability by date range
 * - WebSocket connections for live availability updates
 */

interface DateRange {
  checkIn: number; // timestamp
  checkOut: number; // timestamp
}

interface Allocation {
  id: string;
  bookingId: string | null;
  userId: string;
  dateRange: DateRange;
  status: 'reserved' | 'confirmed' | 'cancelled';
  createdAt: number;
  expiresAt: number | null; // null for confirmed allocations
}

interface RoomState {
  roomId: string;
  tenantId: string;
  allocations: Map<string, Allocation>;
}

interface ReserveRoomRequest {
  type: 'reserve';
  userId: string;
  checkIn: number;
  checkOut: number;
  holdDurationMs?: number;
}

interface ConfirmRoomRequest {
  type: 'confirm';
  allocationId: string;
  bookingId: string;
}

interface ReleaseRoomRequest {
  type: 'release';
  allocationId: string;
}

interface CancelRoomRequest {
  type: 'cancel';
  allocationId: string;
}

interface CheckAvailabilityRequest {
  type: 'check';
  checkIn: number;
  checkOut: number;
}

interface InitRoomRequest {
  type: 'init';
  roomId: string;
  tenantId: string;
  existingAllocations?: Array<{
    id: string;
    bookingId: string | null;
    userId: string;
    checkIn: number;
    checkOut: number;
    status: 'reserved' | 'confirmed' | 'cancelled';
  }>;
}

interface GetStatusRequest {
  type: 'status';
  startDate?: number;
  endDate?: number;
}

type RoomRequest =
  | ReserveRoomRequest
  | ConfirmRoomRequest
  | ReleaseRoomRequest
  | CancelRoomRequest
  | CheckAvailabilityRequest
  | InitRoomRequest
  | GetStatusRequest;

interface RoomResponse {
  success: boolean;
  error?: string;
  data?: {
    available?: boolean;
    allocationId?: string;
    expiresAt?: number;
    allocations?: Array<{
      id: string;
      dateRange: DateRange;
      status: string;
    }>;
  };
}

const DEFAULT_HOLD_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

export class RoomAllocationLock implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, object> = new Map();
  private roomState: RoomState | null = null;
  private cleanupAlarm: boolean = false;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade for real-time updates
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket();
    }

    // HTTP API for room operations
    if (request.method === 'POST') {
      try {
        const body = (await request.json()) as RoomRequest;
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

  private async handleWebSocket(): Promise<Response> {
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

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws);
  }

  private async handleRequest(req: RoomRequest): Promise<RoomResponse> {
    switch (req.type) {
      case 'init':
        return this.handleInit(req);
      case 'reserve':
        return this.handleReserve(req);
      case 'confirm':
        return this.handleConfirm(req);
      case 'release':
        return this.handleRelease(req);
      case 'cancel':
        return this.handleCancel(req);
      case 'check':
        return this.handleCheckAvailability(req);
      case 'status':
        return this.getStatus(req.startDate, req.endDate);
      default:
        return { success: false, error: 'Unknown request type' };
    }
  }

  private async handleInit(req: InitRoomRequest): Promise<RoomResponse> {
    this.roomState = {
      roomId: req.roomId,
      tenantId: req.tenantId,
      allocations: new Map(),
    };

    // Load existing allocations
    if (req.existingAllocations) {
      for (const alloc of req.existingAllocations) {
        if (alloc.status !== 'cancelled') {
          this.roomState.allocations.set(alloc.id, {
            id: alloc.id,
            bookingId: alloc.bookingId,
            userId: alloc.userId,
            dateRange: {
              checkIn: alloc.checkIn,
              checkOut: alloc.checkOut,
            },
            status: alloc.status,
            createdAt: Date.now(),
            expiresAt: alloc.status === 'reserved' ? Date.now() + DEFAULT_HOLD_DURATION_MS : null,
          });
        }
      }
    }

    await this.persistState();

    // Set up cleanup alarm
    if (!this.cleanupAlarm) {
      await this.state.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
      this.cleanupAlarm = true;
    }

    return { success: true };
  }

  private async handleReserve(req: ReserveRoomRequest): Promise<RoomResponse> {
    await this.ensureState();

    if (!this.roomState) {
      return { success: false, error: 'Room not initialized' };
    }

    // Check for conflicts
    if (this.hasConflict(req.checkIn, req.checkOut)) {
      return { success: false, error: 'Room is not available for these dates' };
    }

    // Create reservation
    const allocationId = crypto.randomUUID();
    const holdDuration = req.holdDurationMs || DEFAULT_HOLD_DURATION_MS;
    const expiresAt = Date.now() + holdDuration;

    const allocation: Allocation = {
      id: allocationId,
      bookingId: null,
      userId: req.userId,
      dateRange: {
        checkIn: req.checkIn,
        checkOut: req.checkOut,
      },
      status: 'reserved',
      createdAt: Date.now(),
      expiresAt,
    };

    this.roomState.allocations.set(allocationId, allocation);
    await this.persistState();

    this.broadcastStatus();

    return {
      success: true,
      data: {
        allocationId,
        expiresAt,
      },
    };
  }

  private async handleConfirm(req: ConfirmRoomRequest): Promise<RoomResponse> {
    await this.ensureState();

    if (!this.roomState) {
      return { success: false, error: 'Room not initialized' };
    }

    const allocation = this.roomState.allocations.get(req.allocationId);
    if (!allocation) {
      return { success: false, error: 'Allocation not found' };
    }

    if (allocation.status !== 'reserved') {
      return { success: false, error: 'Allocation is not in reserved status' };
    }

    // Confirm the allocation
    allocation.status = 'confirmed';
    allocation.bookingId = req.bookingId;
    allocation.expiresAt = null;

    await this.persistState();
    this.broadcastStatus();

    return { success: true };
  }

  private async handleRelease(req: ReleaseRoomRequest): Promise<RoomResponse> {
    await this.ensureState();

    if (!this.roomState) {
      return { success: false, error: 'Room not initialized' };
    }

    const allocation = this.roomState.allocations.get(req.allocationId);
    if (!allocation) {
      return { success: true }; // Already released
    }

    if (allocation.status === 'confirmed') {
      return { success: false, error: 'Cannot release a confirmed allocation' };
    }

    this.roomState.allocations.delete(req.allocationId);
    await this.persistState();

    this.broadcastStatus();

    return { success: true };
  }

  private async handleCancel(req: CancelRoomRequest): Promise<RoomResponse> {
    await this.ensureState();

    if (!this.roomState) {
      return { success: false, error: 'Room not initialized' };
    }

    const allocation = this.roomState.allocations.get(req.allocationId);
    if (!allocation) {
      return { success: true }; // Already cancelled
    }

    allocation.status = 'cancelled';
    this.roomState.allocations.delete(req.allocationId);
    await this.persistState();

    this.broadcastStatus();

    return { success: true };
  }

  private async handleCheckAvailability(req: CheckAvailabilityRequest): Promise<RoomResponse> {
    await this.ensureState();

    if (!this.roomState) {
      return { success: false, error: 'Room not initialized' };
    }

    const available = !this.hasConflict(req.checkIn, req.checkOut);

    return {
      success: true,
      data: { available },
    };
  }

  private async getStatus(startDate?: number, endDate?: number): Promise<RoomResponse> {
    await this.ensureState();

    if (!this.roomState) {
      return { success: false, error: 'Room not initialized' };
    }

    let allocations = Array.from(this.roomState.allocations.values());

    // Filter by date range if provided
    if (startDate && endDate) {
      allocations = allocations.filter(
        (a) => a.dateRange.checkIn < endDate && a.dateRange.checkOut > startDate
      );
    }

    return {
      success: true,
      data: {
        allocations: allocations.map((a) => ({
          id: a.id,
          dateRange: a.dateRange,
          status: a.status,
        })),
      },
    };
  }

  private hasConflict(checkIn: number, checkOut: number, excludeId?: string): boolean {
    if (!this.roomState) return false;

    for (const [id, allocation] of this.roomState.allocations) {
      if (excludeId && id === excludeId) continue;
      if (allocation.status === 'cancelled') continue;

      // Check for overlap
      if (checkIn < allocation.dateRange.checkOut && checkOut > allocation.dateRange.checkIn) {
        return true;
      }
    }

    return false;
  }

  private async ensureState(): Promise<void> {
    if (this.roomState) return;

    const stored = await this.state.storage.get<{
      roomId: string;
      tenantId: string;
      allocations: [string, Allocation][];
    }>('roomState');

    if (stored) {
      this.roomState = {
        ...stored,
        allocations: new Map(stored.allocations),
      };
    }
  }

  private async persistState(): Promise<void> {
    if (!this.roomState) return;

    await this.state.storage.put('roomState', {
      ...this.roomState,
      allocations: Array.from(this.roomState.allocations.entries()),
    });
  }

  private broadcastStatus(): void {
    if (!this.roomState) return;

    const allocations = Array.from(this.roomState.allocations.values())
      .filter((a) => a.status !== 'cancelled')
      .map((a) => ({
        id: a.id,
        dateRange: a.dateRange,
        status: a.status,
      }));

    const message = JSON.stringify({
      type: 'status',
      data: { allocations },
    });

    for (const ws of this.sessions.keys()) {
      try {
        ws.send(message);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }

  async alarm(): Promise<void> {
    await this.ensureState();

    if (!this.roomState) return;

    // Clean up expired reservations
    const now = Date.now();
    let changed = false;

    for (const [id, allocation] of this.roomState.allocations) {
      if (allocation.expiresAt && allocation.expiresAt < now) {
        this.roomState.allocations.delete(id);
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
