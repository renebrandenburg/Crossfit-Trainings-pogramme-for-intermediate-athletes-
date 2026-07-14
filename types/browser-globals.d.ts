interface Window {
  ForgeHour: any;
  ForgeHourSync: any;
  ForgeHourSupabaseConfig?: {
    url?: string;
    anonKey?: string;
  };
  React: typeof import("react");
  ReactDOM: typeof import("react-dom/client");
  supabase?: {
    createClient(url: string, anonKey: string): any;
  };
}
