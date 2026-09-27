import { describe, expect, it } from 'vitest';
import {
  detectAgents,
  parseAgentOutput,
  parseArguments,
  type AgentConfig,
} from './agents.js';

describe('parseArguments', () => {
  it('splits on whitespace and keeps quoted groups together', () => {
    expect(parseArguments('run --format json')).toEqual(['run', '--format', 'json']);
    expect(parseArguments('--tools "" --disallowedTools "mcp__*"')).toEqual([
      '--tools',
      '',
      '--disallowedTools',
      'mcp__*',
    ]);
  });

  it('supports escaping inside double quotes without shell expansion', () => {
    expect(parseArguments('--prompt "a \\"b\\" c"')).toEqual(['--prompt', 'a "b" c']);
  });

  it('rejects an unclosed quote', () => {
    expect(() => parseArguments('--prompt "open')).toThrow();
  });
});

describe('parseAgentOutput', () => {
  it('reads the last codex agent message from JSON lines', () => {
    const output = [
      '{"type":"item.completed","item":{"type":"agent_message","text":"first"}}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"final"}}',
    ].join('\n');
    expect(parseAgentOutput('codex', output)).toBe('final');
  });

  it('concatenates opencode text parts', () => {
    const output = [
      '{"type":"text","part":{"text":"{\\"a\\":"}}',
      '{"type":"text","part":{"text":"1}"}}',
    ].join('\n');
    expect(parseAgentOutput('opencode', output)).toBe('{"a":1}');
  });

  it('unwraps claude JSON results and reports failures', () => {
    expect(parseAgentOutput('claude', '{"result":"OK"}')).toBe('OK');
    expect(() => parseAgentOutput('claude', '{"is_error":true}')).toThrow();
  });

  it('returns raw output for pi and custom agents', () => {
    expect(parseAgentOutput('pi', 'plain text')).toBe('plain text');
    expect(parseAgentOutput('custom', 'plain text')).toBe('plain text');
  });

  it('fails on an error event or empty output', () => {
    expect(() => parseAgentOutput('codex', '{"type":"error"}')).toThrow();
    expect(() => parseAgentOutput('opencode', '')).toThrow();
  });
});

describe('detectAgents', () => {
  it('marks missing executables as not installed', async () => {
    const config: AgentConfig = {
      id: 'missing',
      kind: 'custom',
      name: 'Missing',
      command: 'geo-story-map-does-not-exist-xyz',
      args: '',
    };
    const [detected] = await detectAgents([config]);
    expect(detected?.installed).toBe(false);
    expect(detected?.executable).toBeUndefined();
  });
});
