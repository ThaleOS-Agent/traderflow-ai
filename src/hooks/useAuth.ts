import { useState, useEffect, useCallback } from 'react';
import { api } from '../dashboard/api';

type UserRecord = Record<string, unknown>;

interface AuthState {
  user: UserRecord | null;
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
        const user = (data as { user?: UserRecord }).user ?? (data as UserRecord);
        setState({ user, isAuthenticated: true, isLoading: false });
      })
      .catch(() => {
        api.logout();
        setState({ user: null, isAuthenticated: false, isLoading: false });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password);
    const user = (data as { user?: UserRecord }).user ?? null;
    setState({ user, isAuthenticated: true, isLoading: false });
    return user;
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return { ...state, login, logout };
}
