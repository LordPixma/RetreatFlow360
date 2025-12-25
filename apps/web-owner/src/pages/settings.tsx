import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Building,
  Mail,
  CreditCard,
  Key,
  Palette,
  Bell,
  Loader2,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
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
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Separator,
  Badge,
  Skeleton,
} from '@retreatflow360/ui';
import { useToast } from '@retreatflow360/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';

interface TenantSettings {
  name: string;
  slug: string;
  customDomain?: string;
  contactEmail: string;
  logoUrl?: string;
  primaryColor?: string;
  timezone: string;
  currency: string;
}

interface NotificationSettings {
  emailBookingConfirmation: boolean;
  emailBookingReminder: boolean;
  emailPaymentReceived: boolean;
  emailNewBooking: boolean;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNewKey, setShowNewKey] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => {
      const response = await api.get('/admin/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json() as Promise<TenantSettings>;
    },
  });

  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const response = await api.get('/admin/settings/notifications');
      if (!response.ok) throw new Error('Failed to fetch notification settings');
      return response.json() as Promise<NotificationSettings>;
    },
  });

  const { data: apiKeys, isLoading: apiKeysLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await api.get('/api-keys');
      if (!response.ok) throw new Error('Failed to fetch API keys');
      const data = await response.json();
      return data.apiKeys as ApiKey[];
    },
  });

  const {
    register,
    handleSubmit,
    formState: { isDirty },
  } = useForm<TenantSettings>();

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<TenantSettings>) => {
      const response = await api.patch('/admin/settings', data);
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Settings saved', description: 'Your changes have been saved.' });
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: Partial<NotificationSettings>) => {
      const response = await api.patch('/admin/settings/notifications', data);
      if (!response.ok) throw new Error('Failed to update notification settings');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Notifications updated', description: 'Your preferences have been saved.' });
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });

  const createApiKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post('/api-keys', { name });
      if (!response.ok) throw new Error('Failed to create API key');
      return response.json();
    },
    onSuccess: (data) => {
      setShowNewKey(data.key);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api-keys/${id}`);
      if (!response.ok) throw new Error('Failed to delete API key');
    },
    onSuccess: () => {
      toast({ title: 'API key deleted' });
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const onSubmit = (data: TenantSettings) => {
    updateSettingsMutation.mutate(data);
  };

  const handleNotificationToggle = (key: keyof NotificationSettings, value: boolean) => {
    updateNotificationsMutation.mutate({ [key]: value });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your organization settings</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            <Building className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="api">
            <Key className="mr-2 h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="branding">
            <Palette className="mr-2 h-4 w-4" />
            Branding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          {settingsLoading ? (
            <Card>
              <CardContent className="space-y-4 p-6">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              <Card>
                <CardHeader>
                  <CardTitle>Organization Details</CardTitle>
                  <CardDescription>
                    Basic information about your organization
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Organization Name</Label>
                      <Input
                        id="name"
                        defaultValue={settings?.name}
                        {...register('name')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Contact Email</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        defaultValue={settings?.contactEmail}
                        {...register('contactEmail')}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="slug">Subdomain</Label>
                      <div className="flex">
                        <Input
                          id="slug"
                          defaultValue={settings?.slug}
                          className="rounded-r-none"
                          {...register('slug')}
                        />
                        <span className="inline-flex items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm text-muted-foreground">
                          .retreatflow360.com
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customDomain">Custom Domain (optional)</Label>
                      <Input
                        id="customDomain"
                        placeholder="events.yourcompany.com"
                        defaultValue={settings?.customDomain}
                        {...register('customDomain')}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Input
                        id="timezone"
                        defaultValue={settings?.timezone || 'UTC'}
                        {...register('timezone')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Default Currency</Label>
                      <Input
                        id="currency"
                        defaultValue={settings?.currency || 'USD'}
                        {...register('currency')}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={!isDirty || updateSettingsMutation.isPending}
                    >
                      {updateSettingsMutation.isPending ? (
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
                </CardContent>
              </Card>
            </form>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Choose which emails you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {notificationsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Booking Confirmations</p>
                      <p className="text-sm text-muted-foreground">
                        Send confirmation emails to attendees
                      </p>
                    </div>
                    <Switch
                      checked={notifications?.emailBookingConfirmation}
                      onCheckedChange={(checked) =>
                        handleNotificationToggle('emailBookingConfirmation', checked)
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Booking Reminders</p>
                      <p className="text-sm text-muted-foreground">
                        Send reminder emails before events
                      </p>
                    </div>
                    <Switch
                      checked={notifications?.emailBookingReminder}
                      onCheckedChange={(checked) =>
                        handleNotificationToggle('emailBookingReminder', checked)
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Payment Received</p>
                      <p className="text-sm text-muted-foreground">
                        Send receipts when payments are received
                      </p>
                    </div>
                    <Switch
                      checked={notifications?.emailPaymentReceived}
                      onCheckedChange={(checked) =>
                        handleNotificationToggle('emailPaymentReceived', checked)
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">New Booking Alerts</p>
                      <p className="text-sm text-muted-foreground">
                        Get notified when someone books an event
                      </p>
                    </div>
                    <Switch
                      checked={notifications?.emailNewBooking}
                      onCheckedChange={(checked) =>
                        handleNotificationToggle('emailNewBooking', checked)
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage API keys for external integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showNewKey && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="mb-2 font-medium text-green-800">
                    New API Key Created
                  </p>
                  <p className="mb-3 text-sm text-green-700">
                    Copy this key now. You won't be able to see it again.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-green-100 px-3 py-2 font-mono text-sm">
                      {showNewKey}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(showNewKey)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowNewKey(null)}
                  >
                    Done
                  </Button>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    const name = prompt('Enter a name for this API key:');
                    if (name) createApiKeyMutation.mutate(name);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create API Key
                </Button>
              </div>

              {apiKeysLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : apiKeys?.length ? (
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{key.name}</p>
                        <p className="font-mono text-sm text-muted-foreground">
                          {key.prefix}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(key.createdAt).toLocaleDateString()}
                          {key.lastUsedAt &&
                            ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteApiKeyMutation.mutate(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No API keys created yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Customize the look and feel of your event pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted">
                    {settings?.logoUrl ? (
                      <img
                        src={settings.logoUrl}
                        alt="Logo"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Building className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <Button variant="outline">Upload Logo</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    className="h-10 w-20 cursor-pointer p-1"
                    defaultValue={settings?.primaryColor || '#6366f1'}
                  />
                  <Input
                    placeholder="#6366f1"
                    defaultValue={settings?.primaryColor || '#6366f1'}
                    className="w-32"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button>Save Branding</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
