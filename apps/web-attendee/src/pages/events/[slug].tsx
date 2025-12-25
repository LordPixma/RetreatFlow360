import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  ChevronLeft,
  Share2,
  Heart,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Separator,
  Skeleton,
} from '@retreatflow360/ui';
import { formatDate, formatDateTime, formatCurrency } from '@retreatflow360/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';

interface EventDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  startDate: string;
  endDate: string;
  timezone: string;
  maxAttendees: number;
  status: string;
  images: string[];
  pricingTiers: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
    description?: string;
  }>;
  customFields: Array<{
    id: string;
    name: string;
    type: string;
    required: boolean;
  }>;
  venue?: {
    id: string;
    name: string;
    description?: string;
    address?: string;
    city?: string;
    country?: string;
    amenities?: string[];
  };
  sessions?: Array<{
    id: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    sessionType?: string;
  }>;
}

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', slug],
    queryFn: async () => {
      const response = await api.get(`/api/v1/public/events/${slug}`);
      if (!response.ok) {
        throw new Error('Event not found');
      }
      const data = await response.json();
      return data.event as EventDetail;
    },
  });

  const handleBook = (tierId: string) => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: `/booking/${event?.id}?tier=${tierId}` } });
      return;
    }
    navigate(`/booking/${event?.id}?tier=${tierId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="mb-8 aspect-[21/9] rounded-xl" />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="mb-4 h-10 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div>
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Event not found</h1>
        <p className="mt-2 text-muted-foreground">
          The event you're looking for doesn't exist or has been removed.
        </p>
        <Button asChild className="mt-6">
          <Link to="/events">Browse Events</Link>
        </Button>
      </div>
    );
  }

  const lowestPrice = event.pricingTiers?.reduce(
    (min, tier) => (tier.price < min.price ? tier : min),
    event.pricingTiers[0]
  );

  return (
    <div className="min-h-screen">
      {/* Back Navigation */}
      <div className="container mx-auto px-4 py-6">
        <Link
          to="/events"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Events
        </Link>
      </div>

      {/* Hero Image */}
      <div className="relative h-64 bg-muted md:h-96">
        {event.images?.[0] ? (
          <img
            src={event.images[0]}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Calendar className="h-24 w-24 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Title */}
              <div className="mb-6">
                <Badge className="mb-2">{event.status}</Badge>
                <h1 className="text-3xl font-bold md:text-4xl">{event.title}</h1>
                {event.shortDescription && (
                  <p className="mt-2 text-lg text-muted-foreground">
                    {event.shortDescription}
                  </p>
                )}
              </div>

              {/* Quick Info */}
              <div className="mb-8 flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span>
                    {formatDate(event.startDate)} - {formatDate(event.endDate)}
                  </span>
                </div>
                {event.venue && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <span>
                      {event.venue.city}, {event.venue.country}
                    </span>
                  </div>
                )}
                {event.maxAttendees && (
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span>{event.maxAttendees} spots</span>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <Tabs defaultValue="about">
                <TabsList>
                  <TabsTrigger value="about">About</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  <TabsTrigger value="venue">Venue</TabsTrigger>
                </TabsList>

                <TabsContent value="about" className="mt-6">
                  <div className="prose prose-gray max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap">{event.description}</p>
                  </div>
                </TabsContent>

                <TabsContent value="schedule" className="mt-6">
                  {event.sessions?.length ? (
                    <div className="space-y-4">
                      {event.sessions.map((session) => (
                        <Card key={session.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold">{session.title}</h4>
                                {session.description && (
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {session.description}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline">{session.sessionType}</Badge>
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              {formatDateTime(session.startTime)} -{' '}
                              {formatDateTime(session.endTime)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      Schedule details will be available soon.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="venue" className="mt-6">
                  {event.venue ? (
                    <div>
                      <h3 className="text-xl font-semibold">{event.venue.name}</h3>
                      {event.venue.address && (
                        <p className="mt-2 text-muted-foreground">
                          {event.venue.address}, {event.venue.city}, {event.venue.country}
                        </p>
                      )}
                      {event.venue.description && (
                        <p className="mt-4">{event.venue.description}</p>
                      )}
                      {event.venue.amenities?.length ? (
                        <div className="mt-6">
                          <h4 className="font-medium">Amenities</h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {event.venue.amenities.map((amenity) => (
                              <Badge key={amenity} variant="secondary">
                                {amenity}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      Venue details will be announced soon.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>

          {/* Sidebar - Booking Card */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Book Your Spot</CardTitle>
              </CardHeader>
              <CardContent>
                {lowestPrice && (
                  <div className="mb-4">
                    <span className="text-sm text-muted-foreground">Starting from</span>
                    <p className="text-3xl font-bold">
                      {formatCurrency(lowestPrice.price, lowestPrice.currency)}
                    </p>
                  </div>
                )}

                <Separator className="my-4" />

                {/* Pricing Tiers */}
                <div className="space-y-3">
                  {event.pricingTiers?.map((tier) => (
                    <div
                      key={tier.id}
                      className="rounded-lg border p-4 transition-colors hover:border-primary"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{tier.name}</h4>
                          {tier.description && (
                            <p className="text-sm text-muted-foreground">
                              {tier.description}
                            </p>
                          )}
                        </div>
                        <span className="font-semibold">
                          {formatCurrency(tier.price, tier.currency)}
                        </span>
                      </div>
                      <Button
                        className="mt-3 w-full"
                        onClick={() => handleBook(tier.id)}
                      >
                        Select
                      </Button>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Share & Save */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Heart className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
