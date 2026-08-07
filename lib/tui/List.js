/**
 * Full-screen list (ccstatusline-style): ↑↓, Enter, optional ESC back.
 * Items: { label, value, sublabel?, description?, disabled? } or '-' separator.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { h } from './h.js';

/**
 * @typedef {{
 *   label: string,
 *   value: any,
 *   sublabel?: string,
 *   description?: string,
 *   disabled?: boolean,
 * }} ListEntry
 */

/**
 * @param {{
 *   items: (ListEntry|'-')[],
 *   onSelect: (value: any, index: number) => void,
 *   onBack?: () => void,
 *   initialIndex?: number,
 *   showBack?: boolean,
 * }} props
 */
export function List({ items, onSelect, onBack, initialIndex = 0, showBack = false }) {
  const allItems = useMemo(() => {
    if (showBack) return [...items, '-', { label: '← Back', value: '__back__' }];
    return items;
  }, [items, showBack]);

  const selectable = useMemo(
    () => allItems.filter((it) => it !== '-' && !it.disabled),
    [allItems],
  );

  const [sel, setSel] = useState(() =>
    Math.min(initialIndex, Math.max(selectable.length - 1, 0)),
  );

  useEffect(() => {
    setSel((i) => Math.min(i, Math.max(selectable.length - 1, 0)));
  }, [selectable.length]);

  const selectedEntry = selectable[sel];
  const visualIndex = allItems.findIndex((it) => it === selectedEntry);

  useInput((input, key) => {
    if (key.escape && onBack) {
      onBack();
      return;
    }
    if (key.upArrow) {
      setSel((i) => (i <= 0 ? selectable.length - 1 : i - 1));
      return;
    }
    if (key.downArrow) {
      setSel((i) => (i >= selectable.length - 1 ? 0 : i + 1));
      return;
    }
    if (key.return && selectedEntry) {
      if (selectedEntry.value === '__back__') {
        onBack?.();
      } else {
        onSelect(selectedEntry.value, sel);
      }
    }
  });

  return h(
    Box,
    { flexDirection: 'column' },
    ...allItems.map((item, index) => {
      if (item === '-') {
        return h(Box, { key: `sep-${index}`, height: 1 }, h(Text, { dimColor: true }, ' '));
      }
      const isSelected = index === visualIndex;
      const color = item.disabled ? 'gray' : isSelected ? 'cyan' : undefined;
      return h(
        Box,
        { key: `item-${index}`, flexDirection: 'row' },
        h(
          Text,
          { color, bold: isSelected, dimColor: item.disabled && !isSelected },
          `${isSelected ? '▶  ' : '   '}${item.label}`,
        ),
        item.sublabel
          ? h(Text, { dimColor: !isSelected, color: isSelected ? 'cyan' : undefined }, `  ${item.sublabel}`)
          : null,
      );
    }),
    selectedEntry?.description
      ? h(
          Box,
          { marginTop: 1, paddingLeft: 3 },
          h(Text, { dimColor: true, wrap: 'wrap' }, selectedEntry.description),
        )
      : null,
  );
}
