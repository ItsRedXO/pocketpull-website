import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGems } from '../lib/api';
import { useAuth } from './useAuth';

export const GEMS_QUERY_KEY = ['gems'];

export function useGems(userId?: string) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: GEMS_QUERY_KEY,
    queryFn: getGems,
    enabled: !!userId && isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: GEMS_QUERY_KEY });

  return {
    gems: data?.gems ?? 0,
    isLoading,
    invalidate,
  };
}
