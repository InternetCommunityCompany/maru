import { type Abi, decodeFunctionData, parseAbi } from "viem";

export type DecodedCalldata = {
  functionName: string;
  args: Record<string, unknown>;
};

const abiCache = new WeakMap<readonly string[], Abi>();

const parseCached = (signatures: readonly string[]): Abi => {
  let parsed = abiCache.get(signatures);
  if (!parsed) {
    parsed = parseAbi(signatures as readonly [string, ...string[]]);
    abiCache.set(signatures, parsed);
  }
  return parsed;
};

/**
 * Decodes EVM calldata against a list of human-readable function signatures.
 *
 * Returns `null` for any failure (selector mismatch, malformed data, parse
 * error). On success, `args` is keyed by the parameter names from the ABI;
 * unnamed parameters are skipped. BigInts pass through as `bigint` — the
 * field coercer in `build-swap-event` stringifies them when assigning to
 * string fields.
 *
 * Parsed ABIs are memoized by reference, so a template's static `abi` array
 * (imported from JSON) is parsed at most once per session.
 */
export const decodeCalldata = (
  abiSignatures: readonly string[],
  data: string,
): DecodedCalldata | null => {
  if (!data || !data.startsWith("0x")) return null;
  try {
    const abi = parseCached(abiSignatures);
    const { functionName, args } = decodeFunctionData({
      abi,
      data: data as `0x${string}`,
    });
    const fn = abi.find(
      (item) => item.type === "function" && item.name === functionName,
    );
    const named: Record<string, unknown> = {};
    if (fn && "inputs" in fn) {
      fn.inputs.forEach((input, i) => {
        if (input.name) named[input.name] = (args as readonly unknown[])[i];
      });
    }
    return { functionName, args: named };
  } catch {
    return null;
  }
};
