import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Calendar } from 'lucide-react';
import { useForm } from 'react-hook-form';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Textarea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Separator,
  Badge,
} from '@retreatflow360/ui';
import { useToast } from '@retreatflow360/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.get('/api/v1/profiles/me');
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const response = await api.patch('/api/v1/profiles/me', data);
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved.',
      });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: () => {
      toast({
        title: 'Update failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
  } = useForm<ProfileForm>({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: profile?.phone || '',
    },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mb-6 text-3xl font-bold">Profile Settings</h1>

        <Tabs defaultValue="general">
          <TabsList className="mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="dietary">Dietary</TabsTrigger>
            <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your personal details and contact information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleProfileSubmit((data) => updateProfileMutation.mutate(data))}
                  className="space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="firstName"
                          className="pl-10"
                          {...registerProfile('firstName', { required: true })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last name</Label>
                      <Input
                        id="lastName"
                        {...registerProfile('lastName', { required: true })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="pl-10"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Contact support to change your email
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        className="pl-10"
                        placeholder="+1 (555) 000-0000"
                        {...registerProfile('phone')}
                      />
                    </div>
                  </div>

                  <Button type="submit" loading={updateProfileMutation.isPending}>
                    Save changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dietary">
            <Card>
              <CardHeader>
                <CardTitle>Dietary Profile</CardTitle>
                <CardDescription>
                  Your dietary requirements will be shared with event organizers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Allergies</Label>
                  <p className="text-sm text-muted-foreground">
                    Select any food allergies you have
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Nuts', 'Dairy', 'Eggs', 'Shellfish', 'Gluten', 'Soy'].map((item) => (
                      <Badge key={item} variant="outline" className="cursor-pointer">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-base font-medium">Dietary Preferences</Label>
                  <p className="text-sm text-muted-foreground">
                    Select your dietary preferences
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher', 'Gluten-free'].map(
                      (item) => (
                        <Badge key={item} variant="outline" className="cursor-pointer">
                          {item}
                        </Badge>
                      )
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="dietaryNotes">Additional Notes</Label>
                  <Textarea
                    id="dietaryNotes"
                    placeholder="Any other dietary requirements or preferences..."
                  />
                </div>

                <Button>Save Dietary Profile</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accessibility">
            <Card>
              <CardHeader>
                <CardTitle>Accessibility Needs</CardTitle>
                <CardDescription>
                  Help us ensure events are accessible for you
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Mobility</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Wheelchair access', 'Ground floor room', 'Elevator access', 'Minimal stairs'].map(
                      (item) => (
                        <Badge key={item} variant="outline" className="cursor-pointer">
                          {item}
                        </Badge>
                      )
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-base font-medium">Visual</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Large print materials', 'Screen reader compatible', 'Good lighting'].map(
                      (item) => (
                        <Badge key={item} variant="outline" className="cursor-pointer">
                          {item}
                        </Badge>
                      )
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-base font-medium">Auditory</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Sign language interpreter', 'Hearing loop', 'Written materials'].map(
                      (item) => (
                        <Badge key={item} variant="outline" className="cursor-pointer">
                          {item}
                        </Badge>
                      )
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="accessibilityNotes">Additional Notes</Label>
                  <Textarea
                    id="accessibilityNotes"
                    placeholder="Any other accessibility needs..."
                  />
                </div>

                <Button>Save Accessibility Profile</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle>Calendar Sync</CardTitle>
                <CardDescription>
                  Subscribe to your events calendar in your favorite app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-primary" />
                    <div>
                      <h4 className="font-medium">Calendar Subscription</h4>
                      <p className="text-sm text-muted-foreground">
                        Add your booked events to Google Calendar, Apple Calendar, or Outlook
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subscription URL</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value="webcal://api.retreatflow360.com/calendar/feed/..."
                    />
                    <Button variant="outline">Copy</Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline">
                    <img
                      src="https://www.google.com/images/icons/product/calendar-32.png"
                      alt="Google Calendar"
                      className="mr-2 h-4 w-4"
                    />
                    Add to Google Calendar
                  </Button>
                  <Button variant="outline">Add to Apple Calendar</Button>
                  <Button variant="outline">Add to Outlook</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
