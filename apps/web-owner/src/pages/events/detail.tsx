import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Edit,
  MoreVertical,
  Share2,
  Copy,
  Ticket,
  DollarSign,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Progress,
} from '@retreatflow360/ui';
import { formatDate, formatCurrency } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface EventDetails {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  capacity: number;
  registrationDeadline?: string;
  venue?: {
    name: string;
    address: string;
    city: string;
    country: string;
  };
  pricingTiers: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
  }>;
  sessions: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  }>;
  bookings: Array<{
    id: string;
    userName: string;
    userEmail: string;
    status: string;
    pricingTier: string;
    createdAt: string;
  }>;
  stats: {
    totalBookings: number;
    confirmedBookings: number;
    revenue: number;
    currency: string;
  };
}

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  draft: 'secondary',
  published: 'success',
  cancelled: 'destructive',
  completed: 'default',
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const response = await api.get(`/events/${id}`);
      if (!response.ok) throw new Error('Failed to fetch event');
      const data = await response.json();
      return data.event as EventDetails;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!event) {
    return <div className="py-12 text-center">Event not found</div>;
  }

  const capacityPercent = (event.stats.totalBookings / event.capacity) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{event.title}</h1>
            <Badge variant={statusColors[event.status]}>{event.status}</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            {formatDate(event.startDate)} - {formatDate(event.endDate)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/events/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Event
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Share2 className="mr-2 h-4 w-4" />
                Share Event
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate Event
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Ticket className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bookings</p>
                <p className="text-2xl font-bold">{event.stats.totalBookings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Confirmed</p>
                <p className="text-2xl font-bold">{event.stats.confirmedBookings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(event.stats.revenue, event.stats.currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Capacity</p>
                <p className="text-sm font-medium">
                  {event.stats.totalBookings}/{event.capacity}
                </p>
              </div>
              <Progress value={capacityPercent} className="mt-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bookings">Bookings ({event.bookings.length})</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{event.description || 'No description provided.'}</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Event Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Dates</p>
                      <p className="font-medium">
                        {formatDate(event.startDate)} - {formatDate(event.endDate)}
                      </p>
                    </div>
                  </div>

                  {event.venue && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Venue</p>
                        <p className="font-medium">{event.venue.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.venue.city}, {event.venue.country}
                        </p>
                      </div>
                    </div>
                  )}

                  {event.registrationDeadline && (
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Registration Deadline</p>
                        <p className="font-medium">{formatDate(event.registrationDeadline)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bookings" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Bookings</CardTitle>
              <Button variant="outline" size="sm">Export</Button>
            </CardHeader>
            <CardContent>
              {event.bookings.length > 0 ? (
                <div className="space-y-2">
                  {event.bookings.map((booking) => (
                    <Link
                      key={booking.id}
                      to={`/bookings/${booking.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
                    >
                      <div>
                        <p className="font-medium">{booking.userName}</p>
                        <p className="text-sm text-muted-foreground">{booking.userEmail}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={booking.status === 'confirmed' ? 'success' : 'secondary'}>
                          {booking.status}
                        </Badge>
                        <p className="mt-1 text-sm text-muted-foreground">{booking.pricingTier}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No bookings yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Event Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {event.sessions.length > 0 ? (
                <div className="space-y-4">
                  {event.sessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-4 rounded-lg border p-3">
                      <div className="text-center">
                        <p className="text-sm font-medium">
                          {new Date(session.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.endTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{session.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No sessions scheduled yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              {event.pricingTiers.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {event.pricingTiers.map((tier) => (
                    <div key={tier.id} className="rounded-lg border p-4">
                      <h4 className="font-semibold">{tier.name}</h4>
                      <p className="mt-2 text-2xl font-bold">
                        {formatCurrency(tier.price, tier.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No pricing tiers configured
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
