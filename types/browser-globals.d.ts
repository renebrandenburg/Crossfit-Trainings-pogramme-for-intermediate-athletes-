interface Window {
  ForgeHourBuild?: {
    commitSha?: string;
  };
  __FORGE_HOUR_GENERATION_TRACE__?: Array<{
    stage: string;
    strengthAndSkillBlock: unknown;
    timestamp: string;
  }>;
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
  ForgeHourAchievements?: {
    ACHIEVEMENT_DEFINITIONS: ReadonlyArray<any>;
    evaluateAchievementProgress: (input?: any) => ReadonlyArray<any>;
    normalizeAchievementState: (value?: any) => any;
    reconcileAchievementState: (
      previousState: any,
      progress: ReadonlyArray<any>,
      evaluatedAt?: string,
    ) => { state: any; newlyEarnedIds: string[] };
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
