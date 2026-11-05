import { act, renderHook } from "@testing-library/react";
import { onlineState, useOnline } from "./network";

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

describe("network", () => {
  afterEach(() => setOnLine(true));

  it("offers online rooms only when a server is set and the device is connected", () => {
    expect(onlineState("wss://x", true)).toBe("ready");
    expect(onlineState("wss://x", false)).toBe("offline");
    expect(onlineState(undefined, true)).toBe("soon");
  });

  it("follows the device going offline and back online", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
