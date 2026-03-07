import { useAuth } from './useAuth';

export function useApiAuth() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth();
  return { getAccessTokenSilently, isAuthenticated };
}
