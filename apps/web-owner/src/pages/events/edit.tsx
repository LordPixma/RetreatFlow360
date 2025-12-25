import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ChevronLeft, Loader2, Save } from 'lucide-react';
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
  Skeleton,
} from '@retreatflow360/ui';
import { useToast } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface EventForm {
  title: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  venueId: string;
  capacity: number;
  registrationDeadline?: string;
}

interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
}

export default function EventEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const response = await api.get(`/events/${id}`);
      if (!response.ok) throw new Error('Failed to fetch event');
      const data = await response.json();
      return data.event;
    },
  });

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
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<EventForm>({
    defaultValues: event
      ? {
          title: event.title,
          description: event.description,
          status: event.status,
          startDate: event.startDate?.slice(0, 16),
          endDate: event.endDate?.slice(0, 16),
          venueId: event.venueId,
          capacity: event.capacity,
          registrationDeadline: event.registrationDeadline?.slice(0, 16),
        }
      : undefined,
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: EventForm) => {
      const response = await api.put(`/events/${id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update event');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Event updated',
        description: 'Your changes have been saved.',
      });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      navigate(`/events/${id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update event',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EventForm) => {
    updateEventMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!event) {
    return <div className="py-12 text-center">Event not found</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Event</h1>
          <p className="text-muted-foreground">{event.title}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                defaultValue={event.title}
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
                rows={5}
                defaultValue={event.description}
                {...register('description')}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                defaultValue={event.status}
                onValueChange={(value) => setValue('status', value, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
                  defaultValue={event.startDate?.slice(0, 16)}
                  {...register('startDate', { required: 'Start date is required' })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  defaultValue={event.endDate?.slice(0, 16)}
                  {...register('endDate', { required: 'End date is required' })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Venue</Label>
              <Select
                defaultValue={event.venueId}
                onValueChange={(value) => setValue('venueId', value, { shouldDirty: true })}
              >
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
            </div>
          </CardContent>
        </Card>

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
                defaultValue={event.capacity}
                {...register('capacity', {
                  required: 'Capacity is required',
                  valueAsNumber: true,
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="registrationDeadline">Registration Deadline</Label>
              <Input
                id="registrationDeadline"
                type="datetime-local"
                defaultValue={event.registrationDeadline?.slice(0, 16)}
                {...register('registrationDeadline')}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isDirty || updateEventMutation.isPending}>
            {updateEventMutation.isPending ? (
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
