import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const ADMIN_NICK = import.meta.env.VITE_ADMIN_NICK || 'tobias kromka';

export interface Player {
  id: string;
  nick: string;
  is_admin: boolean;
  created_at: string;
}

export interface Verb {
  id: string;
  slovensky: string;
  prvy_tvar: string;
  druhy_tvar: string;
  treti_tvar: string;
  created_at: string;
}

export interface PlayerVerb {
  id: string;
  player_id: string;
  verb_id: string;
  spravne: number;
  zle: number;
  streak: number;
  level: number;
  posledna_chyba: string | null;
}

export interface VerbError {
  id: string;
  player_verb_id: string;
  cas: string;
  odpovede: string[];
  spravne: string[];
  typ: string;
}

export type QuestionType = 'slovak' | 'form1' | 'form2' | 'form3';

export type PracticeMode = 'mix' | 'errors' | 'category';

export type InputMode = 'text' | 'audio';
