import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  Calendar,
  DollarSign,
  Download,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@retreatflow360/ui';
import { formatCurrency } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface PlatformAnalytics {
  overview: {
    totalTenants: number;
    totalUsers: number;
    totalEvents: number;
    totalBookings: number;
    totalRevenue: number;
    mrr: number;
    tenantGrowth: number;
    userGrowth: number;
    eventGrowth: number;
    revenueGrowth: number;
  };
  topTenants: Array<{
    id: string;
    name: string;
    revenue: number;
    bookings: number;
    users: number;
  }>;
  tenantsByTier: Record<string, number>;
  monthlyTrends: Array<{
    month: string;
    tenants: number;
    users: number;
    revenue: number;
    bookings: number;
  }>;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['platform-analytics', period],
    queryFn: async () => {
      const response = await api.get(`/admin/analytics?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json() as Promise<PlatformAnalytics>;
    },
  });

  const statCards = [
    {
      title: 'Total Tenants',
      value: analytics?.overview.totalTenants || 0,
      change: analytics?.overview.tenantGrowth || 0,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Total Users',
      value: analytics?.overview.totalUsers || 0,
      change: analytics?.overview.userGrowth || 0,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Total Events',
      value: analytics?.overview.totalEvents || 0,
      change: analytics?.overview.eventGrowth || 0,
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(analytics?.overview.totalRevenue || 0, 'USD'),
      change: analytics?.overview.revenueGrowth || 0,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Platform-wide metrics and insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                      <div className="mt-1 flex items-center gap-1 text-sm">
                        {stat.change >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className={stat.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {Math.abs(stat.change)}%
                        </span>
                        <span className="text-muted-foreground">vs previous</span>
                      </div>
                    </div>
                    <div className={`rounded-lg p-3 ${stat.bgColor}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="tenants">
        <TabsList>
          <TabsTrigger value="tenants">Top Tenants</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Tenants</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : analytics?.topTenants?.length ? (
                <div className="space-y-4">
                  {analytics.topTenants.map((tenant, index) => {
                    const maxRevenue = Math.max(...analytics.topTenants.map((t) => t.revenue));
                    const percentage = (tenant.revenue / maxRevenue) * 100;

                    return (
                      <div key={tenant.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {index + 1}
                            </span>
                            <span className="font-medium">{tenant.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatCurrency(tenant.revenue, 'USD')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tenant.bookings} bookings • {tenant.users} users
                            </p>
                          </div>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No tenant data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tenants by Subscription Tier</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : analytics?.tenantsByTier ? (
                  <div className="space-y-4">
                    {Object.entries(analytics.tenantsByTier).map(([tier, count]) => {
                      const total = Object.values(analytics.tenantsByTier).reduce(
                        (sum, c) => sum + c,
                        0
                      );
                      const percentage = (count / total) * 100;

                      return (
                        <div key={tier} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium capitalize">{tier}</span>
                            <span className="text-muted-foreground">
                              {count} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No distribution data
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Chart visualization would go here
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : analytics?.monthlyTrends?.length ? (
                <div className="space-y-4">
                  {analytics.monthlyTrends.map((month) => (
                    <div key={month.month} className="grid grid-cols-5 gap-4 border-b pb-4">
                      <div className="font-medium">{month.month}</div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Tenants</p>
                        <p className="font-medium">{month.tenants}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Users</p>
                        <p className="font-medium">{month.users}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Bookings</p>
                        <p className="font-medium">{month.bookings}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Revenue</p>
                        <p className="font-medium">{formatCurrency(month.revenue, 'USD')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">No trend data</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
