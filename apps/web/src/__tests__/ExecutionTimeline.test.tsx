import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecutionTimeline } from "../components/trace/ExecutionTimeline.js";
import type { TraceNode } from "../types/trace.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<TraceNode> & { id: string }): TraceNode {
  return {
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    functionName: "transfer",
    depth: 0,
    status: "ok",
    gasUsed: 1234,
    result: undefined,
    children: [],
    ...overrides,
  };
}

function makeNodes(count: number): TraceNode[] {
  return Array.from({ length: count }, (_, i) =>
    makeNode({
      id: `node-${i}`,
      functionName: `fn_${i}`,
      depth: i % 5,
      gasUsed: i * 100,
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExecutionTimeline", () => {
  it("renders an empty state when no nodes are provided", () => {
    render(<ExecutionTimeline nodes={[]} />);
    expect(screen.getByText(/no trace data/i)).toBeInTheDocument();
  });

  it("renders the listbox container when nodes are provided", () => {
    const nodes = makeNodes(5);
    render(<ExecutionTimeline nodes={nodes} />);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("calls onSelectNode when a node row is clicked", () => {
    const nodes = makeNodes(3);
    const onSelect = vi.fn();
    render(<ExecutionTimeline nodes={nodes} onSelectNode={onSelect} />);

    const listbox = screen.getByRole("listbox");
    // The virtualiser renders at least the first few rows
    const options = within(listbox).getAllByRole("option");
    fireEvent.click(options[0]);

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(nodes[0]);
  });

  it("highlights the selected node", () => {
    const nodes = makeNodes(3);
    render(
      <ExecutionTimeline nodes={nodes} selectedNodeId="node-1" />
    );
    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    const selected = options.find(
      (el) => el.getAttribute("aria-selected") === "true"
    );
    expect(selected).toBeDefined();
    expect(selected?.getAttribute("data-node-id")).toBe("node-1");
  });

  it("navigates down with ArrowDown key", () => {
    const nodes = makeNodes(5);
    const onSelect = vi.fn();
    render(
      <ExecutionTimeline
        nodes={nodes}
        selectedNodeId="node-0"
        onSelectNode={onSelect}
      />
    );
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    expect(onSelect).toHaveBeenCalledWith(nodes[1]);
  });

  it("navigates up with ArrowUp key", () => {
    const nodes = makeNodes(5);
    const onSelect = vi.fn();
    render(
      <ExecutionTimeline
        nodes={nodes}
        selectedNodeId="node-2"
        onSelectNode={onSelect}
      />
    );
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowUp" });

    expect(onSelect).toHaveBeenCalledWith(nodes[1]);
  });

  it("jumps to first node with Home key", () => {
    const nodes = makeNodes(5);
    const onSelect = vi.fn();
    render(
      <ExecutionTimeline
        nodes={nodes}
        selectedNodeId="node-3"
        onSelectNode={onSelect}
      />
    );
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "Home" });

    expect(onSelect).toHaveBeenCalledWith(nodes[0]);
  });

  it("jumps to last node with End key", () => {
    const nodes = makeNodes(5);
    const onSelect = vi.fn();
    render(
      <ExecutionTimeline
        nodes={nodes}
        selectedNodeId="node-0"
        onSelectNode={onSelect}
      />
    );
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "End" });

    expect(onSelect).toHaveBeenCalledWith(nodes[4]);
  });

  it("does not go below index 0 on ArrowUp from first item", () => {
    const nodes = makeNodes(3);
    const onSelect = vi.fn();
    render(
      <ExecutionTimeline
        nodes={nodes}
        selectedNodeId="node-0"
        onSelectNode={onSelect}
      />
    );
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowUp" });
    // Index would stay at 0, same node — onSelectNode is not called for no-op
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("mounts a 500-node trace within a 300 ms render budget", () => {
    const nodes = makeNodes(500);
    const start = performance.now();
    const { unmount } = render(<ExecutionTimeline nodes={nodes} />);
    const elapsed = performance.now() - start;
    unmount();

    // The virtualiser must keep the initial mount fast regardless of node count.
    expect(elapsed).toBeLessThan(300);
  });
});
