import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Activity,
  Database,
  Server,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Settings,
  Key,
  Shield,
  Globe,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Skeleton,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Switch,
  Input,
  Label,
  Separator,
} from '@retreatflow360/ui';
import { useToast } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface SystemHealth {
  api: 'healthy' | 'degraded' | 'down';
  database: 'healthy' | 'degraded' | 'down';
  workers: 'healthy' | 'degraded' | 'down';
  queues: 'healthy' | 'degraded' | 'down';
  kv: 'healthy' | 'degraded' | 'down';
  r2: 'healthy' | 'degraded' | 'down';
}

interface SystemMetrics {
  latencyP50: number;
  latencyP99: number;
  errorRate: number;
  requestsPerSecond: number;
  activeConnections: number;
  queueDepth: number;
  cacheHitRate: number;
}

interface FeatureFlags {
  [key: string]: boolean;
}

export default function SystemPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await api.get('/admin/system/health');
      if (!response.ok) throw new Error('Failed to fetch health');
      return response.json() as Promise<SystemHealth>;
    },
    refetchInterval: 10000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: async () => {
      const response = await api.get('/admin/system/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json() as Promise<SystemMetrics>;
    },
    refetchInterval: 5000,
  });

  const { data: featureFlags, isLoading: flagsLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const response = await api.get('/admin/system/feature-flags');
      if (!response.ok) throw new Error('Failed to fetch feature flags');
      const data = await response.json();
      return data.flags as FeatureFlags;
    },
  });

  const updateFlagMutation = useMutation({
    mutationFn: async ({ flag, enabled }: { flag: string; enabled: boolean }) => {
      const response = await api.patch('/admin/system/feature-flags', { [flag]: enabled });
      if (!response.ok) throw new Error('Failed to update flag');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Feature flag updated' });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update flag', description: error.message, variant: 'destructive' });
    },
  });

  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/admin/system/cache/clear');
      if (!response.ok) throw new Error('Failed to clear cache');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Cache cleared successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to clear cache', description: error.message, variant: 'destructive' });
    },
  });

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
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'down':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const services = [
    { name: 'API Gateway', key: 'api' as const, icon: Globe },
    { name: 'Database (D1)', key: 'database' as const, icon: Database },
    { name: 'Workers', key: 'workers' as const, icon: Zap },
    { name: 'Queues', key: 'queues' as const, icon: Server },
    { name: 'KV Store', key: 'kv' as const, icon: Key },
    { name: 'R2 Storage', key: 'r2' as const, icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System</h1>
        <p className="text-muted-foreground">Platform health, metrics, and configuration</p>
      </div>

      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health">
            <Activity className="mr-2 h-4 w-4" />
            Health
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <Server className="mr-2 h-4 w-4" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="features">
            <Settings className="mr-2 h-4 w-4" />
            Feature Flags
          </TabsTrigger>
          <TabsTrigger value="cache">
            <RefreshCw className="mr-2 h-4 w-4" />
            Cache
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Card key={service.key}>
                <CardContent className="p-6">
                  {healthLoading ? (
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-muted p-2">
                          <service.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className={`text-sm capitalize ${getHealthColor(health?.[service.key] || 'healthy')}`}>
                            {health?.[service.key] || 'healthy'}
                          </p>
                        </div>
                      </div>
                      {getHealthIcon(health?.[service.key] || 'healthy')}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Latency (P50)', value: `${metrics?.latencyP50 || 0}ms`, good: (metrics?.latencyP50 || 0) < 100 },
              { label: 'Latency (P99)', value: `${metrics?.latencyP99 || 0}ms`, good: (metrics?.latencyP99 || 0) < 500 },
              { label: 'Error Rate', value: `${metrics?.errorRate || 0}%`, good: (metrics?.errorRate || 0) < 1 },
              { label: 'Requests/sec', value: metrics?.requestsPerSecond || 0, good: true },
              { label: 'Active Connections', value: metrics?.activeConnections || 0, good: true },
              { label: 'Queue Depth', value: metrics?.queueDepth || 0, good: (metrics?.queueDepth || 0) < 100 },
              { label: 'Cache Hit Rate', value: `${metrics?.cacheHitRate || 0}%`, good: (metrics?.cacheHitRate || 0) > 80 },
            ].map((metric) => (
              <Card key={metric.label}>
                <CardContent className="p-4">
                  {metricsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">{metric.label}</p>
                      <p className={`text-2xl font-bold ${metric.good ? '' : 'text-red-600'}`}>
                        {metric.value}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Global Feature Flags</CardTitle>
              <CardDescription>
                Enable or disable features across the entire platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              {flagsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : featureFlags ? (
                <div className="space-y-4">
                  {Object.entries(featureFlags).map(([flag, enabled]) => (
                    <div key={flag} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium font-mono">{flag}</p>
                        <p className="text-sm text-muted-foreground">
                          {enabled ? 'Enabled for all tenants' : 'Disabled'}
                        </p>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) =>
                          updateFlagMutation.mutate({ flag, enabled: checked })
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No feature flags configured
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cache Management</CardTitle>
                <CardDescription>
                  Manage the platform KV cache
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Cache Hit Rate</p>
                    <p className="text-sm text-muted-foreground">
                      {metrics?.cacheHitRate || 0}% of requests served from cache
                    </p>
                  </div>
                  <Badge variant={metrics?.cacheHitRate && metrics.cacheHitRate > 80 ? 'success' : 'warning'}>
                    {metrics?.cacheHitRate && metrics.cacheHitRate > 80 ? 'Good' : 'Low'}
                  </Badge>
                </div>

                <Separator />

                <div>
                  <p className="mb-2 font-medium">Clear All Cache</p>
                  <p className="mb-4 text-sm text-muted-foreground">
                    This will clear all cached data. The cache will rebuild automatically.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => clearCacheMutation.mutate()}
                    disabled={clearCacheMutation.isPending}
                  >
                    {clearCacheMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Clear Cache
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate Limiting</CardTitle>
                <CardDescription>
                  Configure API rate limits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Requests per minute (per IP)</Label>
                  <Input type="number" defaultValue="100" />
                </div>
                <div className="space-y-2">
                  <Label>Requests per minute (per tenant)</Label>
                  <Input type="number" defaultValue="1000" />
                </div>
                <div className="space-y-2">
                  <Label>AI requests per minute (per tenant)</Label>
                  <Input type="number" defaultValue="50" />
                </div>
                <Button>Save Rate Limits</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
