import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface CardPosition {
  name: string;
  left: number;
  top: number;
}

export const DEFAULT_CARD_POSITIONS: CardPosition[] = [
  { name: 'Umbreon VMAX', left: 47.5, top: 36 },
  { name: 'Mewtwo',       left: 68,   top: 41 },
  { name: 'Charizard',    left: 81,   top: 32 },
];

const QUERY_KEY = ['site_config', 'hero_card_positions'];

export function useHeroCardPositions() {
  const queryClient = useQueryClient();

  const { data: positions = DEFAULT_CARD_POSITIONS } = useQuery<CardPosition[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      if (!supabase) return DEFAULT_CARD_POSITIONS;
      const { data, error } = await supabase
        .from('site_config')
        .select('value')
        .eq('key', 'hero_card_positions')
        .single();
      if (error || !data) return DEFAULT_CARD_POSITIONS;
      return data.value as CardPosition[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { mutateAsync: savePositions, isPending: isSaving } = useMutation({
    mutationFn: async (newPositions: CardPosition[]) => {
      if (!supabase) throw new Error('Supabase unavailable');
      const { error } = await supabase
        .from('site_config')
        .upsert({ key: 'hero_card_positions', value: newPositions, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_, newPositions) => {
      queryClient.setQueryData(QUERY_KEY, newPositions);
    },
  });

  return { positions, savePositions, isSaving };
}
