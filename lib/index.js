import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const name = 'web-search-ddgs';
export const inject = ['web'];
export const DDGS_PROVIDER_ID = 'ddgs';
export const DEFAULT_MAX_RESULTS = 5;
export const DEFAULT_TIMEOUT_MS = 20000;
export const DEFAULT_BACKEND = 'auto';
export const MAX_QUERY_CHARS = 300;
export const MAX_RESULTS_CAP = 10;

const WORKER_PATH = fileURLToPath(new URL('./ddgs_worker.py', import.meta.url));

export class DdgsWebError extends Error {
  constructor(message, code, options) {
    super(message, options);
    this.code = code;
    this.name = 'WebError';
  }
}

function resolveConfig(config) {
  return {
    pythonBin: config.pythonBin ?? process.env.DSH_DDGS_PYTHON ?? 'python3',
    maxResults: clampPositiveInteger(config.maxResults, DEFAULT_MAX_RESULTS, MAX_RESULTS_CAP),
    timeoutMs: clampPositiveInteger(config.timeoutMs, DEFAULT_TIMEOUT_MS, 120000),
    backend: config.backend ?? DEFAULT_BACKEND,
  };
}

function clampPositiveInteger(value, fallback, cap) {
  if (!Number.isInteger(value) || value === undefined || value < 1) return fallback;
  return Math.min(value, cap);
}

export class DdgsSearchProvider {
  id = DDGS_PROVIDER_ID;

  constructor(options) {
    this.options = options;
  }

  available() {
    return this.options.pythonBin.length > 0
      && this.options.maxResults > 0
      && this.options.timeoutMs > 0;
  }

  async search(request, signal) {
    const query = request.query.trim().slice(0, MAX_QUERY_CHARS);
    if (query.length === 0) {
      throw new DdgsWebError('web_search needs a non-empty query', 'WEB_INVALID_QUERY');
    }

    throwIfAborted(signal);
    const maxResults = clampPositiveInteger(request.maxResults, this.options.maxResults, MAX_RESULTS_CAP);
    const payload = await runWorker(
      this.options.pythonBin,
      {
        query,
        max_results: maxResults,
        backend: this.options.backend,
        timeout_seconds: Math.ceil(this.options.timeoutMs / 1000),
      },
      this.options.timeoutMs,
      signal,
    );

    if (payload.ok !== true) {
      const error = payload.error ?? {};
      throw new DdgsWebError(error.message ?? 'ddgs search failed', error.code ?? 'WEB_PROVIDER_ERROR');
    }

    return {
      sources: normalizeSources(payload.results ?? []).slice(0, maxResults),
      truncated: (payload.results?.length ?? 0) > maxResults,
    };
  }
}

function runWorker(pythonBin, request, timeoutMs, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [WORKER_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      rejectOnce(new DdgsWebError('ddgs search timed out', 'WEB_PROVIDER_TIMEOUT'));
    }, timeoutMs);

    const abort = () => {
      child.kill('SIGTERM');
      rejectOnce(new DdgsWebError('DuckDuckGo search aborted', 'WEB_ABORTED'));
    };
    signal?.addEventListener('abort', abort, { once: true });

    function cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }

    function resolveOnce(value) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }

    function rejectOnce(error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      rejectOnce(new DdgsWebError(`failed to start ${pythonBin}: ${errorMessage(error)}`, 'WEB_PROVIDER_UNAVAILABLE', { cause: error }));
    });
    child.on('close', () => {
      if (settled) return;
      try {
        resolveOnce(JSON.parse(stdout || '{}'));
      } catch (error) {
        rejectOnce(new DdgsWebError(
          `ddgs worker returned invalid JSON${stderr ? `: ${stderr.trim()}` : ''}`,
          'WEB_PROVIDER_ERROR',
          { cause: error },
        ));
      }
    });

    child.stdin.end(JSON.stringify(request));
  });
}

function normalizeSources(results) {
  const seen = new Set();
  const sources = [];

  for (const result of results) {
    if (typeof result.url !== 'string' || !URL.canParse(result.url)) continue;
    const url = new URL(result.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    const normalized = url.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const title = cleanText(result.title);
    const snippet = cleanText(result.snippet);
    sources.push({
      url: normalized,
      ...(title.length > 0 ? { title } : {}),
      ...(snippet.length > 0 ? { snippet } : {}),
    });
  }

  return sources;
}

function cleanText(value) {
  return (value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function throwIfAborted(signal) {
  if (signal?.aborted === true) {
    throw new DdgsWebError('DuckDuckGo search aborted', 'WEB_ABORTED');
  }
}

function errorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function apply(ctx, config = {}) {
  ctx.web.registerSearchProvider(new DdgsSearchProvider(resolveConfig(config)));
}
