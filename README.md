# dsh-web-search-ddgs

DDGS/DuckDuckGo search provider for DeepSeek Harness. It adapts Python's
`ddgs` library into DSH's `ctx.web` search seam, so the existing `web_search`
tool can search the web without a search API key.

This plugin only provides search. Page fetching remains handled by DSH's normal
HTTP fetch provider, usually `@deepseek-ai/dsh-web-fetch-http`.

## Install

From a source checkout of DeepSeek Harness:

```bash
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add github:PetitePluie-255/dsh-web-search-ddgs
```

To pin the published version:

```bash
pnpm dsh plugin --profile web add github:PetitePluie-255/dsh-web-search-ddgs#v0.1.1
```

For local development before publishing:

```bash
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add /absolute/path/to/dsh-web-search-ddgs
```

Build and test the package before installing a local checkout:

```bash
pnpm install
pnpm test
```

Then start the WebUI:

```bash
pnpm dsh web
```

## Python Runtime

The plugin runs a small Python worker that imports `ddgs`, matching the shape
used by oMLX's built-in web search implementation.

Install `ddgs` for the Python used by DSH:

```bash
python3 -m pip install ddgs
```

The plugin checks once at startup that the selected Python executable can
`import ddgs`. If the check fails, DSH reports the configured search provider
as unavailable instead of waiting for the first search request to fail.

Or point the plugin at a specific Python executable:

```yaml
- id: web-search-ddgs
  name: dsh-web-search-ddgs
  config:
    pythonBin: /absolute/path/to/python
```

You can also set:

```bash
export DSH_DDGS_PYTHON=/absolute/path/to/python
```

## What It Changes

The plugin ships this DSH bundle patch:

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: ddgs

- insert:
    - id: web-search-ddgs
      name: dsh-web-search-ddgs
```

DSH's built-in `@deepseek-ai/dsh-tool-web` still exposes the model-facing
`web_search` and `web_fetch` tools. This plugin only swaps the concrete search
provider to `ddgs`.

## Configuration

Optional plugin config:

```yaml
- id: web-search-ddgs
  name: dsh-web-search-ddgs
  config:
    maxResults: 5
    timeoutMs: 20000
    backend: auto
```

`maxResults` must be an integer from 1 through 10. `timeoutMs` must be an
integer from 1 through 120000. Empty `pythonBin` and `backend` values are
rejected when the profile is loaded.

## Notes

DuckDuckGo may rate-limit or change behavior. For production use where
reliability matters, use a paid provider such as DeepSeek native web search,
Exa, Perplexity, Brave, or your own SearXNG instance.
