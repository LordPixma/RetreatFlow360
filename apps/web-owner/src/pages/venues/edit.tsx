import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ChevronLeft, Loader2, Save, Plus, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  Badge,
  Skeleton,
} from '@retreatflow360/ui';
import { useToast } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface VenueForm {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  capacity: number;
  description: string;
}

const COMMON_AMENITIES = [
  'WiFi',
  'Parking',
  'Pool',
  'Spa',
  'Gym',
  'Restaurant',
  'Bar',
  'Conference Room',
  'Garden',
  'Meditation Hall',
  'Yoga Studio',
  'Kitchen',
];

export default function VenueEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [amenities, setAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState('');

  const { data: venue, isLoading } = useQuery({
    queryKey: ['venue', id],
    queryFn: async () => {
      const response = await api.get(`/venues/${id}`);
      if (!response.ok) throw new Error('Failed to fetch venue');
      const data = await response.json();
      return data.venue;
    },
  });

  useEffect(() => {
    if (venue?.amenities) {
      setAmenities(venue.amenities);
    }
  }, [venue]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VenueForm>();

  const updateVenueMutation = useMutation({
    mutationFn: async (data: VenueForm) => {
      const response = await api.put(`/venues/${id}`, { ...data, amenities });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update venue');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Venue updated',
        description: 'Your changes have been saved.',
      });
      queryClient.invalidateQueries({ queryKey: ['venue', id] });
      navigate('/venues');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update venue',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleAmenity = (amenity: string) => {
    setAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );
  };

  const addCustomAmenity = () => {
    if (customAmenity.trim() && !amenities.includes(customAmenity.trim())) {
      setAmenities((prev) => [...prev, customAmenity.trim()]);
      setCustomAmenity('');
    }
  };

  const removeAmenity = (amenity: string) => {
    setAmenities((prev) => prev.filter((a) => a !== amenity));
  };

  const onSubmit = (data: VenueForm) => {
    updateVenueMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!venue) {
    return <div className="py-12 text-center">Venue not found</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Venue</h1>
          <p className="text-muted-foreground">{venue.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Venue Name *</Label>
              <Input
                id="name"
                defaultValue={venue.name}
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                defaultValue={venue.description}
                rows={4}
                {...register('description')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Maximum Capacity *</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                defaultValue={venue.capacity}
                {...register('capacity', {
                  required: 'Capacity is required',
                  valueAsNumber: true,
                })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                defaultValue={venue.address}
                {...register('address', { required: 'Address is required' })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  defaultValue={venue.city}
                  {...register('city', { required: 'City is required' })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State/Province</Label>
                <Input id="state" defaultValue={venue.state} {...register('state')} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Input
                  id="country"
                  defaultValue={venue.country}
                  {...register('country', { required: 'Country is required' })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  defaultValue={venue.postalCode}
                  {...register('postalCode')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Amenities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {COMMON_AMENITIES.map((amenity) => (
                <Badge
                  key={amenity}
                  variant={amenities.includes(amenity) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleAmenity(amenity)}
                >
                  {amenity}
                </Badge>
              ))}
            </div>

            {amenities.filter((a) => !COMMON_AMENITIES.includes(a)).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {amenities
                  .filter((a) => !COMMON_AMENITIES.includes(a))
                  .map((amenity) => (
                    <Badge key={amenity} variant="default" className="gap-1">
                      {amenity}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => removeAmenity(amenity)}
                      />
                    </Badge>
                  ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Add custom amenity"
                value={customAmenity}
                onChange={(e) => setCustomAmenity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomAmenity();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addCustomAmenity}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateVenueMutation.isPending}>
            {updateVenueMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
