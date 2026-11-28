import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BreakpointManager } from "../components/debug/BreakpointManager.js";
import type { TraceNode } from "../types/trace.js";

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTRACT_ID =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

function makeTraceNode(functionName: string): TraceNode {
  return {
    id: `node-${functionName}`,
    contractId: CONTRACT_ID,
    functionName,
    depth: 0,
    status: "ok",
    gasUsed: 100,
    children: [],
  };
}

function addBreakpoint(fnName: string) {
  const input = screen.getByLabelText(/new breakpoint function name/i);
  fireEvent.change(input, { target: { value: fnName } });
  fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BreakpointManager", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it("renders with no breakpoints initially", () => {
    render(<BreakpointManager contractId={CONTRACT_ID} />);
    expect(screen.getByText(/no breakpoints set/i)).toBeInTheDocument();
  });

  it("adds a breakpoint via the input field", async () => {
    render(<BreakpointManager contractId={CONTRACT_ID} />);
    addBreakpoint("transfer");
    await waitFor(() => {
      expect(screen.getByText("transfer")).toBeInTheDocument();
    });
  });

  it("adds a breakpoint by pressing Enter", async () => {
    render(<BreakpointManager contractId={CONTRACT_ID} />);
    const input = screen.getByLabelText(/new breakpoint function name/i);
    fireEvent.change(input, { target: { value: "contribute" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(screen.getByText("contribute")).toBeInTheDocument();
    });
  });

  it("persists breakpoints to localStorage", async () => {
    render(<BreakpointManager contractId={CONTRACT_ID} />);
    addBreakpoint("stake");
    await waitFor(() => {
      expect(screen.getByText("stake")).toBeInTheDocument();
    });
    const stored = localStorageMock.getItem(
      `dripswave:breakpoints:${CONTRACT_ID}`
    );
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(Object.keys(parsed)).toContain(`${CONTRACT_ID}::stake`);
  });

  it("restores breakpoints from localStorage on mount", async () => {
    // Pre-populate storage
    const key = `${CONTRACT_ID}::transfer`;
    const bp = {
      [key]: {
        key,
        contractId: CONTRACT_ID,
        functionName: "transfer",
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    };
    localStorageMock.setItem(
      `dripswave:breakpoints:${CONTRACT_ID}`,
      JSON.stringify(bp)
    );

    render(<BreakpointManager contractId={CONTRACT_ID} />);
    expect(await screen.findByText("transfer")).toBeInTheDocument();
  });

  it("removes a breakpoint", async () => {
    render(<BreakpointManager contractId={CONTRACT_ID} />);
    addBreakpoint("unstake");
    await waitFor(() =>
      expect(screen.getByText("unstake")).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole("button", { name: /remove breakpoint for unstake/i })
    );
    await waitFor(() => {
      expect(screen.queryByText("unstake")).not.toBeInTheDocument();
    });
  });

  it("toggles a breakpoint on/off", async () => {
    render(<BreakpointManager contractId={CONTRACT_ID} />);
    addBreakpoint("vote");
    await waitFor(() =>
      expect(screen.getByText("vote")).toBeInTheDocument()
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /disable breakpoint for vote/i,
    });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", { name: /enable breakpoint for vote/i })
      ).not.toBeChecked();
    });
  });

  it("shows the confirmation dialog when Clear all is clicked", async () => {
    render(<BreakpointManager contractId={CONTRACT_ID} />);
    addBreakpoint("fn_a");
    await waitFor(() =>
      expect(screen.getByText("fn_a")).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole("button", { name: /clear all breakpoints/i })
    );
    expect(
      screen.getByRole("dialog", { name: /confirm clear all/i })
    ).toBeInTheDocument();
  });

  it("clears all breakpoints after confirmation", async () => {
    render(<BreakpointManager contractId={CONTRACT_ID} />);
    addBreakpoint("fn_a");
    addBreakpoint("fn_b");
    await waitFor(() =>
      expect(screen.getAllByRole("checkbox").length).toBe(2)
    );

    fireEvent.click(
      screen.getByRole("button", { name: /clear all breakpoints/i })
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^clear all$/i }));

    await waitFor(() => {
      expect(screen.getByText(/no breakpoints set/i)).toBeInTheDocument();
    });
    expect(
      localStorageMock.getItem(`dripswave:breakpoints:${CONTRACT_ID}`)
    ).toBeNull();
  });

  it("cancels the clear all dialog", async () => {
    render(<BreakpointManager contractId={CONTRACT_ID} />);
    addBreakpoint("fn_x");
    await waitFor(() =>
      expect(screen.getByText("fn_x")).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole("button", { name: /clear all breakpoints/i })
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByText("fn_x")).toBeInTheDocument();
  });

  it("reconciles breakpoints against trace nodes on mount", async () => {
    // Pre-populate with two breakpoints, only one in the trace
    const keyA = `${CONTRACT_ID}::transfer`;
    const keyB = `${CONTRACT_ID}::defunct`;
    const stored = {
      [keyA]: {
        key: keyA,
        contractId: CONTRACT_ID,
        functionName: "transfer",
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      [keyB]: {
        key: keyB,
        contractId: CONTRACT_ID,
        functionName: "defunct",
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    };
    localStorageMock.setItem(
      `dripswave:breakpoints:${CONTRACT_ID}`,
      JSON.stringify(stored)
    );

    const nodes = [makeTraceNode("transfer")]; // "defunct" not in trace
    render(
      <BreakpointManager contractId={CONTRACT_ID} traceNodes={nodes} />
    );

    await waitFor(() => {
      expect(screen.getByText("transfer")).toBeInTheDocument();
      expect(screen.queryByText("defunct")).not.toBeInTheDocument();
    });
  });

  it("does not add duplicate breakpoints", async () => {
    render(<BreakpointManager contractId={CONTRACT_ID} />);
    addBreakpoint("transfer");
    await waitFor(() =>
      expect(screen.getByText("transfer")).toBeInTheDocument()
    );
    addBreakpoint("transfer");
    await waitFor(() => {
      const rows = screen.getAllByTestId(/breakpoint-row/);
      expect(rows.length).toBe(1);
    });
  });
});
