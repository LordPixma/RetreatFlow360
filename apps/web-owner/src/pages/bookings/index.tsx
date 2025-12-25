import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  Calendar,
  Download,
  Filter,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Badge,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@retreatflow360/ui';
import { formatDate, formatCurrency } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface Booking {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  eventId: string;
  eventTitle: string;
  status: string;
  pricingTier: string;
  baseAmount: number;
  currency: string;
  createdAt: string;
}

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'destructive',
  refunded: 'secondary',
  waitlisted: 'default',
};

export default function BookingsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', statusFilter, eventFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (eventFilter !== 'all') params.set('eventId', eventFilter);
      const response = await api.get(`/bookings?${params}`);
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const data = await response.json();
      return data.bookings as Booking[];
    },
  });

  const { data: events } = useQuery({
    queryKey: ['events-list'],
    queryFn: async () => {
      const response = await api.get('/events');
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      return data.events as Array<{ id: string; title: string }>;
    },
  });

  const filteredBookings = bookings?.filter(
    (booking) =>
      booking.userName.toLowerCase().includes(search.toLowerCase()) ||
      booking.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      booking.eventTitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Manage event registrations and bookings</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="waitlisted">Waitlisted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Event" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events?.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: bookings?.length || 0, color: 'text-foreground' },
          {
            label: 'Confirmed',
            value: bookings?.filter((b) => b.status === 'confirmed').length || 0,
            color: 'text-green-600',
          },
          {
            label: 'Pending',
            value: bookings?.filter((b) => b.status === 'pending').length || 0,
            color: 'text-yellow-600',
          },
          {
            label: 'Revenue',
            value: formatCurrency(
              bookings?.filter((b) => b.status === 'confirmed').reduce((sum, b) => sum + b.baseAmount, 0) || 0,
              'USD'
            ),
            color: 'text-primary',
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredBookings?.length ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredBookings.map((booking, index) => (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Link
                    to={`/bookings/${booking.id}`}
                    className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{booking.userName}</p>
                        <Badge variant={statusColors[booking.status] || 'default'}>
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{booking.userEmail}</p>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{booking.eventTitle}</span>
                        <span>•</span>
                        <span>{booking.pricingTier}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(booking.baseAmount, booking.currency)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(booking.createdAt)}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="py-12 text-center">
          <Filter className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No bookings found</h3>
          <p className="mt-2 text-muted-foreground">
            {search || statusFilter !== 'all' || eventFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Bookings will appear here when attendees register'}
          </p>
        </div>
      )}
    </div>
  );
}
