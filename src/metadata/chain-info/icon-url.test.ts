import { describe, expect, it } from "vitest";
import { resolveIconUrl } from "./icon-url";

describe("resolveIconUrl", () => {
  it("passes a full https URL through unchanged", () => {
    const url = "https://example.test/icons/chain.png";
    expect(resolveIconUrl(url)).toBe(url);
  });

  it("passes an http URL through unchanged", () => {
    const url = "http://example.test/icons/chain.png";
    expect(resolveIconUrl(url)).toBe(url);
  });

  it("passes an ipfs:// URL through unchanged — some upstream entries are pinned that way", () => {
    const url = "ipfs://bafy.../logo.png";
    expect(resolveIconUrl(url)).toBe(url);
  });

  it("passes an ipns:// URL through unchanged", () => {
    const url = "ipns://example/logo.png";
    expect(resolveIconUrl(url)).toBe(url);
  });

  it("passes a data: URI through unchanged", () => {
    const url = "data:image/svg+xml;base64,PHN2Zy8+";
    expect(resolveIconUrl(url)).toBe(url);
  });

  it("resolves a slug to the DefiLlama chain-icon CDN", () => {
    expect(resolveIconUrl("ethereum")).toBe(
      "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
    );
    expect(resolveIconUrl("arbitrum")).toBe(
      "https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg",
    );
    expect(resolveIconUrl("polygon")).toBe(
      "https://icons.llamao.fi/icons/chains/rsz_polygon.jpg",
    );
  });

  it("returns null for missing icon — alert overlay drops the badge silently", () => {
    expect(resolveIconUrl(undefined)).toBeNull();
    expect(resolveIconUrl("")).toBeNull();
    expect(resolveIconUrl("   ")).toBeNull();
  });

  it("trims whitespace before resolving", () => {
    expect(resolveIconUrl("  ethereum  ")).toBe(
      "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
    );
  });
});
