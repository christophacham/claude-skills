---
name: simple-design
description: Apply John Ousterhout's "A Philosophy of Software Design" to module-level design. Use when designing or reviewing class, module, or API interfaces; judging whether a module is deep enough or too shallow; deciding how general-purpose to make an API; structuring error/exception handling; writing interface comments or choosing names; scanning code for design red flags (shallow modules, information leakage, temporal decomposition, pass-through methods, vague names); or weighing a quick tactical fix against strategic design investment. Not for performance tuning, language-specific style guides, or system-level architecture patterns.
---

# Simple Design

Module-level design guidance distilled from John Ousterhout's *A Philosophy of Software Design*. One goal runs through everything below: **reduce complexity**. Section 9 is a triage index; sections 1-8 carry the detail.

## 1. Complexity Is the Enemy

Complexity is anything that makes software hard to understand or modify. It shows up as three symptoms:

- **Change amplification** — a simple change requires edits in many places.
- **Cognitive load** — developers must know a lot to complete a task.
- **Unknown unknowns** — it isn't obvious which code to touch, or whether a change is safe. The worst symptom.

Causes: **dependencies** (code can't be understood or changed in isolation) and **obscurity** (important information isn't obvious). Complexity accumulates one small "reasonable compromise" at a time — adopt zero tolerance for the small stuff.

### Tactical vs strategic programming

| Tactical (anti-pattern) | Strategic |
|---|---|
| Get it working ASAP; "fix it later" | Primary goal: a great design that also works |
| Each task adds a little complexity | Invests ~10-20% of dev time in design |
| Asks "smallest possible change?" | Asks "best design given this change?" |
| Codebase degrades and never recovers | Design improves with every modification |

