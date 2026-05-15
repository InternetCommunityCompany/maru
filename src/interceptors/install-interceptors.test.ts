import { describe, expect, it, vi } from "vitest";
import type { InterceptedEvent } from "./types";

vi.mock("./fetch", () => ({ installFetchInterceptor: vi.fn() }));
vi.mock("./xhr", () => ({ installXhrInterceptor: vi.fn() }));
vi.mock("./ethereum", () => ({ installEthereumInterceptor: vi.fn() }));

const { installInterceptors } = await import("./install-interceptors");
const { installFetchInterceptor } = await import("./fetch");
const { installXhrInterceptor } = await import("./xhr");
const { installEthereumInterceptor } = await import("./ethereum");

describe("installInterceptors", () => {
  it("installs the fetch, xhr, and ethereum interceptors against one emit", () => {
    const emit = vi.fn<(e: InterceptedEvent) => void>();

    installInterceptors(emit);

    expect(installFetchInterceptor).toHaveBeenCalledTimes(1);
    expect(installFetchInterceptor).toHaveBeenCalledWith(emit);
    expect(installXhrInterceptor).toHaveBeenCalledTimes(1);
    expect(installXhrInterceptor).toHaveBeenCalledWith(emit);
    expect(installEthereumInterceptor).toHaveBeenCalledTimes(1);
    expect(installEthereumInterceptor).toHaveBeenCalledWith(emit);
  });
});
