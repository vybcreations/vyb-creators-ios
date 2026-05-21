import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wckaegwlhrhvgdnkdwcu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indja2FlZ3dsaHJodmdkbmtkd2N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NTE0OTQsImV4cCI6MjA5NDEyNzQ5NH0.Xdi1D7PXjMf8FllxLdhAlc03Vl4yXoe3PnZyRpd5KGc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Legacy Task shape (Phase 0). The active mobile Tasks code lives in
// `src/lib/tasks.ts` and uses the new schema (`text`, `pri`, `project`, ...).
// Kept here only for any leftover references during transition.
export type Task = {
  id: string;
  user_id: string;
  text: string;
  pri: 'urgent' | 'important' | 'later';
  project: string | null;
  done: boolean;
  done_at: string | null;
  due_date: string | null;
  due_kind: string | null;
  scheduled_for: string | null;
  position: number | null;
  created_at: string;
  updated_at: string;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  time_of_day: string | null;
  archived: boolean;
  created_at: string;
};

export type Book = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  total_pages: number | null;
  current_page: number;
  status: 'reading' | 'next' | 'done';
  cover_tone: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};
