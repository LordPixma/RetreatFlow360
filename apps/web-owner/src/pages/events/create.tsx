import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ChevronLeft, Loader2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@retreatflow360/ui';
import { useToast } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface EventForm {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  venueId: string;
  capacity: number;
  registrationDeadline: string;
}

interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
}

export default function EventCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const { data: venues } = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      const response = await api.get('/venues');
      if (!response.ok) throw new Error('Failed to fetch venues');
      const data = await response.json();
      return data.venues as Venue[];
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EventForm>();

  const createEventMutation = useMutation({
    mutationFn: async (data: EventForm) => {
      const response = await api.post('/events', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create event');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Event created',
        description: 'Your event has been created successfully.',
      });
      navigate(`/events/${data.event.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create event',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EventForm) => {
    createEventMutation.mutate(data);
  };

  const selectedVenue = venues?.find((v) => v.id === watch('venueId'));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Event</h1>
          <p className="text-muted-foreground">Set up a new retreat event</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s}
            </div>
            {s < 3 && <div className={`mx-2 h-0.5 w-12 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Mindfulness Retreat 2024"
                  {...register('title', { required: 'Title is required' })}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your event..."
                  rows={5}
                  {...register('description')}
                />
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={() => setStep(2)}>
                  Next Step
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Date & Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    {...register('startDate', { required: 'Start date is required' })}
                  />
                  {errors.startDate && (
                    <p className="text-sm text-destructive">{errors.startDate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    {...register('endDate', { required: 'End date is required' })}
                  />
                  {errors.endDate && (
                    <p className="text-sm text-destructive">{errors.endDate.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Venue *</Label>
                <Select onValueChange={(value) => setValue('venueId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues?.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name} - {venue.city}, {venue.country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedVenue && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedVenue.name} in {selectedVenue.city}, {selectedVenue.country}
                  </p>
                )}
              </div>

              <Separator />

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Previous
                </Button>
                <Button type="button" onClick={() => setStep(3)}>
                  Next Step
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Capacity & Registration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Maximum Capacity *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="e.g., 50"
                  {...register('capacity', {
                    required: 'Capacity is required',
                    valueAsNumber: true,
                  })}
                />
                {errors.capacity && (
                  <p className="text-sm text-destructive">{errors.capacity.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="registrationDeadline">Registration Deadline</Label>
                <Input
                  id="registrationDeadline"
                  type="datetime-local"
                  {...register('registrationDeadline')}
                />
                <p className="text-sm text-muted-foreground">
                  Leave blank to allow registration until the event starts
                </p>
              </div>

              <Separator />

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  Previous
                </Button>
                <Button type="submit" disabled={createEventMutation.isPending}>
                  {createEventMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Event'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
