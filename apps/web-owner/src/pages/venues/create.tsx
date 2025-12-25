import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ChevronLeft, Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';
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

export default function VenueCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [amenities, setAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VenueForm>();

  const createVenueMutation = useMutation({
    mutationFn: async (data: VenueForm) => {
      const response = await api.post('/venues', { ...data, amenities });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create venue');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Venue created',
        description: 'Your venue has been created successfully.',
      });
      navigate('/venues');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create venue',
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
    createVenueMutation.mutate(data);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add Venue</h1>
          <p className="text-muted-foreground">Create a new venue for your events</p>
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
                placeholder="e.g., Mountain Retreat Center"
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
                placeholder="Describe the venue..."
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
                placeholder="e.g., 100"
                {...register('capacity', {
                  required: 'Capacity is required',
                  valueAsNumber: true,
                })}
              />
              {errors.capacity && (
                <p className="text-sm text-destructive">{errors.capacity.message}</p>
              )}
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
                placeholder="123 Retreat Lane"
                {...register('address', { required: 'Address is required' })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  placeholder="Boulder"
                  {...register('city', { required: 'City is required' })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State/Province</Label>
                <Input id="state" placeholder="Colorado" {...register('state')} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Input
                  id="country"
                  placeholder="United States"
                  {...register('country', { required: 'Country is required' })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input id="postalCode" placeholder="80302" {...register('postalCode')} />
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

            {/* Selected custom amenities */}
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
          <Button type="submit" disabled={createVenueMutation.isPending}>
            {createVenueMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Venue'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
