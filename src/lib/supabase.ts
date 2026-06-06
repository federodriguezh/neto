import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          fee_type: 'fixed' | 'percentage';
          fee_value: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['accounts']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          date: string;
          symbol: string;
          asset_class: string;
          type: 'buy' | 'sell';
          quantity: number;
          price: number;
          fees: number;
          currency: string;
          realized_pnl: number | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      participants: {
        Row: {
          id: string;
          user_id: string | null;
          household_id: string;
          name: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['participants']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['participants']['Insert']>;
      };
      households: {
        Row: {
          id: string;
          name: string | null;
          invite_code: string;
          split_method: 'proportional' | 'fixed';
          fixed_split: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['households']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['households']['Insert']>;
      };
      income_entries: {
        Row: {
          id: string;
          user_id: string;
          participant_id: string | null;
          date: string;
          source: string;
          category: 'salary' | 'freelance' | 'investment' | 'gift' | 'other';
          amount: number;
          currency: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['income_entries']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['income_entries']['Insert']>;
      };
      expenses: {
        Row: {
          id: string;
          household_id: string;
          created_by: string;
          date: string;
          description: string;
          category: string;
          total_amount: number;
          currency: string;
          paid_by: string;
          split_method: 'proportional' | 'fixed';
          fixed_split: number | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>;
      };
      expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          participant_id: string;
          share: number;
          amount: number;
          settled: boolean;
          settled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['expense_splits']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['expense_splits']['Insert']>;
      };
      preferences: {
        Row: {
          user_id: string;
          key: string;
          value: unknown;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['preferences']['Row'], 'updated_at'>;
        Update: Partial<Database['public']['Tables']['preferences']['Insert']>;
      };
      exchange_rates: {
        Row: {
          type: 'mep' | 'ccl';
          date: string;
          rate: number;
        };
        Insert: Database['public']['Tables']['exchange_rates']['Row'];
        Update: Partial<Database['public']['Tables']['exchange_rates']['Insert']>;
      };
      historical_prices: {
        Row: {
          symbol: string;
          date: string;
          open: number | null;
          close: number;
        };
        Insert: Database['public']['Tables']['historical_prices']['Row'];
        Update: Partial<Database['public']['Tables']['historical_prices']['Insert']>;
      };
      portfolio_history: {
        Row: {
          user_id: string;
          date: string;
          value: number;
        };
        Insert: Database['public']['Tables']['portfolio_history']['Row'];
        Update: Partial<Database['public']['Tables']['portfolio_history']['Insert']>;
      };
      sync_queue: {
        Row: {
          id: string;
          user_id: string;
          table_name: string;
          operation: 'INSERT' | 'UPDATE' | 'DELETE';
          data: unknown;
          timestamp: string;
          retry_count: number;
        };
        Insert: Omit<Database['public']['Tables']['sync_queue']['Row'], 'id' | 'timestamp'>;
        Update: Partial<Database['public']['Tables']['sync_queue']['Insert']>;
      };
    };
  };
};
