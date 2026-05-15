# Dapp Templates

Templates are JSON files that tell the extension how to extract a normalized
event (e.g. a `Swap`) from a dapp's API traffic. The data files live in
`src/templates/` (alongside `registry.ts`), and the engine that interprets
them lives in `src/template-engine/`.

## Pipeline

Templates run in the **MAIN-world content script** (the page context) on the
**response** phase of any intercepted call — `fetch`, `XMLHttpRequest`, or a
wallet-injected `window.ethereum.request`. A template that matches emits one
or more typed events (currently `SwapEvent`) over the comctx channel to the
background.

```
intercepted response  ──►  template engine  ──►  SwapEvent[]
                              │
                              └─ runs templates from src/templates/
```

Matching is gated by cheap checks (interceptor source, page host, event
method, optional URL regex) before any JSON parsing happens, so templates are
safe to add liberally.

## Template structure

```json
{
  "id": "jumper",
  "name": "Jumper",
  "schema": "swap",
  "match": {
    "domains": ["jumper.xyz", "jumper.exchange"],
    "method": "POST",
    "urlPattern": "^https://api\\.jumper\\.xyz/pipeline/v\\d+/advanced/routes(\\?|$)"
  },
  "extract": {
    "iterate": "$response.routes",
    "fields": {
      "chainIn":  "$item.fromChainId",
      "tokenIn":  "$item.fromToken.address",
      "amountIn": "$item.fromAmount",
      ...
    }
  }
}
```

### Top-level fields

