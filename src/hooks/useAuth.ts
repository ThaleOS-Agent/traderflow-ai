import { useState, useEffect, useCallback } from 'react';
import { api, type AuthUser } from '../dashboard/api';

interface AuthState {
  user: AuthUser | null;
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
      .then((data) => {
        setState({ user: data.user, isAuthenticated: true, isLoading: false });
      })
      .catch(() => {
        api.logout();
        setState({ user: null, isAuthenticated: false, isLoading: false });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password);
    setState({ user: data.user, isAuthenticated: true, isLoading: false });
    return data.user;
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return { ...state, login, logout };
}
