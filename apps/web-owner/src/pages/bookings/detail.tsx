import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Mail,
  Phone,
  Calendar,
  Ticket,
  DollarSign,
  User,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Separator,
} from '@retreatflow360/ui';
import { formatDate, formatCurrency, useToast } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface BookingDetail {
  id: string;
  status: string;
  pricingTier: string;
  baseAmount: number;
  currency: string;
  dietaryNotes?: string;
  accessibilityNotes?: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  event: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    venue?: {
      name: string;
      city: string;
    };
  };
  payment?: {
    id: string;
    status: string;
    provider: string;
    providerRef: string;
    createdAt: string;
  };
}

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'destructive',
  refunded: 'secondary',
  waitlisted: 'default',
};

const statusIcons: Record<string, typeof CheckCircle> = {
  pending: AlertCircle,
  confirmed: CheckCircle,
  cancelled: XCircle,
  refunded: RefreshCw,
  waitlisted: AlertCircle,
};

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: async () => {
      const response = await api.get(`/bookings/${id}`);
      if (!response.ok) throw new Error('Failed to fetch booking');
      const data = await response.json();
      return data.booking as BookingDetail;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await api.patch(`/bookings/${id}/status`, { status });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update status');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Status updated',
        description: 'The booking status has been updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!booking) {
    return <div className="py-12 text-center">Booking not found</div>;
  }

  const StatusIcon = statusIcons[booking.status] || AlertCircle;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Booking Details</h1>
            <Badge variant={statusColors[booking.status]}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {booking.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">ID: {booking.id}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Attendee Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Attendee Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">
                    {booking.user.firstName} {booking.user.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a
                    href={`mailto:${booking.user.email}`}
                    className="flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {booking.user.email}
                  </a>
                </div>
                {booking.user.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <a
                      href={`tel:${booking.user.phone}`}
                      className="flex items-center gap-1 font-medium"
                    >
                      <Phone className="h-4 w-4" />
                      {booking.user.phone}
                    </a>
                  </div>
                )}
              </div>

              {(booking.dietaryNotes || booking.accessibilityNotes) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    {booking.dietaryNotes && (
                      <div>
                        <p className="text-sm font-medium">Dietary Requirements</p>
                        <p className="text-sm text-muted-foreground">{booking.dietaryNotes}</p>
                      </div>
                    )}
                    {booking.accessibilityNotes && (
                      <div>
                        <p className="text-sm font-medium">Accessibility Needs</p>
                        <p className="text-sm text-muted-foreground">{booking.accessibilityNotes}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Event Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Event Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Event</p>
                <p className="font-medium">{booking.event.title}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Dates</p>
                  <p className="font-medium">
                    {formatDate(booking.event.startDate)} - {formatDate(booking.event.endDate)}
                  </p>
                </div>
                {booking.event.venue && (
                  <div>
                    <p className="text-sm text-muted-foreground">Venue</p>
                    <p className="font-medium">
                      {booking.event.venue.name}, {booking.event.venue.city}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          {booking.payment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={booking.payment.status === 'completed' ? 'success' : 'warning'}>
                      {booking.payment.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Provider</p>
                    <p className="font-medium capitalize">{booking.payment.provider}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reference</p>
                    <p className="font-mono text-sm">{booking.payment.providerRef}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{formatDate(booking.payment.createdAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ticket Type</span>
                <span className="font-medium">{booking.pricingTier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Booked On</span>
                <span className="font-medium">{formatDate(booking.createdAt)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(booking.baseAmount, booking.currency)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {booking.status === 'pending' && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => updateStatusMutation.mutate('confirmed')}
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm Booking
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => updateStatusMutation.mutate('cancelled')}
                    disabled={updateStatusMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Booking
                  </Button>
                </>
              )}
              {booking.status === 'confirmed' && (
                <>
                  <Button variant="outline" className="w-full">
                    <Mail className="mr-2 h-4 w-4" />
                    Send Confirmation Email
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => updateStatusMutation.mutate('cancelled')}
                    disabled={updateStatusMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Booking
                  </Button>
                </>
              )}
              {booking.status === 'cancelled' && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => updateStatusMutation.mutate('refunded')}
                  disabled={updateStatusMutation.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Process Refund
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
