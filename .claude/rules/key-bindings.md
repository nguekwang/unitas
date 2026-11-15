# Key binding rules

Rules for every key Unitas itself handles: default mappings, `map` lines in settings, and key handlers
in code (content script, main process, tab pages, every mode). Keys that Unitas passes through to a page
or a shell (typing in INSERT mode, Ctrl+C in a terminal) are not bindings and are not restricted.

## Allowed keys
- QWERTY letter keys: `a`-`z`, and with Shift: `A`-`Z`
- `,` `.` `/`, and with Shift: `<` `>` `?`
- Enter, but as little as possible (only to confirm typed input)
- Esc, only to leave the current mode (back to NORMAL). Never bind it to anything else.
  In a terminal Esc belongs to the shell, so Shift+Esc leaves INSERT there

## Forbidden
- Ctrl, Alt, Super (Meta, the Windows key) in any combination, and on their own
- Space
- F1-F12, Delete
- Digits, so no counts like `5j`
- Brackets of any kind: `(` `)` `[` `]` `{` `}`
- `:` (no Vim-style command-line key: commands are typed into the status bar after `o`)
- Any other symbol key (`;` `^` `$` `` ` `` `'` `-` `=` ...), including their Shift variants
- "Press twice quickly" gestures (double-tap Shift, `jk` typed fast, ...)

## Shape
- Stateless: one key, one command. No sequences such as `gg`, `yy`, `gi`, `<<`
- Exception: a key that picks a target may wait for one more key: a mark letter after `m` / `M`,
  a hint label after `f` / `F`
- Rare commands get no key: they are run by name from the status bar (`o`, then e.g. `w` to save)
- Fixed by the user: `j` / `k` scroll down / up, `J` / `K` next / previous tab

## Checking a new binding
1. Is every key in "Allowed keys"? Shift counts as allowed only together with an allowed key
2. Is it a single key (or a target-picking key plus one key)?
3. Does it clash with an existing binding in the same mode? Check `background/key-mappings.js` and the mode's handler
4. Would the command be better run from the status bar than given a key?
5. Settings must reject a `map` line that breaks these rules, with a message (see `background/key-mappings.js`)
