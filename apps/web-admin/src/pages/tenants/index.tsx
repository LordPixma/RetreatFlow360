import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Building2,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Users,
  Calendar,
  Ban,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Badge,
  Skeleton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@retreatflow360/ui';
import { formatCurrency } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  customDomain?: string;
  subscriptionTier: string;
  status: string;
  usersCount: number;
  eventsCount: number;
  monthlyRevenue: number;
  currency: string;
  createdAt: string;
}

const tierColors: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  free: 'secondary',
  starter: 'default',
  professional: 'success',
  enterprise: 'warning',
};

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  active: 'success',
  suspended: 'destructive',
  trial: 'secondary',
};

export default function TenantsPage() {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants', tierFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tierFilter !== 'all') params.set('tier', tierFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const response = await api.get(`/admin/tenants?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tenants');
      const data = await response.json();
      return data.tenants as Tenant[];
    },
  });

  const filteredTenants = tenants?.filter((tenant) =>
    tenant.name.toLowerCase().includes(search.toLowerCase()) ||
    tenant.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">Manage platform organizations</p>
        </div>
        <Button asChild>
          <Link to="/tenants/create">
            <Plus className="mr-2 h-4 w-4" />
            Add Tenant
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Tenants</p>
            <p className="text-2xl font-bold">{tenants?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">
              {tenants?.filter((t) => t.status === 'active').length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Enterprise</p>
            <p className="text-2xl font-bold text-amber-600">
              {tenants?.filter((t) => t.subscriptionTier === 'enterprise').length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total MRR</p>
            <p className="text-2xl font-bold">
              {formatCurrency(
                tenants?.reduce((sum, t) => sum + t.monthlyRevenue, 0) || 0,
                'USD'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredTenants?.length ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredTenants.map((tenant, index) => (
                <motion.div
                  key={tenant.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/tenants/${tenant.id}`}
                            className="font-medium hover:text-primary"
                          >
                            {tenant.name}
                          </Link>
                          <Badge variant={statusColors[tenant.status] || 'default'}>
                            {tenant.status}
                          </Badge>
                          <Badge variant={tierColors[tenant.subscriptionTier] || 'default'}>
                            {tenant.subscriptionTier}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {tenant.slug}.retreatflow360.com
                          {tenant.customDomain && ` • ${tenant.customDomain}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="hidden text-right sm:block">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {tenant.usersCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {tenant.eventsCount}
                          </span>
                        </div>
                        <p className="mt-1 font-medium">
                          {formatCurrency(tenant.monthlyRevenue, tenant.currency)}/mo
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/tenants/${tenant.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Tenant
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Ban className="mr-2 h-4 w-4" />
                            Suspend
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="py-12 text-center">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No tenants found</h3>
          <p className="mt-2 text-muted-foreground">
            {search || tierFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Add your first tenant to get started'}
          </p>
        </div>
      )}
    </div>
  );
}
