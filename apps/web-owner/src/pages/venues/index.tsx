import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  MapPin,
  Building,
  Users,
  MoreVertical,
  Edit,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Skeleton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  capacity: number;
  roomCount: number;
  amenities: string[];
}

export default function VenuesPage() {
  const [search, setSearch] = useState('');

  const { data: venues, isLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      const response = await api.get('/venues');
      if (!response.ok) throw new Error('Failed to fetch venues');
      const data = await response.json();
      return data.venues as Venue[];
    },
  });

  const filteredVenues = venues?.filter((venue) =>
    venue.name.toLowerCase().includes(search.toLowerCase()) ||
    venue.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Venues</h1>
          <p className="text-muted-foreground">Manage your event venues and rooms</p>
        </div>
        <Button asChild>
          <Link to="/venues/create">
            <Plus className="mr-2 h-4 w-4" />
            Add Venue
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search venues..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Venues Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-4 h-32 w-full rounded-lg" />
                <Skeleton className="mb-2 h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredVenues?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVenues.map((venue, index) => (
            <motion.div
              key={venue.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Venue Image Placeholder */}
                  <div className="relative h-32 bg-gradient-to-br from-secondary/50 to-secondary/20">
                    <div className="absolute right-2 top-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/venues/${venue.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Venue
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Venue
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-background/90 px-2 py-1 text-xs">
                      <Building className="h-3 w-3" />
                      {venue.roomCount} rooms
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold">{venue.name}</h3>

                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {venue.city}, {venue.country}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>Capacity: {venue.capacity}</span>
                      </div>
                    </div>

                    {venue.amenities.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {venue.amenities.slice(0, 3).map((amenity) => (
                          <span
                            key={amenity}
                            className="rounded bg-muted px-2 py-0.5 text-xs"
                          >
                            {amenity}
                          </span>
                        ))}
                        {venue.amenities.length > 3 && (
                          <span className="rounded bg-muted px-2 py-0.5 text-xs">
                            +{venue.amenities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <Building className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No venues found</h3>
          <p className="mt-2 text-muted-foreground">
            {search ? 'Try adjusting your search' : 'Add your first venue to get started'}
          </p>
          {!search && (
            <Button asChild className="mt-4">
              <Link to="/venues/create">
                <Plus className="mr-2 h-4 w-4" />
                Add Venue
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
