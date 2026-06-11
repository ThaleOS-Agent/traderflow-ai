import { useState, useEffect, useCallback } from 'react';
import { api } from '../dashboard/api';
import type { User } from '../dashboard/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: api.isAuthenticated(),
    isLoading: api.isAuthenticated(),
  });

  useEffect(() => {
    if (!api.isAuthenticated()) return;

    api.getMe()
      .then((user) => setState({ user, isAuthenticated: true, isLoading: false }))
      .catch(() => {
        api.logout();
        setState({ user: null, isAuthenticated: false, isLoading: false });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api.login(email, password);
    setState({ user, isAuthenticated: true, isLoading: false });
    return user;
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return { ...state, login, logout };
}
