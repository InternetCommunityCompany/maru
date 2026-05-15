// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { walkText } from "./walk-text";

const setBody = (html: string): void => {
  document.body.innerHTML = html;
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("walkText: basic traversal", () => {
  it("collects text nodes from the light DOM", () => {
    setBody(`<div>You receive <span class="amt">0.5</span> WETH</div>`);
    const snap = walkText();
    const texts = snap.map((s) => s.text.trim());
    expect(texts).toContain("0.5");
    expect(texts).toContain("WETH");
  });

  it("skips text inside <script>, <style>, <noscript>", () => {
    setBody(`
      <div>0.5</div>
      <script>const hidden = "1.23";</script>
      <style>.css { content: "9.99"; }</style>
      <noscript>0.42</noscript>
    `);
    const texts = walkText().map((s) => s.text);
    expect(texts.some((t) => t.includes("0.5"))).toBe(true);
    expect(texts.some((t) => t.includes("hidden"))).toBe(false);
    expect(texts.some((t) => t.includes(".css"))).toBe(false);
    expect(texts.some((t) => t.includes("0.42"))).toBe(false);
  });

  it("skips whitespace-only text nodes", () => {
    setBody(`<div>0.5</div>     <div>WETH</div>`);
    const snap = walkText();
    // No empty-text records.
    expect(snap.every((s) => s.text.trim().length > 0)).toBe(true);
  });
});

describe("walkText: ancestor-derived flags", () => {
  it("marks ariaSelected when an ancestor has aria-selected='true'", () => {
    setBody(
      `<li aria-selected="true"><div>Route A <span>0.5</span></div></li>`,
    );
    const snap = walkText();
    const hit = snap.find((s) => s.text.includes("0.5"));
    expect(hit?.ariaSelected).toBe(true);
  });

  it("marks ariaChecked when an ancestor is role=radio + aria-checked=true", () => {
    setBody(
      `<div role="radio" aria-checked="true"><span>0.5</span></div>`,
    );
    const snap = walkText();
    const hit = snap.find((s) => s.text.includes("0.5"));
    expect(hit?.ariaChecked).toBe(true);
  });

  it("does not mark ariaSelected when no ancestor declares it", () => {
    setBody(`<div><span>0.5</span></div>`);
    const snap = walkText();
    const hit = snap.find((s) => s.text.includes("0.5"));
    expect(hit?.ariaSelected).toBe(false);
    expect(hit?.ariaChecked).toBe(false);
  });

  it("populates contextText with surrounding label text", () => {
    setBody(
      `<div class="card">You receive <span>0.5</span> WETH for 1000 USDC</div>`,
    );
    const snap = walkText();
    const hit = snap.find((s) => s.text.trim() === "0.5");
    expect(hit?.contextText.toLowerCase()).toContain("you receive");
  });
});

describe("walkText: open shadow DOM", () => {
  it("descends into open shadow roots", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<span>shadow-value-0.5</span>`;
    const snap = walkText();
    const texts = snap.map((s) => s.text);
    expect(texts.some((t) => t.includes("shadow-value-0.5"))).toBe(true);
  });
});
