import type { Plugin } from 'esbuild';

export function disableReactScripts(source: string): string;
export function reactScriptPolicy(): Plugin;
export function assertNoScriptCreation(bundle: string): void;
