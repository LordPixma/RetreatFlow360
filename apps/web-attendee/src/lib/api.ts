const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request(endpoint: string, options: RequestOptions = {}): Promise<Response> {
    const { skipAuth, ...fetchOptions } = options;

    const headers = new Headers(fetchOptions.headers);

    if (!headers.has('Content-Type') && fetchOptions.body) {
      headers.set('Content-Type', 'application/json');
    }

    if (!skipAuth) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    // Handle token refresh on 401
    if (response.status === 401 && !skipAuth) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const refreshResponse = await this.post('/api/v1/auth/refresh', { refreshToken }, { skipAuth: true });
          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);

            // Retry original request
            headers.set('Authorization', `Bearer ${data.accessToken}`);
            return fetch(`${this.baseUrl}${endpoint}`, {
              ...fetchOptions,
              headers,
            });
          }
        } catch {
          // Refresh failed, clear tokens
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
    }

    return response;
  }

  async get(endpoint: string, options?: RequestOptions): Promise<Response> {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint: string, body?: unknown, options?: RequestOptions): Promise<Response> {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put(endpoint: string, body?: unknown, options?: RequestOptions): Promise<Response> {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch(endpoint: string, body?: unknown, options?: RequestOptions): Promise<Response> {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete(endpoint: string, options?: RequestOptions): Promise<Response> {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE_URL);
