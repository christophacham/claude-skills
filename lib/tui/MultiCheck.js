/**
 * Multi-select checklist: space toggles, enter confirms, ESC cancels.
 */
import { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { h } from './h.js';

/**
 * @param {{
 *   title?: string,
 *   items: { id: string, label: string, hint?: string }[],
 *   initialSelected: Iterable<string>,
 *   onConfirm: (ids: string[]) => void,
 *   onCancel: () => void,
 * }} props
 */
export function MultiCheck({ title, items, initialSelected, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [cursor, setCursor] = useState(0);

  const ids = useMemo(() => items.map((i) => i.id), [items]);

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
    if (input === ' ' || input === 'x') {
      const id = ids[cursor];
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

  return h(
    Box,
    { flexDirection: 'column' },
    title
      ? h(Box, { marginBottom: 1 }, h(Text, { bold: true }, title))
      : null,
    h(Text, { dimColor: true }, '↑↓ move · space toggle · a all · n none · Enter confirm · ESC cancel'),
    h(Box, { height: 1 }, h(Text, null, ' ')),
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
