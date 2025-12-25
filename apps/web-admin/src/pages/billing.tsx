import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  DollarSign,
  CreditCard,
  TrendingUp,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
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
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@retreatflow360/ui';
import { formatCurrency, formatDate } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface BillingStats {
  mrr: number;
  arr: number;
  mrrGrowth: number;
  churnRate: number;
  ltv: number;
  avgRevenuePerTenant: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
}

interface Subscription {
  id: string;
  tenantId: string;
  tenantName: string;
  tier: string;
  status: string;
  amount: number;
  currency: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface Invoice {
  id: string;
  tenantName: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt?: string;
}

export default function BillingPage() {
  const [period, setPeriod] = useState('30d');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['billing-stats', period],
    queryFn: async () => {
      const response = await api.get(`/admin/billing/stats?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch billing stats');
      return response.json() as Promise<BillingStats>;
    },
  });

  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const response = await api.get('/admin/billing/subscriptions');
      if (!response.ok) throw new Error('Failed to fetch subscriptions');
      const data = await response.json();
      return data.subscriptions as Subscription[];
    },
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const response = await api.get('/admin/billing/invoices?limit=20');
      if (!response.ok) throw new Error('Failed to fetch invoices');
      const data = await response.json();
      return data.invoices as Invoice[];
    },
  });

  const statCards = [
    {
      title: 'Monthly Recurring Revenue',
      value: formatCurrency(stats?.mrr || 0, 'USD'),
      change: stats?.mrrGrowth || 0,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Annual Recurring Revenue',
      value: formatCurrency(stats?.arr || 0, 'USD'),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Active Subscriptions',
      value: stats?.activeSubscriptions || 0,
      subtext: `${stats?.totalSubscriptions || 0} total`,
      icon: CreditCard,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Avg Revenue per Tenant',
      value: formatCurrency(stats?.avgRevenuePerTenant || 0, 'USD'),
      icon: Building2,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground">Platform revenue and subscriptions</p>
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
                {statsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                      {stat.change !== undefined && (
                        <div className="mt-1 flex items-center gap-1 text-sm">
                          {stat.change >= 0 ? (
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-600" />
                          )}
                          <span className={stat.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {Math.abs(stat.change)}%
                          </span>
                        </div>
                      )}
                      {stat.subtext && (
                        <p className="mt-1 text-sm text-muted-foreground">{stat.subtext}</p>
                      )}
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

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : subscriptions?.length ? (
                <div className="space-y-2">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{sub.tenantName}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="secondary">{sub.tier}</Badge>
                          <Badge variant={sub.status === 'active' ? 'success' : 'warning'}>
                            {sub.status}
                          </Badge>
                          {sub.cancelAtPeriodEnd && (
                            <Badge variant="destructive">Canceling</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(sub.amount, sub.currency)}/mo
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Renews {formatDate(sub.currentPeriodEnd)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No active subscriptions
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : invoices?.length ? (
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{invoice.tenantName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(invoice.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={
                            invoice.status === 'paid'
                              ? 'success'
                              : invoice.status === 'pending'
                              ? 'warning'
                              : 'destructive'
                          }
                        >
                          {invoice.status}
                        </Badge>
                        <span className="font-semibold">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">No invoices</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
