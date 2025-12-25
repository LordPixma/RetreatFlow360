import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Ticket, ExternalLink, Download } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Skeleton,
} from '@retreatflow360/ui';
import { formatDate, formatCurrency } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface Booking {
  id: string;
  status: string;
  pricingTier: string;
  baseAmount: number;
  currency: string;
  createdAt: string;
  event: {
    id: string;
    title: string;
    slug: string;
    startDate: string;
    endDate: string;
    venue?: {
      name: string;
      city: string;
      country: string;
    };
  };
}

export default function BookingsPage() {
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => {
      const response = await api.get('/api/v1/bookings/me');
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const data = await response.json();
      return data.bookings as Booking[];
    },
  });

  const upcomingBookings = bookings?.filter(
    (b) => new Date(b.event.startDate) > new Date() && b.status === 'confirmed'
  );
  const pastBookings = bookings?.filter(
    (b) => new Date(b.event.endDate) < new Date() || b.status === 'completed'
  );
  const cancelledBookings = bookings?.filter((b) => b.status === 'cancelled');

  const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
    confirmed: 'success',
    pending: 'warning',
    cancelled: 'destructive',
    completed: 'secondary',
  };

  const BookingCard = ({ booking }: { booking: Booking }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Event Info */}
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant={statusColors[booking.status] || 'default'}>
                  {booking.status}
                </Badge>
                <h3 className="mt-2 font-semibold">{booking.event.title}</h3>
              </div>
            </div>

            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {formatDate(booking.event.startDate)} - {formatDate(booking.event.endDate)}
                </span>
              </div>
              {booking.event.venue && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {booking.event.venue.city}, {booking.event.venue.country}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                <span>{booking.pricingTier}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to={`/events/${booking.event.slug}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Event
                </Link>
              </Button>
              {booking.status === 'confirmed' && (
                <Button size="sm" variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download Ticket
                </Button>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="border-t bg-muted/30 p-4 sm:border-l sm:border-t-0">
            <div className="text-center sm:text-right">
              <span className="text-sm text-muted-foreground">Total paid</span>
              <p className="text-xl font-bold">
                {formatCurrency(booking.baseAmount, booking.currency)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-10 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mb-6 text-3xl font-bold">My Bookings</h1>

        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingBookings?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="past">Past ({pastBookings?.length || 0})</TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled ({cancelledBookings?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-6">
            {upcomingBookings?.length ? (
              <div className="space-y-4">
                {upcomingBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Ticket className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No upcoming bookings</h3>
                <p className="mt-2 text-muted-foreground">
                  Find your next retreat experience
                </p>
                <Button asChild className="mt-4">
                  <Link to="/events">Browse Events</Link>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-6">
            {pastBookings?.length ? (
              <div className="space-y-4">
                {pastBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No past bookings</h3>
                <p className="mt-2 text-muted-foreground">
                  Your completed retreats will appear here
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="mt-6">
            {cancelledBookings?.length ? (
              <div className="space-y-4">
                {cancelledBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Ticket className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No cancelled bookings</h3>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
