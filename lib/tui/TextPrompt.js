/**
 * Single-line text / password prompt for filter & API keys.
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { h } from './h.js';

/**
 * @param {{
 *   message: string,
 *   mask?: boolean,
 *   placeholder?: string,
 *   onSubmit: (value: string) => void,
 *   onCancel: () => void,
 * }} props
 */
export function TextPrompt({ message, mask = false, placeholder = '', onSubmit, onCancel }) {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.return) {
      onSubmit(value);
      return;
    }
    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      return;
    }
    if (key.ctrl && input === 'u') {
      setValue('');
      return;
    }
    // printable
    if (input && !key.ctrl && !key.meta && input.length === 1) {
      setValue((v) => v + input);
    }
  });

  const shown = mask ? '*'.repeat(value.length) : value;
  const display = shown || placeholder;

  return h(
    Box,
    { flexDirection: 'column' },
    h(Text, null, message),
    h(
      Box,
      { marginTop: 1 },
      h(Text, { color: 'cyan' }, `> ${display}`),
      h(Text, { dimColor: true }, shown ? '' : value ? '' : '  (empty)'),
    ),
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, 'Enter confirm · ESC cancel')),
  );
}
