---
name: simple-design
description: Module and API design judgment — deep modules, information hiding, general-purpose interfaces, error handling, naming. Use when designing or reviewing any class/module/function interface, judging whether a module is too shallow, deciding how general an API should be, simplifying error handling, naming things, or scanning for design red flags (shallow module, information leakage, temporal decomposition, pass-through method, vague name). Applies to nearly all coding work. Not for application layering/ports/DDD (architecture-design), service or monolith splitting (distributed-architecture), or step-by-step refactor mechanics (refactoring).
---

# Simple Design

Module-level design judgment from John Ousterhout's *A Philosophy of Software Design*. One goal: **reduce complexity**. Section 9 is the triage index; sections 1–8 carry the detail.

## 1. Complexity Is the Only Budget

Complexity is anything that makes software hard to understand or modify. Three symptoms:

- **Change amplification** — a simple change requires edits in many places.
- **Cognitive load** — you must know a lot to complete a task.
- **Unknown unknowns** — it isn't obvious which code to touch, or whether a change is safe. The worst symptom.

Causes: **dependencies** (code can't be understood or changed in isolation) and **obscurity** (important information isn't obvious). Complexity accumulates one "reasonable compromise" at a time — zero tolerance for the small stuff.

### Tactical vs strategic

Tactical: get it working ASAP, smallest possible change, "fix it later" — each task adds a little complexity and the codebase never recovers. Strategic: invest ~10–20% of dev time in design, so the design improves with every modification. Beware the "tactical tornado": a fast coder who leaves a wake of destruction.

**Strategic does not mean more architecture.** It means investing where change is *likely* — and nowhere else. An abstraction built for change you cannot name is speculation, not strategy. Beware the tactical tornado; equally beware the architecture astronaut.

### Design it twice

