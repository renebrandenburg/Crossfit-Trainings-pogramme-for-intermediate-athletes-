import type {
  AiSectionRequest,
  GenerationAdapter,
  JsonValue,
  ProgrammingFeatureFlag,
} from "./types";

export class DeterministicGenerationAdapter implements GenerationAdapter {
  readonly id = "deterministic-v2";

  async generate(request: AiSectionRequest): Promise<JsonValue> {
    return {
      adapterId: this.id,
      scope: request.scope,
      sessionId: request.sessionId,
      constraints: request.constraints,
    };
  }
}

export class DisabledAiGenerationAdapter implements GenerationAdapter {
  readonly id = "ai-disabled";

  async generate(_request: AiSectionRequest): Promise<JsonValue> {
    throw new Error(
      "AI generation is disabled. Configure a server-side provider before enabling this adapter.",
    );
  }
}

export function resolveProgrammingFeatureFlag(input: {
  remoteEnabled: boolean;
  hostname: string;
}): ProgrammingFeatureFlag {
  const localDevelopment = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    input.hostname.toLowerCase(),
  );
  if (localDevelopment) {
    return { enabled: true, source: "local_development" };
  }
  if (input.remoteEnabled) return { enabled: true, source: "supabase" };
  return { enabled: false, source: "disabled" };
}
