# Dapp Templates

Templates are JSON files that tell the extension how to extract a normalized
event (e.g. a `Swap`) from a dapp's API traffic. The data files live in
`src/templates/` (alongside `registry.ts`), and the engine that interprets
them lives in `src/template-engine/`.

## Pipeline

Templates run in the **MAIN-world content script** (the page context) on the
**response** phase of an intercepted `fetch`/XHR call. A template that matches
emits one or more typed events (currently `SwapEvent`) over the comctx channel
to the background.

```
fetch/XHR response  ──►  template engine  ──►  SwapEvent[]
                            │
                            └─ runs templates from src/templates/
```

Matching is gated by three cheap checks (page host, HTTP method, URL regex)
before any JSON parsing happens, so templates are safe to add liberally.

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

| Field         | Type       | Notes |
|---------------|------------|-------|
| `domains`     | `string[]` | Page domains the template applies to. Matched against `window.location.host`. A template fires when host equals one of these or is a subdomain of one (`app.jumper.xyz` matches `jumper.xyz`). |
| `method`      | `string?`  | HTTP method. Optional; case-sensitive. |
| `urlPattern`  | `string`   | JavaScript regex (string-form), tested against the full request URL. |

A template only runs if **all** match conditions pass. Anything stricter
(headers, body shape, etc.) can be expressed by tightening `urlPattern` or by
relying on path resolution to fail in `fields` (which silently drops the
event).

### Extract block

| Field      | Type                       | Notes |
|------------|----------------------------|-------|
| `iterate`  | `string?`                  | A path that resolves to an array. When present, the engine emits one event per element, with that element bound to `$item` for the duration of `fields` evaluation. When absent, exactly one event is considered. |
| `fields`   | `Record<string,string>`    | Maps each schema field name to a path expression. |

If a required schema field is missing or its path resolves to `undefined`, the
event is dropped silently. Optional fields are simply omitted from the output.

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

| Source     | Available when                                | Value |
|------------|-----------------------------------------------|-------|
| `$request` | request had a body                            | `JSON.parse(requestBody)` (or `undefined` if not JSON) |
| `$response`| response had a body                           | `JSON.parse(responseBody)` (or `undefined` if not JSON) |
| `$url`     | always                                        | `{ host, path, full, search: { [k]: string } }` |
| `$method`  | always                                        | HTTP method string |
| `$item`    | only inside a template that uses `iterate`    | the current array element |

### Operators

- `.foo` — object property access.
- `[N]` — numeric array index (zero-based).

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
| `provider`     | string  | no       | display name of the routing/aggregator step (e.g. `"Squid"`, `"CCTPv2 + Mayan"`) |

`chainIn` / `chainOut` are coerced to numbers; the other fields to strings. A
path that resolves to `null`/`undefined` simply omits the field — and if it's
a required one, the event is dropped entirely (no partial swaps).

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

## Adding a new dapp

1. Create `src/templates/<dapp>.json`.
2. Append it to the `registry` array in `src/templates/registry.ts`:
   ```ts
   import dapp from "./dapp.json";
   export const registry: Template[] = [jumper as Template, dapp as Template];
   ```
3. Reload the extension. New events appear in the background console as
   `[maru swap] …` or `[maru bridge] …`.

When working out the field paths, the easiest workflow is to capture a real
request/response (e.g. with the network panel or `curl`), then iterate on the
template against that fixture.
