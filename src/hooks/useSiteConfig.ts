import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ── Loading Screen Config ────────────────────────────────────────────────────

export interface LoadingScreenConfig {
  messages: string[];
  barColor1: string;
  barColor2: string;
  barHeight: number;
  barRadius: number;
}

export const DEFAULT_LOADING_CONFIG: LoadingScreenConfig = {
  messages: [
    'Loading Your Collection...',
    'Preparing Your Pulls...',
    'Entering the Vault...',
    'Initializing Pack System...',
  ],
  barColor1: '#7c3aed',
  barColor2: '#c084fc',
  barHeight: 22,
  barRadius: 0,
};

const LOADING_KEY = ['site_config', 'loading_screen'];

export function useLoadingScreenConfig() {
  const queryClient = useQueryClient();

  const { data: config = DEFAULT_LOADING_CONFIG } = useQuery<LoadingScreenConfig>({
    queryKey: LOADING_KEY,
    queryFn: async () => {
      if (!supabase) return DEFAULT_LOADING_CONFIG;
      const { data, error } = await supabase
        .from('site_config')
        .select('value')
        .eq('key', 'loading_screen')
        .single();
      if (error || !data) return DEFAULT_LOADING_CONFIG;
      return { ...DEFAULT_LOADING_CONFIG, ...(data.value as Partial<LoadingScreenConfig>) };
    },
    staleTime: 10 * 60 * 1000,
  });

  const { mutateAsync: saveConfig, isPending: isSaving } = useMutation({
    mutationFn: async (newConfig: LoadingScreenConfig) => {
      if (!supabase) throw new Error('Supabase unavailable');
      const { error } = await supabase
        .from('site_config')
        .upsert({ key: 'loading_screen', value: newConfig, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_, newConfig) => {
      queryClient.setQueryData(LOADING_KEY, newConfig);
    },
  });

  return { config, saveConfig, isSaving };
}

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
