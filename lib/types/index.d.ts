/**
 * DDGS/DuckDuckGo-backed search provider for DeepSeek Harness `ctx.web`.
 *
 * This plugin adapts Python's `ddgs` library to DSH's provider seam. It does
 * not expose its own model-facing tool: `@deepseek-ai/dsh-tool-web` remains
 * responsible for `web_search`; this package only supplies the keyless search
 * backend behind `ctx.web.search()`.
 *
 * @module dsh-web-search-ddgs
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { WebError } from '@deepseek-ai/dsh-web';
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web';
export declare const name = "web-search-ddgs";
export declare const inject: string[];
export declare const DDGS_PROVIDER_ID = "ddgs";
export declare const DEFAULT_MAX_RESULTS = 5;
export declare const DEFAULT_TIMEOUT_MS = 20000;
export declare const DEFAULT_BACKEND = "auto";
export declare const MAX_QUERY_CHARS = 300;
export declare const MAX_RESULTS_CAP = 10;
export declare const MAX_TIMEOUT_MS = 120000;
export declare const PREFLIGHT_TIMEOUT_MS = 5000;
export interface Config {
    /** Python executable that can `import ddgs`. Falls back to `$DSH_DDGS_PYTHON`, then `python3`. */
    pythonBin?: string;
    /** Default result count when the DSH tool layer does not pass maxResults. */
    maxResults?: number;
    /** End-to-end worker timeout. */
    timeoutMs?: number;
    /** ddgs backend string, such as `auto`, `duckduckgo`, or `brave,yahoo`. */
    backend?: string;
}
/** Runtime validation for plugin configuration loaded from Cordis YAML. */
export declare const Config: z<Config>;
export interface DdgsSearchProviderOptions {
    pythonBin: string;
    maxResults: number;
    timeoutMs: number;
    backend: string;
}
export declare class DdgsWebError extends WebError {
}
export declare class DdgsSearchProvider implements WebSearchProvider {
    private readonly options;
    readonly id = "ddgs";
    private readonly runtimeAvailable;
    constructor(options: DdgsSearchProviderOptions);
    available(): boolean;
    search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
export declare function apply(ctx: Context, config?: Config): void;
