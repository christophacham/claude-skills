/**
 * Multi-select checklist: space toggles, enter confirms, ESC cancels.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { h } from './h.js';

/**
 * @param {{
 *   title?: string,
 *   items: { id: string, label: string, hint?: string }[],
 *   initialSelected: Iterable<string>,
 *   onConfirm: (ids: string[]) => void,
 *   onCancel: () => void,
 *   onRequestFilter?: (ids: string[]) => void,
 *   filterActive?: boolean,
 * }} props
 */
export function MultiCheck({
  title,
  items,
  initialSelected,
  onConfirm,
  onCancel,
  onRequestFilter,
  filterActive = false,
}) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [cursor, setCursor] = useState(0);

  const ids = useMemo(() => items.map((i) => i.id), [items]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(items.length - 1, 0)));
  }, [items.length]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow) {
      setCursor((c) => (c <= 0 ? items.length - 1 : c - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((c) => (c >= items.length - 1 ? 0 : c + 1));
      return;
    }
    // Optional filter — pass draft selection so parent can reseed after TextPrompt
    if (input === '/' && onRequestFilter) {
      onRequestFilter([...selected]);
      return;
    }
    if (input === ' ' || input === 'x') {
      const id = ids[cursor];
      if (!id) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    if (input === 'a') {
      setSelected(new Set(ids));
      return;
    }
    if (input === 'n') {
      setSelected(new Set());
      return;
    }
    if (key.return) {
      onConfirm([...selected]);
    }
  });

  const help = onRequestFilter
    ? '↑↓ move · space toggle · a all · n none · / filter · Enter confirm · ESC cancel'
    : '↑↓ move · space toggle · a all · n none · Enter confirm · ESC cancel';

  return h(
    Box,
    { flexDirection: 'column' },
    title
      ? h(Box, { marginBottom: 1 }, h(Text, { bold: true }, title))
      : null,
    h(Text, { dimColor: true }, help),
    filterActive
      ? h(Text, { color: 'yellow' }, `filter active · ${items.length} shown · / to change · empty filter = all`)
      : null,
    h(Box, { height: 1 }, h(Text, null, ' ')),
    items.length === 0
      ? h(Text, { color: 'yellow' }, 'No skills in this view.')
      : null,
    ...items.map((item, index) => {
      const on = selected.has(item.id);
      const isCursor = index === cursor;
      return h(
        Box,
        { key: item.id, flexDirection: 'row' },
        h(
          Text,
          { color: isCursor ? 'cyan' : undefined, bold: isCursor },
          `${isCursor ? '▶ ' : '  '}${on ? '[x]' : '[ ]'} ${item.label}`,
        ),
        item.hint
          ? h(Text, { dimColor: true }, `  ${item.hint}`)
          : null,
      );
    }),
  );
}