| Field    | Type    | Notes |
|----------|---------|-------|
| `id`     | string  | Stable identifier; used in events as `templateId`. |
| `name`   | string  | Human-readable name. |
| `schema` | string  | Output schema. Currently `"swap"`. |
| `match`  | object  | See [Match block](#match-block). |
| `extract`| object  | See [Extract block](#extract-block). |

### Match block

| Field         | Type                              | Notes |
|---------------|-----------------------------------|-------|
| `source`      | `"fetch" \| "xhr" \| "ethereum"` or array, optional | Restricts which interceptor source(s) this template applies to. Omit to match any source. |
| `domains`     | `string[]`, optional              | Page domains. Matched against `window.location.host`; subdomain matches are accepted (`app.jumper.xyz` matches `jumper.xyz`). Omit to match any host — useful when the template is keyed on a contract address (a forked Uniswap router runs on a thousand UIs) and the dapp identity doesn't matter. `SwapEvent.domain` still records the actual host. |
| `method`      | `string` or `string[]`, optional  | Matches `event.method` — the HTTP verb for fetch/xhr (`"POST"`), or the JSON-RPC method name for ethereum (`"eth_sendTransaction"`). |
| `urlPattern`  | `string`, optional                | JavaScript regex tested against the full request URL. Only meaningful for fetch/xhr; ignored for ethereum events. |
| `to`          | `string` or `string[]`, optional  | Transaction recipient filter for ethereum events. Compared case-insensitively against `params[0].to`. Ignored for non-ethereum sources. |
| `abi`         | `string[]`, optional              | Human-readable function signatures. When set on an ethereum-source template, the engine decodes `params[0].data` against these signatures and binds the named arguments to `$decoded`. The selector is derived automatically; templates that fail to decode are silently skipped. |

A template only runs if **all** match conditions pass. Anything stricter
(headers, body shape, etc.) can be expressed by tightening `urlPattern` or by
relying on path resolution to fail in `fields` (which silently drops the
event).

### Extract block

| Field      | Type                       | Notes |
|------------|----------------------------|-------|
| `iterate`  | `string?`                  | A path that resolves to an array. When present, the engine emits one event per element, with that element bound to `$item` for the duration of `fields` evaluation. When absent, exactly one event is considered. |
| `static`   | `Record<string, unknown>?` | Literal field values applied first as defaults. Use for values that can't come from the wire (`chainIn`/`chainOut` on a chain-specific ethereum template, a hardcoded `provider` name, etc.). Coerced like `fields` outputs. |
| `fields`   | `Record<string,string>`    | Maps each schema field name to a path expression. Resolved values override `static` per-iteration. |

If a required schema field is missing (neither `static` nor `fields` produce
a value), the event is dropped silently. Optional fields are simply omitted
from the output.

## Path expressions

A path expression is a `$source` followed by zero or more dot keys and numeric
indices.

```
$request.fromAmount
$response.routes
$item.steps[0].toolDetails.key
$url.host
$url.search.someParam
```

### Sources

The bound sources depend on the interceptor source of the matched event:

| Source     | fetch/xhr | ethereum | Value |
|------------|-----------|----------|-------|
| `$request` | ✓         |          | `JSON.parse(requestBody)` (or `undefined` if not JSON) |
| `$response`| ✓         |          | `JSON.parse(responseBody)` (or `undefined` if not JSON) |
| `$url`     | ✓         |          | `{ host, path, segments: string[], full, search: { [k]: string } }` — `segments` is the path split on `/` with empty parts removed (`/quote/v7/1` → `["quote", "v7", "1"]`), useful for REST-style APIs that put resource ids in the path |
| `$method`  | ✓         | ✓        | HTTP verb (fetch/xhr) or RPC method name (ethereum) |
| `$params`  |           | ✓        | the JSON-RPC params (typically an array) |
| `$result`  |           | ✓        | the JSON-RPC result |
| `$decoded` |           | ✓        | ABI-decoded function args, keyed by parameter name. Only bound when `match.abi` is set and decoding succeeds. |
| `$item`    | ✓         | ✓        | the current array element (only inside `iterate`) |

### Operators

- `.foo` — object property access.
- `[N]` — numeric array index (zero-based).
- `[-N]` — index from the end (`[-1]` is the last element).

That's the whole grammar. There is intentionally no wildcard, slice, filter,
or arithmetic — if a template needs more, prefer to widen `iterate` instead.

## Output schemas

### `swap`

The `swap` schema covers both same-chain swaps and cross-chain bridges. The
emitted event sets `type: "swap"` when `chainIn === chainOut`, otherwise
`type: "bridge"`.

The required set is the minimum to express a rate — without all six, the
event is not emitted. Token symbols/decimals, USD values, and gas costs are
intentionally **not** part of the schema: the consumer can resolve them from
the on-chain token contract or a price oracle and shouldn't depend on the
dapp's own labelling.

| Field          | Type    | Required | Notes |
|----------------|---------|----------|-------|
| `chainIn`      | number  | yes      | EVM chain id |
| `chainOut`     | number  | yes      | EVM chain id |
| `tokenIn`      | string  | yes      | token contract address |
| `tokenOut`     | string  | yes      | token contract address |
| `amountIn`     | string  | yes      | base-units, big-number-as-string |
| `amountOut`    | string  | yes      | base-units, big-number-as-string |
| `amountOutMin` | string  | no       | after-slippage minimum, base-units |
| `fromAddress`  | string  | no       | sender |
| `toAddress`    | string  | no       | recipient |
| `provider`     | string  | no       | display name of the routing/aggregator step (e.g. `"Squid"`, `"CCTPv2 + Mayan"`). Leave unset on contract-keyed templates that could match forked contracts — the contract address is the real identity; the consumer can resolve a name from `to` if they want one. |

`chainIn` / `chainOut` are coerced to numbers; the other fields to strings. A
path that resolves to `null`/`undefined` simply omits the field — and if it's
a required one, the event is dropped entirely (no partial swaps).

`tokenIn` and `tokenOut` are additionally **normalized for native-asset
sentinels**: `0xEeee…eEEeE` (1inch / OKX-style), `"NATIVE"`, `"ETH"`,
`"BNB"`, `"MATIC"`, `"AVAX"`, `"FTM"`, `"CELO"`, `"xDai"` — all rewrite
(case-insensitively) to the canonical zero address
`0x0000000000000000000000000000000000000000`. ERC-20 addresses pass through
with their original casing preserved.

`chainIn` and `chainOut` accept **string aliases as well as numbers**:
`"ethereum"`/`"eth"` → `1`, `"polygon"`/`"matic"`/`"pol"` → `137`,
`"arbitrum"`/`"arb"` → `42161`, etc. (see
`src/template-engine/coerce-chain-id.ts` for the full list, which is
case-insensitive). This means a template can pull a chain name straight
out of a URL path or query param without per-template lookup tables —
e.g. KyberSwap's `aggregator-api.kyberswap.com/{ethereum|polygon|…}/route/encode`
matches every chain with one template via `chainIn: "$url.segments[0]"`.

The full type lives in `src/template-engine/types.ts` as `SwapEvent`.

## Example: Jumper

For a request like:

```http
POST https://api.jumper.xyz/pipeline/v1/advanced/routes
{ "fromChainId": 1, "fromTokenAddress": "0xdAC1...", "fromAmount": "100000000",
  "toChainId": 42161, "toTokenAddress": "0x912CE...", ... }
```

…the response contains a `routes` array, each entry of which is an
independent quote. The Jumper template iterates over `$response.routes`,
producing one `SwapEvent` per quote:

```
[maru bridge] jumper.xyz via Squid:
  100000000 USDT (chain 1) → 870057829433551961292 ARB (chain 42161)
[maru bridge] jumper.xyz via CCTPv2 + Mayan:
  100000000 USDT (chain 1) → 868898339940309000000 ARB (chain 42161)
...
```

See `src/templates/jumper.json` for the full template.

## Heuristic fallback

When no template matches a fetch/XHR event, the engine falls through to a
**heuristic matcher** in `src/heuristic/`. It walks a curated alias list
(`HEURISTIC_ALIASES`) against parsed request/response bodies and emits a
`SwapEvent` only when *every* required field resolves to a value that
passes a per-field shape check (address regex, non-zero digit string,
positive integer). Heuristic-sourced events use `templateId: "heuristic"`
and have no `provider`, so they're easy to tell apart in logs.

Strict gates: source must be fetch/XHR and status must be 2xx. Any HTTP
verb is fair game — the per-field shape checks (two distinct token
addresses, two non-zero digit amounts, a positive-integer chain id) already
exclude non-swap traffic, so a separate verb filter would be redundant.
Ethereum events stay template-only — decoding bytes blindly without an ABI
is too risky. If you hit a dapp the heuristic doesn't catch, write a
template; if you hit one it's catching wrong, add a more specific template
(templates win) or extend the alias lists. The aliases live in one file
(`src/heuristic/heuristic-aliases.ts`) so adding a new key is a one-line
change.

## Naming convention

To keep the registry navigable and IDs stable, templates follow a small
convention.

1. **File name = template `id`.** Always match exactly. The `name` field is
   the human-readable display label (`"CoW Swap ETH-Flow"`,
   `"1inch Fusion"`).
2. **One template per provider → just the provider name.** No `-api`
   suffix; "the API matcher" is the default. Examples: `jumper.json`,
   `kyberswap.json`, `lifi.json`, `pancakeswap.json`, `paraswap.json`.
3. **Multiple templates per provider → `{provider}-{disambiguator}`.** The
   canonical / current endpoint gets the bare name; legacy or auxiliary
   variants get the suffix.
   - **Mode**: `-classic`, `-fusion`, `-fusion-plus`, `-gasless`,
     `-cross-chain`. Used when distinct products share a provider:
     `0x-classic` vs `0x-gasless`, `1inch-classic` vs `1inch-fusion` vs
     `1inch-fusion-plus`, `sushi` vs `sushi-cross-chain`.
   - **Version**: `-v5`, `-v6`. Used when an older API version still has
     real traffic worth catching. Example: `1inch-classic-v5.json` covers
     legacy v5.2 hosts; `1inch-classic.json` covers the current v6.1.
   - **Host variant**: `-proxy` (last resort, when only the host differs
     for the same product). Example: `1inch-fusion-proxy.json` matches
     `proxy-app.1inch.com` (the host the 1inch UI happens to use); the
     bare `1inch-fusion.json` matches `api.1inch.com` (the official
     developer API).
4. **Contract-based (ABI) templates → `{provider}-{contract-name}`.**
   Examples: `cowswap-eth-flow.json`, `uniswap-v2-router.json`.
5. **Provider names are squished to one lowercase word.** `cowswap` (not
   `cow-swap`), `kyberswap`, `pancakeswap`, `paraswap`. Numeric prefixes
   are fine (`0x-classic`, `1inch-fusion`).

## Adding a new dapp

1. Create `src/templates/<dapp>.json`.
2. Append it to the `registry` array in `src/templates/registry.ts`:
   ```ts
   import dapp from "./dapp.json";
   export const registry: Template[] = [dapp1 as Template, dapp2 as Template];
   ```
3. Reload the extension. New events appear in the background console as
   `[maru swap] …` or `[maru bridge] …`.

When working out the field paths, the easiest workflow is to capture a real
request/response (e.g. with the network panel or `curl`), then iterate on the
template against that fixture.

## Ethereum (JSON-RPC) templates

Set `match.source` to `"ethereum"` to match calls a dapp makes to the
wallet-injected provider (`window.ethereum.request({ method, params })`) — so
this catches MetaMask, Rabby, Coinbase Wallet, Frame, and any other EIP-1193
or EIP-6963 provider, since the patch is on the dapp side.

What the interceptor sees is "what the dapp asks the wallet"; the wallet's
own RPC traffic to its node provider runs in the wallet extension's context
and is invisible from here.

### ABI decoding

For `eth_sendTransaction` and `eth_call`, the interesting payload is
ABI-encoded in `params[0].data`. To work with it as named arguments, give
the template a `to` filter (the contract you expect, scoping the selector
collision space) plus `abi` — an array of human-readable function signatures.
The engine decodes against the matching selector and binds the named
arguments under `$decoded`:

```json
{
  "id": "uniswap-v2-swapExactTokensForTokens",
  "name": "Uniswap V2 swapExactTokensForTokens",
  "schema": "swap",
  "match": {
    "source": "ethereum",
    "domains": ["app.uniswap.org"],
    "method": "eth_sendTransaction",
    "to": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    "abi": [
      "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)"
    ]
  },
  "extract": {
    "static": {
      "chainIn": 1,
      "chainOut": 1
    },
    "fields": {
      "tokenIn":      "$decoded.path[0]",
      "tokenOut":     "$decoded.path[-1]",
      "amountIn":     "$decoded.amountIn",
      "amountOut":    "$decoded.amountOutMin",
      "amountOutMin": "$decoded.amountOutMin",
      "toAddress":    "$decoded.to",
      "fromAddress":  "$params[0].from"
    }
  }
}
```

Notes:

- The `to` filter is **case-insensitive** and required in practice — function
  selectors are 4 bytes and collide across contracts, so without scoping you
  risk decoding bytes from an unrelated contract that happens to start with
  the same selector.
- The `chainId` of the call isn't visible from the EIP-1193 frame, so
  `chainIn`/`chainOut` come from `static` and are pinned to whatever chain
  the contract `to` lives on. A multi-chain protocol needs one template per
  chain (or per router address).
- `bigint` outputs from viem are stringified losslessly when assigned to
  string fields (`amountIn`, etc.) and `Number()`-coerced for `chainIn`/
  `chainOut`.
- ABIs are parsed once per JSON import (memoized by reference), not per
  call — adding ABI-using templates is essentially free at runtime.
- Live example: `src/templates/uniswap-v2.json`.
