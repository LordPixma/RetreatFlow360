import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, Search, Filter } from 'lucide-react';
import {
  Card,
  CardContent,
  Input,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@retreatflow360/ui';
import { formatDate, formatCurrency } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  startDate: string;
  endDate: string;
  maxAttendees: number;
  status: string;
  images: string[];
  pricingTiers: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
  }>;
  venue?: {
    id: string;
    name: string;
    city: string;
    country: string;
  };
}

export default function EventsPage() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', search, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('sort', sortBy);

      const response = await api.get(`/api/v1/public/events?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      return data.events as Event[];
    },
  });

  const getLowestPrice = (event: Event) => {
    if (!event.pricingTiers?.length) return null;
    const lowest = event.pricingTiers.reduce((min, tier) =>
      tier.price < min.price ? tier : min
    );
    return { price: lowest.price, currency: lowest.currency };
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Upcoming Retreats</h1>
        <p className="mt-2 text-muted-foreground">
          Discover transformative experiences waiting for you
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search retreats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date (Soonest)</SelectItem>
              <SelectItem value="price-low">Price (Low to High)</SelectItem>
              <SelectItem value="price-high">Price (High to Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video" />
              <CardContent className="p-4">
                <Skeleton className="mb-2 h-6 w-3/4" />
                <Skeleton className="mb-4 h-4 w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : events?.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No retreats found</h3>
          <p className="mt-2 text-muted-foreground">
            Check back soon for new experiences
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events?.map((event, index) => {
            const lowestPrice = getLowestPrice(event);

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Link to={`/events/${event.slug}`}>
                  <Card className="group h-full overflow-hidden transition-shadow hover:shadow-lg">
                    {/* Image */}
                    <div className="relative aspect-video overflow-hidden bg-muted">
                      {event.images?.[0] ? (
                        <img
                          src={event.images[0]}
                          alt={event.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Calendar className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                      )}
                      {lowestPrice && (
                        <Badge className="absolute right-2 top-2">
                          From {formatCurrency(lowestPrice.price, lowestPrice.currency)}
                        </Badge>
                      )}
                    </div>

                    {/* Content */}
                    <CardContent className="p-4">
                      <h3 className="line-clamp-1 text-lg font-semibold group-hover:text-primary">
                        {event.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {event.shortDescription || event.description}
                      </p>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {formatDate(event.startDate)} - {formatDate(event.endDate)}
                          </span>
                        </div>

                        {event.venue && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>
                              {event.venue.city}, {event.venue.country}
                            </span>
                          </div>
                        )}

                        {event.maxAttendees && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{event.maxAttendees} spots available</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
