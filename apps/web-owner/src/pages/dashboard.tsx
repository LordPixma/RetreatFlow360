import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Calendar,
  Users,
  Ticket,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Skeleton,
} from '@retreatflow360/ui';
import { formatCurrency } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
  totalBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalAttendees: number;
  revenueChange: number;
  bookingsChange: number;
}

interface RecentBooking {
  id: string;
  attendeeName: string;
  eventTitle: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  startDate: string;
  bookingsCount: number;
  capacity: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json() as Promise<DashboardStats>;
    },
  });

  const { data: recentBookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['recent-bookings'],
    queryFn: async () => {
      const response = await api.get('/bookings?limit=5&sort=createdAt:desc');
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const data = await response.json();
      return data.bookings as RecentBooking[];
    },
  });

  const { data: upcomingEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: async () => {
      const response = await api.get('/events?status=published&limit=5&sort=startDate:asc');
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      return data.events as UpcomingEvent[];
    },
  });

  const statCards = [
    {
      title: 'Total Revenue',
      value: stats ? formatCurrency(stats.totalRevenue, 'USD') : '$0',
      change: stats?.revenueChange || 0,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Active Events',
      value: stats?.activeEvents || 0,
      subtext: `${stats?.totalEvents || 0} total`,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Total Bookings',
      value: stats?.totalBookings || 0,
      change: stats?.bookingsChange || 0,
      icon: Ticket,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Total Attendees',
      value: stats?.totalAttendees || 0,
      subtext: `${stats?.pendingBookings || 0} pending`,
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your events and bookings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                {statsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                      {stat.change !== undefined && (
                        <div className="mt-1 flex items-center gap-1 text-sm">
                          {stat.change >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={stat.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {Math.abs(stat.change)}%
                          </span>
                          <span className="text-muted-foreground">vs last month</span>
                        </div>
                      )}
                      {stat.subtext && (
                        <p className="mt-1 text-sm text-muted-foreground">{stat.subtext}</p>
                      )}
                    </div>
                    <div className={`rounded-lg p-3 ${stat.bgColor}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Bookings</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/bookings">
                View all <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : recentBookings?.length ? (
              <div className="space-y-4">
                {recentBookings.map((booking) => (
                  <Link
                    key={booking.id}
                    to={`/bookings/${booking.id}`}
                    className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted"
                  >
                    <div>
                      <p className="font-medium">{booking.attendeeName}</p>
                      <p className="text-sm text-muted-foreground">{booking.eventTitle}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(booking.amount, booking.currency)}
                      </p>
                      <p className="text-sm text-muted-foreground">{booking.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No recent bookings
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Events</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/events">
                View all <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : upcomingEvents?.length ? (
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted"
                  >
                    <div>
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {event.bookingsCount}/{event.capacity}
                      </p>
                      <p className="text-sm text-muted-foreground">booked</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No upcoming events
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
