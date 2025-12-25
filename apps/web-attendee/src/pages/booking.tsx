import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, MapPin, CreditCard, Check, ChevronLeft, Loader2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Textarea,
  Separator,
} from '@retreatflow360/ui';
import { useToast, formatDate, formatCurrency } from '@retreatflow360/ui';
import { api } from '@/lib/api';

export default function BookingPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState(searchParams.get('tier') || '');
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [accessibilityNotes, setAccessibilityNotes] = useState('');

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/events/${eventId}`);
      if (!response.ok) throw new Error('Event not found');
      const data = await response.json();
      return data.event;
    },
  });

  const bookingMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/v1/bookings', {
        eventId,
        pricingTier: selectedTier,
        dietaryNotes,
        accessibilityNotes,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Booking failed');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Booking confirmed!',
        description: 'Check your email for confirmation details.',
      });
      navigate(`/my-bookings`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Booking failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedTierData = event?.pricingTiers?.find((t: { id: string }) => t.id === selectedTier);

  const steps = [
    { number: 1, title: 'Select Ticket' },
    { number: 2, title: 'Your Details' },
    { number: 3, title: 'Payment' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back
      </button>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((s, index) => (
                <div key={s.number} className="flex items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                      step >= s.number
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground text-muted-foreground'
                    }`}
                  >
                    {step > s.number ? <Check className="h-5 w-5" /> : s.number}
                  </div>
                  <span
                    className={`ml-2 hidden text-sm font-medium sm:block ${
                      step >= s.number ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {s.title}
                  </span>
                  {index < steps.length - 1 && (
                    <div className="mx-4 h-0.5 w-12 bg-muted sm:w-24" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Your Ticket</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {event?.pricingTiers?.map((tier: {
                    id: string;
                    name: string;
                    description?: string;
                    price: number;
                    currency: string;
                  }) => (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedTier(tier.id)}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                        selectedTier === tier.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{tier.name}</h4>
                          {tier.description && (
                            <p className="text-sm text-muted-foreground">{tier.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold">
                            {formatCurrency(tier.price, tier.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    className="w-full"
                    disabled={!selectedTier}
                    onClick={() => setStep(2)}
                  >
                    Continue
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dietary">Dietary Requirements</Label>
                    <Textarea
                      id="dietary"
                      placeholder="Any allergies, intolerances, or dietary preferences..."
                      value={dietaryNotes}
                      onChange={(e) => setDietaryNotes(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accessibility">Accessibility Needs</Label>
                    <Textarea
                      id="accessibility"
                      placeholder="Any accessibility requirements we should know about..."
                      value={accessibilityNotes}
                      onChange={(e) => setAccessibilityNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button className="flex-1" onClick={() => setStep(3)}>
                      Continue to Payment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <CreditCard className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Payment integration with Stripe will process your payment securely.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Ticket ({selectedTierData?.name})</span>
                      <span>
                        {formatCurrency(selectedTierData?.price || 0, selectedTierData?.currency || 'USD')}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>
                        {formatCurrency(selectedTierData?.price || 0, selectedTierData?.currency || 'USD')}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => bookingMutation.mutate()}
                      loading={bookingMutation.isPending}
                    >
                      Complete Booking
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>

        {/* Order Summary */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold">{event?.title}</h4>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {formatDate(event?.startDate)} - {formatDate(event?.endDate)}
                      </span>
                    </div>
                    {event?.venue && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {event.venue.city}, {event.venue.country}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedTierData && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{selectedTierData.name}</span>
                        <span>
                          {formatCurrency(selectedTierData.price, selectedTierData.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>
                          {formatCurrency(selectedTierData.price, selectedTierData.currency)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