For any non-trivial module, sketch two **radically different** approaches (actually sketch, don't daydream), weigh interface simplicity, generality, ease of use — pick one or combine the best features. Even when one approach seems obvious, designing a second exposes what the first assumes.

### Modifying existing code

Finish each change so the system has the structure it *would have had* if designed from the start with that change in mind. If you aren't making the design better, you're probably making it worse. Increments should be **abstractions, not features** — once you need an abstraction, design it completely and somewhat general-purpose from the start. Don't let agile or TDD become an excuse for "tests first, design later."

## 2. Deep Modules

A module's **benefit** is its functionality; its **cost** is the complexity its interface imposes on the rest of the system. Deep modules maximize benefit per unit of interface cost. A simple interface matters more than a simple implementation — better for the module's developer to suffer than its users.

**Good example — Unix file I/O.** Five calls (`open`/`read`/`write`/`lseek`/`close`) hide hundreds of thousands of lines (disk representation, directories, permissions, caching, concurrent access). Sequential I/O is the default so the common case is trivial; most callers never learn `lseek`. If most users need only a few features, the interface's *effective* complexity is just those.

**Bad example — Java file I/O.** Three stacked objects to open a serialized file; two are never used again; callers must explicitly request buffering, which nearly everyone wants. Each class is shallow: interface complexity ≈ implementation complexity.

Small modules tend to be shallow — the "classes should be small" dogma ("classitis") produces large numbers of shallow classes that add net complexity.

### Five deepening techniques

1. **Combine related classes** — if they share information, or one wraps the other without adding value, merge them.
2. **Push complexity down** — absorb awkwardness inside the module instead of forcing every caller to handle it.
3. **Provide defaults** — do the right thing without being asked (automatic buffering); compute configuration parameters instead of pushing decisions to users.
4. **Raise the interface level** — one higher-level method instead of several low-level ones.
5. **Eliminate special cases** — design the normal case so edge conditions need no extra code (§4).

Other shallowness causes: over-specialized methods, exposing internals via getters/setters or returning internal data structures, pass-through methods that delegate without adding value.

## 3. Information Hiding

Each module encapsulates a few **design decisions** — knowledge embedded in the implementation but absent from its interface. Hide: data structures and algorithms, low-level details (buffer lengths), assumptions ("most files are small"), external formats (file formats, wire protocols), mechanisms (caching, threading). Hiding simplifies the interface and confines future changes to one module.

**Private ≠ hidden.** Fields exposed through getters/setters are just as exposed as public fields.

### Information leakage (red flag)

One design decision reflected in multiple modules — through interfaces, or through the back door (a reader class and a writer class that both know a file format, neither exposing it; worse, because invisible).

- **Test:** "If I change X, how many modules must change?" More than one → X leaked.
- **Fix:** merge the affected classes if they're small and tied to the knowledge; otherwise extract a class that owns just that knowledge — with a simple interface, or you've traded back-door leakage for interface leakage.

### Temporal decomposition (red flag)

Structuring modules by the *order* operations execute instead of by the knowledge each needs:

```
Bad:  RequestReader → RequestParser   (both must understand HTTP format)
Good: HttpRequest                    (reads AND parses; HTTP knowledge in one place)
```

Order will be reflected somewhere in the code, but it should not drive module structure. Focus on **what knowledge is needed to perform each task**.

Don't take hiding too far: information genuinely needed outside the module must be exposed. The goal is to *minimize* what the outside must know, not to hide at all costs.

## 4. General-Purpose Modules

> "Over-specialization may be the single greatest cause of complexity in software."

The sweet spot is **somewhat general-purpose**: functionality reflects current needs, but the interface supports multiple uses. "Somewhat" matters — generality that makes current needs awkward has gone too far. Even when you'll use a module in one special way, a general interface is often *less* work: fewer methods, cleaner information hiding, less code.

**Example — text editor.** A specialized API (`backspace`, `delete`, `deleteSelection`) leaks UI concepts into the text class and forces a new method per UI feature. The general API serves the same UI plus any non-UI use, with less total code:

```java
void insert(Position position, String newText);
void delete(Position start, Position end);
Position changePosition(Position position, int numChars);
```

Backspace becomes UI code: `text.delete(text.changePosition(cursor, -1), cursor)`.

### Three balancing questions

1. What is the **simplest interface that covers all current needs**? (Fewer methods is better only if each stays simple.)
2. In **how many situations** will this method be used? (Exactly one → over-specialization red flag.)
3. Is the API **easy to use for my current needs**? (Generality that forces callers to write loops around single-character operations goes too far.)

### Push specialization up or down

- **Up:** UI concepts like backspace belong in UI code; the layer below stays general.
- **Down:** device drivers push device-specifics below a general OS interface, so a new device plugs in with no core changes.

### Eliminate special cases

Special cases breed if-statement spaghetti. Make the normal case handle them: a selection that *always exists* (empty when nothing is selected) needs no null checks — copy inserts 0 bytes, delete is a no-op. Generalize mechanisms the same way: a general `History` class + special-purpose actions (`UndoableInsert`) + policy above them (the UI decides which actions undo together).

## 5. Error Handling

Exception handling is one of the worst sources of complexity: handler code is harder than normal-case code, handlers rarely execute (so their bugs go undetected), and exceptions are part of a module's interface — a module that throws many has a complex interface. Don't punt an exception upward just because you don't know what to do — the caller probably doesn't either.

### Four techniques, in order of preference

1. **Define errors out of existence (best).** Redefine semantics so the exceptional case is normal: Tcl `unset` is "ensure this variable doesn't exist" — already true, so a no-op success; `substring` beyond the end returns what exists instead of throwing.
2. **Mask at a low level.** Handle the condition internally so higher layers never learn of it: TCP retransmits lost packets; NFS retries a dead server until it returns.
3. **Aggregate handlers.** Replace many near-identical handlers with one at a higher level — one handler around the whole request dispatch, not a try/catch per parameter.
4. **Just crash.** For rare, genuinely unhandleable errors (out of memory, internal inconsistency), print diagnostics and abort — e.g. a malloc wrapper so callers never check for NULL. Not for frequent or recoverable errors.

Decision order: define away → mask → aggregate → crash → expose as exception (last resort). Defining away or masking applies only when the error's information isn't needed outside the module: **unimportant things hidden; important things exposed.**

## 6. Comments and Naming

**Comments are the canary in the coal mine of complexity** — if an interface comment is hard to write, the design has a problem. Write comments first (class comment → key method comments → iterate until the structure feels right → fill bodies); when the code is done, the comments are done.

- **Don't repeat the code.** If someone could write the comment just by reading the code, it adds nothing. State what code can't: units, boundary conditions, invariants, what null means, why.
- **Don't contaminate interface comments with implementation.** Interface docs describe what users need; the "how" lives inside the method.
- Work at two levels: low-level precision near the code ("position of first object not yet returned to client"), higher-level intuition above it (what the code is trying to do and why). Without comments there is no way to capture abstractions — you can't hide complexity you never wrote down.

**Names create an image** of what an entity is *and is not*. Test: shown the name in isolation, how closely can someone guess what it refers to?

- **Precision:** `numActiveUsers` not `count`; `fileBlock`/`diskBlock` not `block` (one vague `block` variable, used for both physical and logical blocks, caused six months of silent data corruption). Booleans are predicates: `cursorVisible`, `hasChildren` — not `blinkStatus`, `childState`.
- **Consistency:** always use the chosen name for its purpose, never for anything else; variants via prefixes (`srcFileBlock`/`dstFileBlock`).
- **No noise words:** `file` not `fileObject`; no type encoding; don't repeat the class name in members.
- **Hard to name = red flag.** No simple name → the variable represents several things, the method does too much, or the class lacks a clear purpose. Choosing names is a design tool, not just labeling.

## 7. Consistency and Obviousness

**Consistency** — similar things done in similar ways — gives cognitive leverage: learn once, apply everywhere. Document conventions, enforce with automated checks, match the file you're editing. A "better idea" alone is not sufficient reason to introduce inconsistency; change a convention only with significant new information and a payoff worth updating every old use. And don't force it: consistency only pays when "if it looks like an x, it really is an x."

**Obviousness** means a reader's first guess about behavior is correct, no close reading required. Obviousness lives in the reader's mind — code review is how you measure it. Design for ease of reading, not ease of writing: avoid generic containers (`Pair<Integer,Boolean>` → define a small named type), match declared types to allocations, document unexpected behavior explicitly.

## 8. Do Not Reach For

- **No abstraction for a single caller.** Two uses, consider; three, act.
- **Strategic ≠ speculative.** Investing in generality for change you cannot name is tactical programming in disguise — "somewhat general-purpose," never maximally general.
- **Name the red flag before proposing structure.** If you can't point at a smell in the code *as it is*, don't add structure.
- **Depth before breadth.** One deep module beats three shallow ones; never split a module because "classes should be small."
- **SOLID in one breath:** SRP ≈ one reason to change (§3 knowledge ownership), OCP ≈ extend without editing (§2 depth + §4 generality), LSP ≈ behavioral substitutability, ISP ≈ no client forced to depend on what it doesn't use (§2 interface cost). They are this skill's ideas in another vocabulary — DIP belongs to layering (architecture-design). No separate ceremony needed.

## 9. Red Flags Checklist

When you spot a flag, stop and look for a design that eliminates it; the first alternative may not work — try several before giving up.

| # | Red flag | Signal → fix |
|---|---|---|
| 1 | Shallow module | Interface ≈ implementation complexity → deepen, merge, or inline it (§2) |
| 2 | Pass-through method | Delegates with the same signature, adds nothing → expose the lower level, redistribute functionality, or merge (§2) |
| 3 | Overexposure | Common use forces learning rarely used features → make the common case the default; rare features behind a separate API (§2) |
| 4 | Information leakage | One design decision known by multiple modules → merge or extract; apply the "change X" test (§3) |
| 5 | Temporal decomposition | Structure follows execution order, not knowledge → reorganize around what each module must know (§3) |
| 6 | Special-general mixture | General mechanism contains use-case-specific code → push specialization up or down (§4) |
| 7 | Repetition | Nontrivial code repeated → factor it out; the right abstraction hasn't been found yet (§2) |
| 8 | Conjoined methods | Can't understand one without the other → combine, decouple, or redesign the interface (§2) |
| 9 | Nonobvious code | Reader's first guess is wrong → better names, consistency, strategic comments (§6, §7) |
| 10 | Comment repeats code | Adds no information → comment at a different level: more precise or more abstract (§6) |
| 11 | Implementation in interface docs | The "how" leaks into the "what" → move implementation details inside the method (§6) |
| 12 | Vague name | Could mean many things → choose a name that creates a clear image (§6) |
| 13 | Hard to pick a name | No precise, intuitive name exists → design problem; try alternative factorings (§6) |
| 14 | Hard to describe | The comment must be long to be complete → simplify the design (§6) |

**Review loop:** name the flag, state why it increases complexity (cognitive load, dependencies, obscurity), propose the smallest design change that removes it. On each visit to a piece of code, fix whatever flags you can — continual small improvements are the strategic approach (§1).