Invest proactively (simple design up front, documentation, imagined future changes) and reactively (fix design problems; don't patch around them). Beware the "tactical tornado": a fast coder who leaves a wake of destruction.

### Design it twice

Your first idea is unlikely to be the best. For any non-trivial module, sketch at least two **radically different** approaches (actually sketch, don't just daydream), weigh pros and cons — interface simplicity, generality, ease of use — and pick one or combine the best features. Even when only one approach seems reasonable, design a second anyway: it exposes what the first assumes.

### Modifying existing code

- Finish each change so the system has the structure it *would have had* if designed from the start with that change in mind. If you aren't making the design better, you're probably making it worse.
- Keep comments near the code they describe; put design rationale in the code, not only in commit logs; avoid duplicated documentation; review your own diff before committing.

### Incremental development

Increments should be **abstractions, not features**. Once you need an abstraction, design it completely and somewhat general-purpose from the start. Don't let agile or TDD become an excuse for tactical programming ("tests first, design later" produces shallow modules).

## 2. Deep Modules

A module's **benefit** is its functionality; its **cost** is the complexity its interface imposes on the rest of the system. Deep modules maximize benefit per unit of interface cost. A simple interface matters more than a simple implementation — it's better for the module's developer to suffer than its users.

**Good example — Unix file I/O.** Five calls hide hundreds of thousands of lines (disk representation, directories, permissions, caching, concurrent access):

```c
int open(const char* path, int flags, mode_t permissions);
ssize_t read(int fd, void* buffer, size_t count);
ssize_t write(int fd, const void* buffer, size_t count);
off_t lseek(int fd, off_t offset, int referencePosition);
int close(int fd);
```

Sequential I/O is the default so the common case is trivial; `lseek` exists but most callers never learn it. If an interface has many features but most users need only a few, its *effective* complexity is just the commonly used features. (A garbage collector is the extreme: zero interface, and it even shrinks the system's overall interface by eliminating object-freeing.)

**Bad example — Java file I/O.** Opening a serialized file takes three objects:

```java
FileInputStream fileStream = new FileInputStream(fileName);
BufferedInputStream bufferedStream = new BufferedInputStream(fileStream);
ObjectInputStream objectStream = new ObjectInputStream(bufferedStream);
```

Two of the three are never used again; callers are forced to understand and explicitly request buffering, which nearly everyone wants. Each class is shallow: interface complexity ≈ implementation complexity. Equally shallow:

```java
private void addNullValueForAttribute(String attribute) {
    data.put(attribute, null);  // no abstraction; docs would be longer than the code
}
```

Small modules tend to be shallow — the "classes should be small" dogma ("classitis") produces large numbers of shallow classes that add net complexity.

### Five deepening techniques

1. **Combine related classes** — if they share information, or one wraps the other without adding value, merge them (e.g. one HTTP-read class + one HTTP-parse class → one class; see §3).
2. **Push complexity down** — absorb awkwardness inside the module instead of forcing every caller to handle it (e.g. don't make callers manage line storage; see §4).
3. **Provide defaults** — classes should "do the right thing" without being asked (automatic buffering). Compute configuration parameters instead of pushing decisions to users.
4. **Raise the interface level** — one higher-level method instead of several low-level ones (the general `insert`/`delete` interface in §4).
5. **Eliminate special cases** — design the normal case so edge conditions need no extra code (§4).

Other causes of shallowness: over-specialized methods, exposing internals via getters/setters or returning internal data structures, and pass-through methods that delegate without adding value.

## 3. Information Hiding

Each module should encapsulate a few **design decisions** — knowledge embedded in its implementation but absent from its interface. Hide: data structures and algorithms, low-level details (page sizes, buffer lengths), higher-level assumptions ("most files are small"), external formats (file formats, wire protocols), and mechanisms (caching, threading). Hiding simplifies the interface and confines future changes to one module.

**Private ≠ hidden.** Fields exposed through getters/setters are just as exposed as public fields. Partial hiding still has value: a rarely used feature reached through separate methods creates fewer dependencies than one in the main interface.

### Information leakage (red flag)

Leakage is the opposite: one design decision reflected in multiple modules, creating a dependency between them. It happens through interfaces, or through the back door — e.g. a reader class and a writer class that both know a file format, with neither exposing it. Back-door leakage is worse because it isn't visible.

- **Test:** "If I change X, how many modules must change?" More than one → X is leaked.
- **Fix:** merge the affected classes if they're small and tied to the leaked knowledge; otherwise extract a new class that owns just that knowledge — with a simple interface, or you've traded back-door leakage for interface leakage.

### Temporal decomposition (red flag)

A common leakage cause: structuring modules by the *order* operations execute instead of by the knowledge each needs. Execution order is on your mind while coding, so this trap is easy.

```
Bad:  RequestReader → RequestParser   (both must understand HTTP format)
Good: HttpRequest                    (reads AND parses; HTTP knowledge in one place)
```

Order will be reflected somewhere in the code, but it should not drive module structure. Focus on **what knowledge is needed to perform each task**.

Within a class, the same rule applies: each private method should encapsulate some information, and each instance variable should be used in as few places as possible. Making a class slightly larger often improves information hiding.

Don't take it too far: information genuinely needed outside the module must be exposed (e.g. configuration a module can't auto-tune). The goal is to *minimize* the information needed outside, not to hide at all costs.

## 4. General-Purpose Modules

> "Over-specialization may be the single greatest cause of complexity in software."

The sweet spot is **somewhat general-purpose**: functionality reflects your current needs, but the interface is general enough to support multiple uses. "Somewhat" matters — don't get so general that current needs become awkward. Even when you'll use a class in one special way, building it generally is *less* work: fewer methods, cleaner information hiding, less code.

**Example — text editor.** A specialized API with one shallow method per UI operation (`backspace`, `delete`, `deleteSelection`) leaks UI concepts into the text class and forces a new text method for every new UI feature. The general-purpose API serves the same UI plus any non-UI use (search-and-replace scripts), with less total code:

```java
void insert(Position position, String newText);
void delete(Position start, Position end);
Position changePosition(Position position, int numChars);
```

Backspace becomes UI code: `text.delete(text.changePosition(cursor, -1), cursor)`.

### Three balancing questions

1. What is the **simplest interface that covers all current needs**? (Fewer methods is better only if each stays simple.)
2. In **how many situations** will this method be used? (Designed for exactly one use → over-specialization red flag.)
3. Is the API **easy to use for my current needs**? (Generality that forces callers to write loops around single-character operations goes too far.)

### Push specialization up or down

- **Up:** top-level layers are inherently specialized. UI concepts like backspace belong in UI code; the text class below stays general.
- **Down:** device drivers push device-specific code below a general OS interface, so a new device plugs in with no changes to the core.

### Eliminate special cases

Special cases breed if-statement spaghetti. Make the normal case handle them: a selection that *always exists* (empty when nothing is selected) needs no null checks anywhere — copy inserts 0 bytes, delete is a no-op.

The same three-way split generalizes mechanisms like undo:

1. **General mechanism** — a `History` class managing an action list (`redo`/`undo` interface, `addFence()` to group actions).
2. **Special-purpose actions** — `UndoableInsert`, `UndoableSelection`, each in its own class.
3. **Policy** — the UI decides which actions undo together.

## 5. Error Handling

Exception handling is one of the worst sources of complexity: handler code is harder to write than normal-case code, handling one error can create another (cascades), language support is verbose, handlers are hard to test and rarely execute — so their bugs go undetected. Most catastrophic failures in distributed systems trace to incorrect error handling. And exceptions are part of a module's interface: a class that throws many exceptions has a complex interface. Don't punt an exception upward just because you don't know what to do — the caller probably doesn't either.

### The four techniques, in order of preference

**1. Define errors out of existence (best).** Redefine semantics so the exceptional case is normal behavior.

- Tcl `unset`: not "delete this variable" (errors if absent) but "ensure this variable doesn't exist" — already true, so it's a no-op success.
- Unix `unlink`: deleting an open file succeeds; the space frees when the last fd closes. This defines away *two* errors — the delete itself and disrupting processes using the file.
- `substring` beyond end of string: return the characters that exist (possibly empty) instead of throwing `IndexOutOfBoundsException`.

People object that throwing catches bugs — but the best way to reduce bugs is to make software simpler.

**2. Mask at a low level.** Handle the condition internally so higher layers never learn of it: TCP retransmits lost packets; NFS clients retry a dead server until it returns. Use when the exception's information isn't needed outside the module — masking both shrinks the interface and adds functionality (a deeper class).

**3. Aggregate handlers.** Replace many near-identical handlers with one at a higher level: define an exception that aborts the current operation, cleans up state, and continues with the next, caught near the top of the request-handling loop.

```java
// Anti-pattern: a try/catch per parameter, each building its own error response.
// Aggregate instead — one handler for the whole request:
public Response dispatch(Request req) {
    try {
        return handleRequest(req);  // any bad/missing parameter throws RequestError
    } catch (RequestError e) {
        return errorResponse(e.getMessage());
    }
}
```

**4. Just crash.** For rare, genuinely unhandleable errors (out of memory, I/O failure on a critical file, internal inconsistency), print diagnostics and abort. Don't crash when the error is frequent, recoverable (replicated storage must recover, not crash), or when anything useful can be done.

```c
void* ckalloc(size_t size) {  // malloc wrapper: callers never check for NULL
    void* ptr = malloc(size);
    if (ptr == NULL) { fprintf(stderr, "out of memory\n"); abort(); }
    return ptr;
}
```

### Decision order

1. Can you redefine semantics to eliminate the error? → define out of existence.
2. Can a lower level handle it invisibly? → mask.
3. Many similar handlers? → aggregate into one.
4. Rare and truly unhandleable? → crash with diagnostics.
5. Otherwise → expose as an exception (last resort).

Defining away or masking only applies when the error's information isn't needed outside the module: a network layer that masks *all* failures leaves applications unable to detect real problems. Unimportant things should be hidden; important things must be exposed.

## 6. Comments as a Design Tool

Comments deferred until "after coding" never get written, arrive low-quality, repeat the code, and have lost the design rationale. Write them first instead; when the code is done, the comments are done.

**Procedure for a new class:**

1. Write the class interface comment.
2. Write interface comments and signatures for the most important public methods; leave bodies empty.
3. Iterate on these comments until the structure feels right.
4. Write declarations and comments for the most important instance variables.
5. Fill in bodies, adding implementation comments as needed.
6. Each time coding reveals a new method, write its interface comment before its body.

Benefits: better comments (decisions are fresh), more enjoyable (comments are the creative design phase), and — most important — better design, because **comments are the canary in the coal mine of complexity**:

> "If you find it difficult to write such a comment, that's an indicator that there may be a problem with the design of the thing you are describing."

A simple interface comment signals a simple interface; a long, convoluted one signals a complex interface; a comment forced to describe the implementation's major features signals a shallow method.

### What to comment

- Every class (the abstraction, what instances represent, limitations), every method (behavior, arguments, return value, side effects, exceptions, preconditions), every class/instance variable (what it represents, units, invariants), and cross-module design decisions.
- Implementation comments only for non-obvious code: one comment per major block saying **what** it does (not how), what each loop iteration accomplishes, and **why** when the purpose isn't obvious. Bug-fix comments may reference issue numbers.

### What not to do

- **Don't repeat the code.** Test: could someone who has never seen the code write this comment just by looking at it? If yes, it adds nothing — this is why people think comments are worthless.
- **Don't reuse the declaration's words.** `/* Obtain a normalized resource name from REQ. */` on `getNormalizedResourceNames(req)` adds nothing; state what the code can't (units, boundaries, what null means, who frees the result, invariants).
- **Don't contaminate interface comments with implementation.** Interface documentation describes what users need; the "how" lives inside the method.

Work at two levels: **low-level precision** near the code (units, boundary conditions — "position of first object not yet returned to client", not "current offset in buffer"), and **higher-level intuition** above it (what the code is trying to do and why, how it fits the bigger picture). Without comments there is no way to capture abstractions — you can't hide complexity you never wrote down.

## 7. Naming

Names are a form of abstraction and documentation; vague names cause real bugs — one variable named `block`, used for both physical disk blocks and logical file blocks, caused six months of silent data corruption.

**Goal:** the name creates an image in the reader's mind of what the entity is *and is not*. Test: shown the name in isolation — no declaration, docs, or call sites — how closely can someone guess what it refers to?

### Precision

A name broad enough to mean many things conveys nothing and invites misuse.

| Vague | Precise |
|---|---|
| `count` | `numActiveUsers` |
| `x`, `y` | `charIndex`, `lineIndex` |
| `result` | `mergedLine` |
| `VOTED_FOR_SENTINEL_VALUE` | `NOT_YET_VOTED` |
| `block` | `fileBlock` / `diskBlock` |

- **Booleans are predicates** — names that read as true/false: `cursorVisible`, `hasChildren`, `canDelete`; not `blinkStatus`, `childState`, `deleteFlag`.
- **Generic names are fine only when the entire usage is visible** — `i`, `j` in a loop of a few lines. Once you can't see the whole loop, use a descriptive name.
- **Don't be too specific either:** `delete(Range range)` works in any context; `delete(Range selection)` falsely implies UI-only use.

### Consistency

For each recurring purpose: always use the chosen name for that purpose, never use it for anything else, and keep the purpose narrow enough that every use behaves the same way (the `block` bug violated the third rule). Create variants with prefixes, not new words: `srcFileBlock`, `dstFileBlock`. Follow loop conventions (`i` outer, `j` nested) so readers can make instant safe assumptions.

### No noise words

- Drop generic nouns: `fileObject` → `file`.
- Drop type encoding (Hungarian notation): `filePtr` → `file` — IDEs show types.
- Don't repeat the class name in members: inside `class File`, use `block`, not `fileBlock`.

Name length should scale with the distance between declaration and use. Short names (Go style) are acceptable only if *readers* find the code clear — readability is judged by readers, not writers.

**Hard to name = red flag.** If no simple name creates a clear image, suspect the design: the variable may represent several things (split it), the method may do too much (split it), or the class may lack a clear purpose (redesign it). Choosing names is a design tool, not just labeling.

Conventions: document them, enforce with automated checkers, follow the existing patterns of whatever file you're in, and don't change conventions without strong justification.

## 8. Consistency & Obviousness

**Consistency** means similar things are done in similar ways and dissimilar things in different ways. It gives cognitive leverage: learn it once, apply it everywhere. It applies to names, coding style, interfaces with multiple implementations, design patterns, and invariants ("every line ends with a newline", "this list always has ≥1 entry").

- **Ensure it:** document conventions where developers will see them; enforce with automated checks (make non-conforming code uncommittable); when in Rome — match the file you're editing.
- **Don't churn:** a "better idea" is not sufficient reason to introduce inconsistency. Change a convention only with significant new information *and* a payoff worth updating every old use — and then leave no trace of the old one.
- **Don't force it:** dissimilar things must be done differently. Consistency only pays when "if it looks like an x, it really is an x" — so don't reuse a name or pattern for something that merely resembles the original.

**Obviousness** means a reader's first guess about the code's behavior is correct, with no close reading required. Obviousness lives in the reader's mind, not the writer's — code review is how you measure it. Make code obvious with good names (§7), consistency, blank lines between major blocks (ideally each followed by a comment describing the next block), and strategic comments wherever the code itself can't be made obvious.

| Obscurity source | Problem | Fix |
|---|---|---|
| Event-driven code | Control flow invisible | Document when each handler is invoked |
| Generic containers | `Pair<Integer,Boolean>`; what are `getKey()`/`getValue()`? | Define a small specific type (`ElectionResult` with `currentTerm`, `isLeader`) |
| Mismatched types | Declared `List`, allocated `ArrayList` — misleads about performance/thread-safety | Match declaration to allocation |
| Unexpected behavior | Violates reader expectations | Document it explicitly |

Generic containers are expedient for the writer and confusing for every reader who follows:

> "Software should be designed for ease of reading, not ease of writing."

## 9. Red Flags Checklist

When you spot a flag, stop and look for a design that eliminates it; the first alternative may not work — try several before giving up.

| # | Red flag | Signal → fix |
|---|---|---|
| 1 | Shallow module | Interface ≈ implementation complexity → deepen, merge, or inline it (§2) |
| 2 | Pass-through method | Delegates with the same signature, adds nothing → expose the lower level directly, redistribute functionality, or merge the classes (§2) |
| 3 | Overexposure | Common use forces learning rarely used features → make the common case the default; move rare features behind a separate API (§2) |
| 4 | Information leakage | One design decision known by multiple modules → merge or extract; apply the "change X" test (§3) |
| 5 | Temporal decomposition | Structure follows execution order, not knowledge → reorganize around what each module must know (§3) |
| 6 | Special-general mixture | General mechanism contains use-case-specific code → push specialization up or down (§4) |
| 7 | Repetition | Nontrivial code repeated → factor it out; the right abstraction hasn't been found yet (§2) |
| 8 | Conjoined methods | Can't understand one without the other → combine them, decouple them, or redesign the interface (§2) |
| 9 | Nonobvious code | Reader's first guess is wrong → better names, consistency, strategic comments (§7, §8) |
| 10 | Comment repeats code | Adds no information → comment at a different level: more precise or more abstract (§6) |
| 11 | Implementation in interface docs | The "how" leaks into the "what" → move implementation details inside the method (§6) |
| 12 | Vague name | Could mean many things → choose a name that creates a clear image (§7) |
| 13 | Hard to pick a name | No precise, intuitive name exists → treat as a design problem; try alternative factorings (§7) |
| 14 | Hard to describe | The comment must be long to be complete → simplify the design (§6) |

**Review loop:** name the specific flag, state why it increases complexity (cognitive load, dependencies, obscurity), then propose the smallest design change that removes it. On each visit to a piece of code, fix whatever flags you can — continual small improvements are the strategic approach (§1).
