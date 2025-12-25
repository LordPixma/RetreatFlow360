import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ChevronLeft, Loader2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@retreatflow360/ui';
import { useToast } from '@retreatflow360/ui';
import { api } from '@/lib/api';

interface TenantForm {
  name: string;
  slug: string;
  contactEmail: string;
  subscriptionTier: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerPassword: string;
}

export default function TenantCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TenantForm>({
    defaultValues: {
      subscriptionTier: 'starter',
    },
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: TenantForm) => {
      const response = await api.post('/admin/tenants', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create tenant');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Tenant created',
        description: 'The new tenant has been created successfully.',
      });
      navigate(`/tenants/${data.tenant.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create tenant',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: TenantForm) => {
    createTenantMutation.mutate(data);
  };

  // Auto-generate slug from name
  watch('name'); // Watching for form changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setValue('slug', slug);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Tenant</h1>
          <p className="text-muted-foreground">Add a new organization to the platform</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>Basic information about the new tenant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                placeholder="Acme Retreats"
                {...register('name', { required: 'Name is required' })}
                onChange={(e) => {
                  register('name').onChange(e);
                  handleNameChange(e);
                }}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Subdomain *</Label>
              <div className="flex">
                <Input
                  id="slug"
                  className="rounded-r-none"
                  placeholder="acme-retreats"
                  {...register('slug', {
                    required: 'Subdomain is required',
                    pattern: {
                      value: /^[a-z0-9-]+$/,
                      message: 'Only lowercase letters, numbers, and hyphens',
                    },
                  })}
                />
                <span className="inline-flex items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm text-muted-foreground">
                  .retreatflow360.com
                </span>
              </div>
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email *</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="contact@acme.com"
                {...register('contactEmail', {
                  required: 'Contact email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
              />
              {errors.contactEmail && (
                <p className="text-sm text-destructive">{errors.contactEmail.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Subscription Tier</Label>
              <Select
                defaultValue="starter"
                onValueChange={(value) => setValue('subscriptionTier', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner Account</CardTitle>
            <CardDescription>
              Create the initial owner account for this tenant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ownerFirstName">First Name *</Label>
                <Input
                  id="ownerFirstName"
                  placeholder="John"
                  {...register('ownerFirstName', { required: 'First name is required' })}
                />
                {errors.ownerFirstName && (
                  <p className="text-sm text-destructive">{errors.ownerFirstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerLastName">Last Name *</Label>
                <Input
                  id="ownerLastName"
                  placeholder="Doe"
                  {...register('ownerLastName', { required: 'Last name is required' })}
                />
                {errors.ownerLastName && (
                  <p className="text-sm text-destructive">{errors.ownerLastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Email *</Label>
              <Input
                id="ownerEmail"
                type="email"
                placeholder="john@acme.com"
                {...register('ownerEmail', {
                  required: 'Owner email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
              />
              {errors.ownerEmail && (
                <p className="text-sm text-destructive">{errors.ownerEmail.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerPassword">Password *</Label>
              <Input
                id="ownerPassword"
                type="password"
                placeholder="••••••••"
                {...register('ownerPassword', {
                  required: 'Password is required',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters',
                  },
                })}
              />
              {errors.ownerPassword && (
                <p className="text-sm text-destructive">{errors.ownerPassword.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                The owner will receive an email to verify their account
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={createTenantMutation.isPending}>
            {createTenantMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Tenant'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
