import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  Users,
  MoreVertical,
  Mail,
  Shield,
  Ban,
  Trash2,
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
  Avatar,
  AvatarFallback,
} from '@retreatflow360/ui';
import { formatDate } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  tenantId?: string;
  tenantName?: string;
  createdAt: string;
  lastLoginAt?: string;
}

const roleColors: Record<string, 'default' | 'secondary' | 'warning' | 'destructive'> = {
  GlobalAdmin: 'warning',
  TenantOwner: 'default',
  TenantAdmin: 'secondary',
  Staff: 'secondary',
  Attendee: 'default',
};

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const { data: users, isLoading } = useQuery({
    queryKey: ['all-users', roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.set('role', roleFilter);
      const response = await api.get(`/admin/users?${params}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      return data.users as User[];
    },
  });

  const filteredUsers = users?.filter(
    (user) =>
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage all platform users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="GlobalAdmin">Global Admin</SelectItem>
            <SelectItem value="TenantOwner">Tenant Owner</SelectItem>
            <SelectItem value="TenantAdmin">Tenant Admin</SelectItem>
            <SelectItem value="Staff">Staff</SelectItem>
            <SelectItem value="Attendee">Attendee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">{users?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Global Admins</p>
            <p className="text-2xl font-bold text-amber-600">
              {users?.filter((u) => u.role === 'GlobalAdmin').length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Tenant Owners</p>
            <p className="text-2xl font-bold text-blue-600">
              {users?.filter((u) => u.role === 'TenantOwner').length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Attendees</p>
            <p className="text-2xl font-bold">
              {users?.filter((u) => u.role === 'Attendee').length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredUsers?.length ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredUsers.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {user.firstName} {user.lastName}
                          </p>
                          <Badge variant={roleColors[user.role] || 'default'}>
                            {user.role}
                          </Badge>
                          {user.status === 'suspended' && (
                            <Badge variant="destructive">Suspended</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {user.tenantName && (
                          <p className="text-xs text-muted-foreground">
                            Tenant: {user.tenantName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden text-right text-sm text-muted-foreground sm:block">
                        <p>Joined {formatDate(user.createdAt)}</p>
                        {user.lastLoginAt && (
                          <p>Last login {formatDate(user.lastLoginAt)}</p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Shield className="mr-2 h-4 w-4" />
                            Change Role
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
          <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No users found</h3>
          <p className="mt-2 text-muted-foreground">
            {search || roleFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Users will appear here'}
          </p>
        </div>
      )}
    </div>
  );
}
