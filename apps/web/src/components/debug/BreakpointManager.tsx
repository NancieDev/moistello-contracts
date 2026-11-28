import React, { useState, useEffect, useCallback } from "react";
import { useBreakpoints, type Breakpoint } from "../../hooks/useBreakpoints.js";
import { useToast } from "../../hooks/useToast.js";
import type { TraceNode } from "../../types/trace.js";

interface BreakpointManagerProps {
  /** The decoded contract id whose breakpoints are managed. */
  contractId: string;
  /** Current trace nodes — used to reconcile stale breakpoints on mount. */
  traceNodes?: TraceNode[];
  onBreakpointHit?: (bp: Breakpoint) => void;
}

/**
 * Manage, persist, and display breakpoints for a Soroban contract.
 *
 * Breakpoints are persisted to localStorage keyed by contractId so they
 * survive page refreshes. On mount they are reconciled against the current
 * trace: any breakpoint whose function no longer appears in the trace is
 * silently dropped.
 *
 * "Clear all" shows a confirmation dialog before wiping storage.
 */
export function BreakpointManager({
  contractId,
  traceNodes = [],
  onBreakpointHit,
}: BreakpointManagerProps) {
  const {
    breakpoints,
    addBreakpoint,
    removeBreakpoint,
    toggleBreakpoint,
    clearAll,
    reconcile,
  } = useBreakpoints(contractId);

  const { showToast } = useToast();

  const [newFunctionName, setNewFunctionName] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  // Reconcile against the current trace whenever traceNodes or contractId changes
  useEffect(() => {
    if (traceNodes.length > 0) {
      reconcile(traceNodes);
    }
  }, [traceNodes, reconcile]);

  const handleAdd = useCallback(() => {
    const name = newFunctionName.trim();
    if (!name) return;
    addBreakpoint(contractId, name);
    setNewFunctionName("");
    showToast(`Breakpoint added for "${name}"`, "success");
  }, [newFunctionName, contractId, addBreakpoint, showToast]);

  const handleToggle = useCallback(
    (key: string, currentlyEnabled: boolean) => {
      toggleBreakpoint(key);
      showToast(
        currentlyEnabled ? "Breakpoint disabled" : "Breakpoint enabled",
        "info"
      );
    },
    [toggleBreakpoint, showToast]
  );

  const handleRemove = useCallback(
    (key: string, functionName: string) => {
      removeBreakpoint(key);
      showToast(`Removed breakpoint for "${functionName}"`, "info");
    },
    [removeBreakpoint, showToast]
  );

  const handleClearAll = useCallback(() => {
    clearAll();
    setConfirmClear(false);
    showToast("All breakpoints cleared", "success");
  }, [clearAll, showToast]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleAdd();
    },
    [handleAdd]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
      }}
      data-testid="breakpoint-manager"
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          Breakpoints
          {breakpoints.length > 0 && (
            <span
              style={{
                marginLeft: 6,
                background: "#6366f1",
                color: "#fff",
                borderRadius: 10,
                padding: "1px 7px",
                fontSize: 11,
              }}
            >
              {breakpoints.length}
            </span>
          )}
        </h3>

        {breakpoints.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            aria-label="Clear all breakpoints"
            style={{
              fontSize: 12,
              color: "#ef4444",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Confirm clear dialog */}
      {confirmClear && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm clear all breakpoints"
          style={{
            padding: 12,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 6,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <p style={{ margin: 0, fontSize: 13 }}>
            Remove all {breakpoints.length} breakpoint
            {breakpoints.length !== 1 ? "s" : ""}? This cannot be undone.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleClearAll}
              style={{
                padding: "4px 12px",
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Clear all
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              style={{
                padding: "4px 12px",
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add breakpoint */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={newFunctionName}
          onChange={(e) => setNewFunctionName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="function name (e.g. transfer)"
          aria-label="New breakpoint function name"
          style={{
            flex: 1,
            padding: "5px 8px",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: 12,
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newFunctionName.trim()}
          style={{
            padding: "5px 12px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            opacity: newFunctionName.trim() ? 1 : 0.5,
          }}
        >
          Add
        </button>
      </div>

      {/* Breakpoint list */}
      {breakpoints.length === 0 ? (
        <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>
          No breakpoints set. Add a function name above.
        </p>
      ) : (
        <ul
          style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}
          aria-label="Breakpoint list"
        >
          {breakpoints.map((bp) => (
            <li
              key={bp.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 8px",
                background: bp.enabled ? "#f0fdf4" : "#f9fafb",
                border: `1px solid ${bp.enabled ? "#86efac" : "#e5e7eb"}`,
                borderRadius: 4,
                opacity: bp.enabled ? 1 : 0.65,
              }}
              data-testid={`breakpoint-row-${bp.key}`}
            >
              {/* Enable/disable toggle */}
              <input
                type="checkbox"
                checked={bp.enabled}
                onChange={() => handleToggle(bp.key, bp.enabled)}
                aria-label={`${bp.enabled ? "Disable" : "Enable"} breakpoint for ${bp.functionName}`}
                style={{ cursor: "pointer" }}
              />
              <span
                style={{
                  flex: 1,
                  fontFamily: "monospace",
                  fontSize: 12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {bp.functionName}
              </span>
              <button
                onClick={() => handleRemove(bp.key, bp.functionName)}
                aria-label={`Remove breakpoint for ${bp.functionName}`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: "0 2px",
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
