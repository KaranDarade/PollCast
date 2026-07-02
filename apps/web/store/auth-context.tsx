'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string | null;
  phone?: string | null;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string; avatar?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function fetchWithAuth(url: string, options: RequestInit = {}, token?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers, credentials: 'include' });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || 'Request failed');
  }

  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    const stored = localStorage.getItem('accessToken');
    if (stored) setAccessToken(stored);

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        if (!stored) { setUser(null); setAccessToken(null); }
        return;
      }

      const data = await res.json();
      setUser(data.data.user);
      setAccessToken(data.data.accessToken);
      localStorage.setItem('accessToken', data.data.accessToken);
    } catch {
      if (!localStorage.getItem('accessToken')) {
        setUser(null);
        setAccessToken(null);
      }
    }
  }, []);

  useEffect(() => {
    refreshAuth().finally(() => setIsLoading(false));
  }, [refreshAuth]);

  const login = async (email: string, password: string) => {
    const data = await fetchWithAuth(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(data.data.user);
    setAccessToken(data.data.accessToken);
    localStorage.setItem('accessToken', data.data.accessToken);
  };

  const signup = async (email: string, password: string, name: string) => {
    await fetchWithAuth(`${API_URL}/auth/signup`, {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  };

  const logout = async () => {
    try {
      await fetchWithAuth(
        `${API_URL}/auth/logout`,
        { method: 'POST' },
        accessToken
      );
    } catch {
      // Still clear local state even if server call fails (e.g. expired token)
    }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('accessToken');
    document.cookie = 'refreshToken=; Path=/api/v1/auth; Max-Age=0';
    router.push('/login');
  };

  const updateProfile = async (data: { name?: string; phone?: string; avatar?: string }) => {
    const res = await fetchWithAuth(
      `${API_URL}/auth/me`,
      { method: 'PATCH', body: JSON.stringify(data) },
      accessToken
    );
    setUser(res.data);
  };

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, login, signup, logout, refreshAuth, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
