import { useAuthAdapter } from '../providers/AuthAdapterProvider.jsx';

export function useAuth() {
  return useAuthAdapter();
}
