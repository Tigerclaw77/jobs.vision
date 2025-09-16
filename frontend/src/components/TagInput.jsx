// components/TagInput.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "../styles/forms.css";

/**
 * Multi-select Tag Input with searchable dropdown.
 *
 * Accepted props (all optional/defensive):
 * - value: string[]                    // canonical tag ids (controlled). Falls back to []
 * - onChange(nextIds: string[])        // if omitted, internal no-op to avoid crashes
 * - options: { id, label }[] | string[]  // preferred source of choices
 * - tags:    { id, label }[] | string[]  // legacy alias (will be normalized)
 * - maxSelected?: number
 * - placeholder?: string
 * - disabled?: boolean
 */
export default function TagInput(props) {
  const {
    value: valueProp,
    onChange: onChangeProp,
    options: optionsProp,
    tags: tagsProp, // ← legacy/alt prop name
    maxSelected,
    placeholder = "Search approved tags…",
    disabled = false,
  } = props ?? {};

  // ---------- Normalizers (defensive) ----------
  const normalizeOptions = useCallback((arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") {
          const s = item.trim();
          if (!s) return null;
          return { id: s, label: s };
        }
        const id = String(item.id ?? "").trim();
        const label = String(item.label ?? item.name ?? item.title ?? item.id ?? "").trim();
        if (!id || !label) return null;
        return { id, label };
      })
      .filter(Boolean);
  }, []);

  const options = useMemo(
    () => normalizeOptions(optionsProp ?? tagsProp ?? []),
    [optionsProp, tagsProp, normalizeOptions]
  );

  const value = useMemo(() => (Array.isArray(valueProp) ? valueProp.filter(Boolean) : []), [valueProp]);

  // onChange fallback to avoid runtime crashes if not provided
  const onChange = useCallback((next) => {
    if (typeof onChangeProp === "function") {
      onChangeProp(next);
    } else {
      // no-op: still keep UX responsive without throwing
      // (You can log or warn here if desired)
    }
  }, [onChangeProp]);

  // ---------- UI state ----------
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const cx = (...xs) => xs.filter(Boolean).join(" ");

  // Maps & selected
  const byId = useMemo(() => {
    const m = new Map();
    for (const opt of options) m.set(opt.id, opt);
    return m;
  }, [options]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  // Keep only known ids (defensive against stale/unknown ids)
  const selectedOptions = useMemo(
    () => value.map((id) => byId.get(id)).filter(Boolean),
    [value, byId]
  );

  const canAddMore =
    typeof maxSelected === "number" ? selectedOptions.length < maxSelected : true;

  // Filtered list (exclude already selected)
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const base = options.filter((o) => !selectedSet.has(o.id));
    if (!q) return base.slice(0, 250);
    return base.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 250);
  }, [options, selectedSet, query]);

  // Maintain active index sanity
  useEffect(() => {
    if (!open) return;
    if (filtered.length === 0) {
      setActiveIndex(-1);
    } else if (activeIndex < 0 || activeIndex >= filtered.length) {
      setActiveIndex(0);
    }
  }, [filtered, open, activeIndex]);

  // Click-outside to close
  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Keep active item visible
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    if (el && el.scrollIntoView) {
      const parent = listRef.current;
      const elTop = el.offsetTop;
      const elBottom = elTop + el.offsetHeight;
      const viewTop = parent.scrollTop;
      const viewBottom = viewTop + parent.clientHeight;
      if (elTop < viewTop || elBottom > viewBottom) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, open]);

  // ---------- Actions ----------
  const addTag = useCallback(
    (opt) => {
      if (!opt || selectedSet.has(opt.id)) return;
      if (!canAddMore) return;
      const next = [...value, opt.id];
      onChange(next);
      setQuery("");
      setOpen(true);
      setActiveIndex(0);
      inputRef.current?.focus();
    },
    [selectedSet, canAddMore, value, onChange]
  );

  const removeTag = useCallback(
    (id) => {
      if (!selectedSet.has(id)) return;
      const next = value.filter((x) => x !== id);
      onChange(next);
      inputRef.current?.focus();
    },
    [selectedSet, value, onChange]
  );

  const clearAll = useCallback(() => {
    if (selectedOptions.length === 0) return;
    onChange([]);
    inputRef.current?.focus();
  }, [selectedOptions.length, onChange]);

  const onKeyDown = (e) => {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        if (filtered.length > 0) {
          setActiveIndex((i) => Math.min((i < 0 ? -1 : i) + 1, filtered.length - 1));
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (!open) setOpen(true);
        if (filtered.length > 0) {
          setActiveIndex((i) => Math.max((i < 0 ? filtered.length : i) - 1, 0));
        }
        break;

      case "Enter":
        if (open && activeIndex >= 0 && activeIndex < filtered.length) {
          e.preventDefault();
          addTag(filtered[activeIndex]);
        }
        break;

      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;

      case "Backspace":
        if (query === "" && selectedOptions.length > 0) {
          removeTag(selectedOptions[selectedOptions.length - 1].id);
        }
        break;

      default:
        break;
    }
  };

  const listboxId = "taginput-listbox";
  const activeOpt = open && activeIndex >= 0 ? filtered[activeIndex] : null;
  const activeDescId = activeOpt ? `tagopt-${activeOpt.id}` : undefined;

  return (
    <div
      ref={rootRef}
      className={cx("tag-input-root", disabled && "opacity-60 pointer-events-none")}
    >
      {/* Selected chips */}
      {selectedOptions.length > 0 && (
        <div className="tag-chip-row">
          {selectedOptions.map((opt) => (
            <span key={opt.id} className="tag-chip">
              <span className="tag-chip-label">{opt.label}</span>
              <button
                type="button"
                className="tag-chip-x"
                aria-label={`Remove ${opt.label}`}
                onClick={() => removeTag(opt.id)}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            className="tag-chip-clear"
            onClick={clearAll}
            aria-label="Clear all"
            title="Clear all"
          >
            Clear
          </button>
        </div>
      )}

      {/* Combobox input */}
      <div
        className={cx("tag-input-wrap", open && "is-open", !canAddMore && "is-maxed")}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={
            !canAddMore && selectedOptions.length > 0
              ? `Max ${maxSelected} selected`
              : placeholder
          }
          className="tag-input"
          aria-autocomplete="list"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeDescId}
          disabled={disabled || !canAddMore}
        />
        <button
          type="button"
          className="tag-caret"
          aria-label={open ? "Close" : "Open"}
          onClick={(e) => {
            e.stopPropagation();
            if (disabled) return;
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
        >
          ▾
        </button>
      </div>

      {/* Dropdown list */}
      {open && (
        <div className="tag-listbox-wrap">
          <ul id={listboxId} ref={listRef} role="listbox" className="tag-listbox">
            {filtered.length === 0 ? (
              <li className="tag-empty" aria-disabled="true">
                {query ? "No matches" : "Start typing to search…"}
              </li>
            ) : (
              filtered.map((opt, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={opt.id}
                    id={`tagopt-${opt.id}`}
                    data-index={idx}
                    role="option"
                    aria-selected={isActive}
                    className={cx("tag-option", isActive && "is-active")}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addTag(opt)}
                  >
                    <MatchHighlighter text={opt.label} query={query} />
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function MatchHighlighter({ text, query }) {
  if (!query) return <span>{text}</span>;
  const q = (query || "").trim();
  if (!q) return <span>{text}</span>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <span>{text}</span>;
  const before = text.slice(0, i);
  const match = text.slice(i + 0, i + q.length);
  const after = text.slice(i + q.length);
  return (
    <span>
      {before}
      <mark className="tag-match">{match}</mark>
      {after}
    </span>
  );
}
