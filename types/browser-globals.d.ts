interface Window {
  ForgeHourLocalState?: {
    createLocalStateStore: (
      storage: Storage,
      options?: { legacySnapshotDelay?: number },
    ) => {
      clear: () => void;
      load: () => any;
      save: (state: any, previousState?: any) => boolean;
    };
  };
  ForgeHour: any;
  ForgeHourSync: any;
  ForgeHourSupabaseConfig?: {
    url?: string;
    anonKey?: string;
  };
  __E2E_SUPABASE_DELAYS__?: Record<string, number>;
  __E2E_SUPABASE_FAILURES__?: Record<string, number>;
  React: typeof import("react");
  ReactDOM: typeof import("react-dom/client");
  supabase?: {
    createClient(url: string, anonKey: string): any;
  };
}
