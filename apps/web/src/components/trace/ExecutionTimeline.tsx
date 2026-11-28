import React, { useRef, useCallback, KeyboardEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TraceNode } from "../../types/trace.js";

interface ExecutionTimelineProps {
  nodes: TraceNode[];
  /** Currently selected node id. */
  selectedNodeId?: string;
  onSelectNode?: (node: TraceNode) => void;
}

const NODE_HEIGHT = 48; // px — fixed row height enables O(1) virtualiser math

function NodeRow({
  node,
  isSelected,
  onSelect,
}: {
  node: TraceNode;
  isSelected: boolean;
  onSelect: (node: TraceNode) => void;
}) {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      onClick={() => onSelect(node)}
      style={{
        height: NODE_HEIGHT,
        paddingLeft: `${node.depth * 16 + 8}px`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        background: isSelected ? "var(--color-selected, #2563eb22)" : "transparent",
        borderBottom: "1px solid var(--color-border, #e5e7eb)",
        fontFamily: "monospace",
        fontSize: 13,
        userSelect: "none",
      }}
      data-node-id={node.id}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          flexShrink: 0,
          background:
            node.status === "ok"
              ? "#22c55e"
              : node.status === "error"
              ? "#ef4444"
              : "#f59e0b",
        }}
      />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ color: "var(--color-contract, #6366f1)", marginRight: 4 }}>
          {node.contractId.slice(0, 8)}…
        </span>
        {node.functionName}
      </span>
      <span style={{ color: "var(--color-muted, #6b7280)", flexShrink: 0 }}>
        {node.gasUsed.toLocaleString()} gas
      </span>
    </div>
  );
}

/**
 * Virtualised timeline of Soroban execution trace nodes.
 *
 * Uses @tanstack/react-virtual to render only the visible rows, keeping
 * DOM node count constant regardless of trace depth (tested to 500+ nodes).
 *
 * Keyboard navigation:
 *   ArrowUp / ArrowDown — move selection one row
 *   Home / End          — jump to first / last row
 *   Enter               — confirm selection
 */
export function ExecutionTimeline({
  nodes,
  selectedNodeId,
  onSelectNode,
}: ExecutionTimelineProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: nodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => NODE_HEIGHT,
    overscan: 5,
  });

  const selectedIndex = nodes.findIndex((n) => n.id === selectedNodeId);

  const handleSelect = useCallback(
    (node: TraceNode) => {
      onSelectNode?.(node);
    },
    [onSelectNode]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const count = nodes.length;
      if (count === 0) return;

      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          nextIndex = Math.min(selectedIndex + 1, count - 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          nextIndex = Math.max(selectedIndex - 1, 0);
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = count - 1;
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0) {
            onSelectNode?.(nodes[selectedIndex]);
          }
          return;
      }

      if (nextIndex !== null && nextIndex !== selectedIndex) {
        const node = nodes[nextIndex];
        onSelectNode?.(node);
        virtualizer.scrollToIndex(nextIndex, { align: "auto" });
      }
    },
    [nodes, selectedIndex, onSelectNode, virtualizer]
  );

  if (nodes.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 200,
          color: "var(--color-muted, #6b7280)",
          fontSize: 14,
        }}
      >
        No trace data. Run a replay to see the execution timeline.
      </div>
    );
  }

  const totalHeight = virtualizer.getTotalSize();
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      role="listbox"
      aria-label="Execution timeline"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        height: "100%",
        maxHeight: 600,
        overflowY: "auto",
        outline: "none",
        border: "1px solid var(--color-border, #e5e7eb)",
        borderRadius: 6,
      }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {virtualItems.map((virtualItem) => {
          const node = nodes[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <NodeRow
                node={node}
                isSelected={node.id === selectedNodeId}
                onSelect={handleSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
