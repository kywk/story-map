import type { App } from 'obsidian';
import {
  DEFAULT_AGENT_CONFIGS,
  detectAgents,
  runAgent,
  type AgentConfig,
  type DetectedAgent,
} from './agents.js';
import {
  coordinateLookupPrompt,
  parseCoordinateCandidates,
  type CoordinateCandidate,
} from './coordinates.js';
import { t } from './i18n.js';

export interface LocalAgents {
  agents: AgentConfig[];
  defaultId: string;
  detected: DetectedAgent[];
}

const LOCAL_KEY = 'geo-story-map:local-agents:v1';

export class LocalAgentController {
  local: LocalAgents;
  private stopped = false;
  private readonly tests = new Set<AbortController>();

  constructor(private readonly app: App) {
    const stored = app.loadLocalStorage(LOCAL_KEY) as Partial<LocalAgents> | null;
    this.local = {
      agents: Array.isArray(stored?.agents)
        ? stored.agents
        : DEFAULT_AGENT_CONFIGS.map((agent) => ({ ...agent })),
      defaultId: typeof stored?.defaultId === 'string' ? stored.defaultId : 'codex',
      detected: Array.isArray(stored?.detected) ? stored.detected : [],
    };
  }

  saveLocal(next: LocalAgents): void {
    this.app.saveLocalStorage(LOCAL_KEY, next);
    this.local = next;
  }

  async detect(): Promise<DetectedAgent[]> {
    const detected = await detectAgents(this.local.agents);
    if (!this.stopped) this.saveLocal({ ...this.local, detected });
    return detected;
  }

  defaultAgent(): AgentConfig | undefined {
    return this.local.agents.find((agent) => agent.id === this.local.defaultId);
  }

  async test(config: AgentConfig, signal?: AbortSignal): Promise<string> {
    const abort = new AbortController();
    const cancel = (): void => abort.abort();
    if (this.stopped || signal?.aborted) abort.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    this.tests.add(abort);
    try {
      return await runAgent(config, {
        input: 'This is a connection test. No vault content is included.',
        prompt: 'Reply only with OK.',
        signal: abort.signal,
        timeoutMs: 60_000,
      });
    } finally {
      signal?.removeEventListener('abort', cancel);
      this.tests.delete(abort);
    }
  }

  async lookupCoordinates(query: string, signal: AbortSignal): Promise<CoordinateCandidate[]> {
    const agent = this.defaultAgent();
    if (!agent) throw new Error(t('Choose a default local agent in settings'));
    const output = await runAgent(agent, { prompt: coordinateLookupPrompt(), input: query, signal });
    return parseCoordinateCandidates(output);
  }

  dispose(): void {
    this.stopped = true;
    for (const test of this.tests) test.abort();
    this.tests.clear();
  }
}
