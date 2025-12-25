import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  DollarSign,
  Activity,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Skeleton,
  Badge,
  Progress,
} from '@retreatflow360/ui';
import { formatCurrency } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalEvents: number;
  totalBookings: number;
  totalRevenue: number;
  mrr: number;
  tenantGrowth: number;
  userGrowth: number;
}

interface RecentTenant {
  id: string;
  name: string;
  slug: string;
  tier: string;
  createdAt: string;
  eventsCount: number;
}

interface SystemHealth {
  api: 'healthy' | 'degraded' | 'down';
  database: 'healthy' | 'degraded' | 'down';
  workers: 'healthy' | 'degraded' | 'down';
  queues: 'healthy' | 'degraded' | 'down';
  latencyP50: number;
  latencyP99: number;
  errorRate: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/platform/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json() as Promise<PlatformStats>;
    },
  });

  const { data: recentTenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['recent-tenants'],
    queryFn: async () => {
      const response = await api.get('/admin/tenants?limit=5&sort=createdAt:desc');
      if (!response.ok) throw new Error('Failed to fetch tenants');
      const data = await response.json();
      return data.tenants as RecentTenant[];
    },
  });

  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await api.get('/admin/system/health');
      if (!response.ok) throw new Error('Failed to fetch health');
      return response.json() as Promise<SystemHealth>;
    },
    refetchInterval: 30000,
  });

  const statCards = [
    {
      title: 'Total Tenants',
      value: stats?.totalTenants || 0,
      change: stats?.tenantGrowth || 0,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      href: '/tenants',
    },
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      change: stats?.userGrowth || 0,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      href: '/users',
    },
    {
      title: 'Monthly Revenue (MRR)',
      value: formatCurrency(stats?.mrr || 0, 'USD'),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      href: '/billing',
    },
    {
      title: 'Total Events',
      value: stats?.totalEvents || 0,
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'down':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Dashboard</h1>
        <p className="text-muted-foreground">Overview of the RetreatFlow360 platform</p>
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
            <Card className={stat.href ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}>
              {stat.href ? (
                <Link to={stat.href}>
                  <CardContent className="p-6">
                    <StatCardContent stat={stat} loading={statsLoading} />
                  </CardContent>
                </Link>
              ) : (
                <CardContent className="p-6">
                  <StatCardContent stat={stat} loading={statsLoading} />
                </CardContent>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Tenants */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Tenants</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/tenants">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {tenantsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ) : recentTenants?.length ? (
                <div className="space-y-4">
                  {recentTenants.map((tenant) => (
                    <Link
                      key={tenant.id}
                      to={`/tenants/${tenant.id}`}
                      className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted"
                    >
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {tenant.slug}.retreatflow360.com • {tenant.eventsCount} events
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={tenant.tier === 'enterprise' ? 'default' : 'secondary'}>
                          {tenant.tier}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(tenant.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No tenants yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { name: 'API', status: health?.api || 'healthy' },
                { name: 'Database', status: health?.database || 'healthy' },
                { name: 'Workers', status: health?.workers || 'healthy' },
                { name: 'Queues', status: health?.queues || 'healthy' },
              ].map((service) => (
                <div key={service.name} className="flex items-center justify-between">
                  <span className="text-sm">{service.name}</span>
                  <div className="flex items-center gap-2">
                    {getHealthIcon(service.status)}
                    <span className={`text-sm capitalize ${getHealthColor(service.status)}`}>
                      {service.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Latency (P50)</span>
                  <span className="font-medium">{health?.latencyP50 || 0}ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Latency (P99)</span>
                  <span className="font-medium">{health?.latencyP99 || 0}ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Error Rate</span>
                  <span className={`font-medium ${(health?.errorRate || 0) > 1 ? 'text-red-600' : ''}`}>
                    {health?.errorRate || 0}%
                  </span>
                </div>
              </div>
            </div>

            <Button variant="outline" className="w-full" asChild>
              <Link to="/system">View Details</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCardContent({
  stat,
  loading,
}: {
  stat: {
    title: string;
    value: string | number;
    change?: number;
    icon: typeof Building2;
    color: string;
    bgColor: string;
  };
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{stat.title}</p>
        <p className="mt-1 text-2xl font-bold">{stat.value}</p>
        {stat.change !== undefined && (
          <div className="mt-1 flex items-center gap-1 text-sm">
            {stat.change >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className={stat.change >= 0 ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(stat.change)}%
            </span>
            <span className="text-muted-foreground">this month</span>
          </div>
        )}
      </div>
      <div className={`rounded-lg p-3 ${stat.bgColor}`}>
        <stat.icon className={`h-5 w-5 ${stat.color}`} />
      </div>
    </div>
  );
}
