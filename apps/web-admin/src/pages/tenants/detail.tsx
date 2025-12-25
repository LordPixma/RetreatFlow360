import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Building2,
  Users,
  Calendar,
  DollarSign,
  Settings,
  BarChart3,
  Ban,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Separator,
} from '@retreatflow360/ui';
import { formatCurrency, formatDate } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  customDomain?: string;
  contactEmail: string;
  subscriptionTier: string;
  status: string;
  createdAt: string;
  featureFlags: Record<string, boolean>;
  stats: {
    usersCount: number;
    eventsCount: number;
    bookingsCount: number;
    totalRevenue: number;
    monthlyRevenue: number;
    currency: string;
  };
  users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    title: string;
    status: string;
    startDate: string;
    bookingsCount: number;
  }>;
  billingHistory: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
  }>;
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: async () => {
      const response = await api.get(`/admin/tenants/${id}`);
      if (!response.ok) throw new Error('Failed to fetch tenant');
      const data = await response.json();
      return data.tenant as TenantDetail;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!tenant) {
    return <div className="py-12 text-center">Tenant not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/tenants">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{tenant.name}</h1>
              <Badge variant={tenant.status === 'active' ? 'success' : 'destructive'}>
                {tenant.status}
              </Badge>
              <Badge variant="secondary">{tenant.subscriptionTier}</Badge>
            </div>
            <p className="text-muted-foreground">
              {tenant.slug}.retreatflow360.com
              {tenant.customDomain && ` • ${tenant.customDomain}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button variant="outline" className="text-yellow-600">
            <Ban className="mr-2 h-4 w-4" />
            Suspend
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Users', value: tenant.stats.usersCount, icon: Users },
          { label: 'Events', value: tenant.stats.eventsCount, icon: Calendar },
          { label: 'Bookings', value: tenant.stats.bookingsCount, icon: BarChart3 },
          {
            label: 'Total Revenue',
            value: formatCurrency(tenant.stats.totalRevenue, tenant.stats.currency),
            icon: DollarSign,
          },
          {
            label: 'Monthly',
            value: formatCurrency(tenant.stats.monthlyRevenue, tenant.stats.currency),
            icon: DollarSign,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <stat.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users ({tenant.users.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({tenant.events.length})</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tenant Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDate(tenant.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contact Email</p>
                    <p className="font-medium">{tenant.contactEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subdomain</p>
                    <p className="font-medium">{tenant.slug}.retreatflow360.com</p>
                  </div>
                  {tenant.customDomain && (
                    <div>
                      <p className="text-sm text-muted-foreground">Custom Domain</p>
                      <p className="font-medium">{tenant.customDomain}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Current Plan</span>
                  <Badge variant="secondary" className="text-lg">
                    {tenant.subscriptionTier}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span>Monthly Revenue</span>
                  <span className="font-bold">
                    {formatCurrency(tenant.stats.monthlyRevenue, tenant.stats.currency)}
                  </span>
                </div>
                <Button variant="outline" className="w-full">
                  Change Plan
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              {tenant.users.length > 0 ? (
                <div className="space-y-2">
                  {tenant.users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{user.role}</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Joined {formatDate(user.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">No users</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
            </CardHeader>
            <CardContent>
              {tenant.events.length > 0 ? (
                <div className="space-y-2">
                  {tenant.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(event.startDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={event.status === 'published' ? 'success' : 'secondary'}
                        >
                          {event.status}
                        </Badge>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {event.bookingsCount} bookings
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">No events</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
            </CardHeader>
            <CardContent>
              {tenant.billingHistory.length > 0 ? (
                <div className="space-y-2">
                  {tenant.billingHistory.map((bill) => (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {formatCurrency(bill.amount, bill.currency)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(bill.createdAt)}
                        </p>
                      </div>
                      <Badge variant={bill.status === 'paid' ? 'success' : 'warning'}>
                        {bill.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No billing history
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(tenant.featureFlags).map(([flag, enabled]) => (
                  <div key={flag} className="flex items-center justify-between">
                    <span className="font-mono text-sm">{flag}</span>
                    <Badge variant={enabled ? 'success' : 'secondary'}>
                      {enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                ))}
                {Object.keys(tenant.featureFlags).length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    No feature flags configured
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
