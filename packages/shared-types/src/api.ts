/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Auth types
 */
export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  email: string;
  role: string;
  profile: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  tenantMemberships: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    role: string;
  }>;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

/**
 * Event types for API
 */
export interface CreateEventRequest {
  title: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  startDate: number;
  endDate: number;
  timezone?: string;
  maxAttendees?: number;
  venueId?: string;
  visibility?: 'public' | 'private' | 'unlisted';
  pricingTiers?: Array<{
    name: string;
    price: number;
    currency: string;
    description?: string;
    maxQuantity?: number;
  }>;
  customFields?: Array<{
    name: string;
    type: 'text' | 'select' | 'checkbox' | 'number' | 'date';
    required: boolean;
    options?: string[];
  }>;
}

export interface UpdateEventRequest extends Partial<CreateEventRequest> {
  status?: 'draft' | 'published' | 'cancelled';
}

export interface EventListItem {
  id: string;
  title: string;
  slug: string;
  shortDescription?: string;
  startDate: number;
  endDate: number;
  status: string;
  visibility: string;
  maxAttendees?: number;
  currentAttendees: number;
  images: string[];
  venue?: {
    id: string;
    name: string;
    city?: string;
    country?: string;
  };
}

/**
 * Booking types for API
 */
export interface CreateBookingRequest {
  eventId: string;
  pricingTier: string;
  roomId?: string;
  customFieldResponses?: Record<string, string | number | boolean>;
  dietaryNotes?: string;
  accessibilityNotes?: string;
}

export interface BookingDetails {
  id: string;
  eventId: string;
  event: {
    title: string;
    startDate: number;
    endDate: number;
  };
  status: string;
  pricingTier: string;
  baseAmount: number;
  currency: string;
  roomAllocation?: {
    roomName: string;
    checkInDate: number;
    checkOutDate: number;
  };
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: number;
  }>;
  createdAt: number;
}

/**
 * Payment types for API
 */
export interface CreatePaymentRequest {
  bookingId: string;
  provider: 'stripe' | 'paypal' | 'gocardless';
  returnUrl?: string;
}

export interface PaymentIntentResponse {
  clientSecret?: string;
  paymentUrl?: string;
  paymentId: string;
}
