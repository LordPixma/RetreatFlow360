import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  CreditCard,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
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
  Badge,
} from '@retreatflow360/ui';
import { formatCurrency, formatDate } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface FinancialStats {
  totalRevenue: number;
  monthlyRevenue: number;
  pendingPayments: number;
  refunds: number;
  currency: string;
  revenueChange: number;
  avgBookingValue: number;
}

interface Transaction {
  id: string;
  type: 'payment' | 'refund';
  amount: number;
  currency: string;
  status: string;
  eventTitle: string;
  userName: string;
  provider: string;
  createdAt: string;
}

interface RevenueByEvent {
  eventId: string;
  eventTitle: string;
  revenue: number;
  bookingsCount: number;
  currency: string;
}

export default function FinancialsPage() {
  const [period, setPeriod] = useState('30d');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['financial-stats', period],
    queryFn: async () => {
      const response = await api.get(`/admin/financials/stats?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json() as Promise<FinancialStats>;
    },
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', period],
    queryFn: async () => {
      const response = await api.get(`/payments?period=${period}&limit=20`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      const data = await response.json();
      return data.transactions as Transaction[];
    },
  });

  const { data: revenueByEvent, isLoading: revenueLoading } = useQuery({
    queryKey: ['revenue-by-event', period],
    queryFn: async () => {
      const response = await api.get(`/admin/financials/by-event?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch revenue');
      const data = await response.json();
      return data.events as RevenueByEvent[];
    },
  });

  const statCards = [
    {
      title: 'Total Revenue',
      value: stats ? formatCurrency(stats.totalRevenue, stats.currency) : '$0',
      change: stats?.revenueChange,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'This Month',
      value: stats ? formatCurrency(stats.monthlyRevenue, stats.currency) : '$0',
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Pending',
      value: stats ? formatCurrency(stats.pendingPayments, stats.currency) : '$0',
      icon: CreditCard,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      title: 'Refunds',
      value: stats ? formatCurrency(stats.refunds, stats.currency) : '$0',
      icon: RefreshCw,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financials</h1>
          <p className="text-muted-foreground">Track revenue, payments, and refunds</p>
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
              <SelectItem value="all">All time</SelectItem>
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
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={stat.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {Math.abs(stat.change)}%
                          </span>
                          <span className="text-muted-foreground">vs previous</span>
                        </div>
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

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="by-event">Revenue by Event</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                      <Skeleton className="h-6 w-24" />
                    </div>
                  ))}
                </div>
              ) : transactions?.length ? (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`rounded-lg p-2 ${
                            tx.type === 'payment' ? 'bg-green-100' : 'bg-red-100'
                          }`}
                        >
                          {tx.type === 'payment' ? (
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{tx.userName}</p>
                          <p className="text-sm text-muted-foreground">{tx.eventTitle}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-semibold ${
                            tx.type === 'payment' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {tx.type === 'payment' ? '+' : '-'}
                          {formatCurrency(tx.amount, tx.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.createdAt)} • {tx.provider}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No transactions found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-event" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Event</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                  ))}
                </div>
              ) : revenueByEvent?.length ? (
                <div className="space-y-4">
                  {revenueByEvent.map((event, index) => {
                    const maxRevenue = Math.max(...revenueByEvent.map((e) => e.revenue));
                    const percentage = (event.revenue / maxRevenue) * 100;

                    return (
                      <div key={event.eventId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{event.eventTitle}</p>
                            <p className="text-sm text-muted-foreground">
                              {event.bookingsCount} bookings
                            </p>
                          </div>
                          <p className="font-semibold">
                            {formatCurrency(event.revenue, event.currency)}
                          </p>
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
                  No revenue data found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
