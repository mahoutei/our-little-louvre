# Development workflow

This project uses Superpowers for process and Ponytail for implementation size. Use both, in this order.

1. **Understand first.** Load Superpowers `brainstorming` before new features or behavior changes. For a small fix, that is one question, not a ceremony.
2. **Plan multi-step work.** Load `writing-plans` and keep the plan short, exact, and tied to real files.
3. **Debug before fixing.** Load `systematic-debugging` for any bug or failing test, before proposing a fix.
4. **Test first.** Load `test-driven-development` for new behavior and bug fixes: failing test, then the smallest code that passes.
5. **Write less.** Ponytail governs the code: reuse what exists, add no unrequested features, options, or abstractions, and delete before adding.
6. **Verify before claiming done.** Load `verification-before-completion`, run the test/build, and report the actual output.
7. **Close honestly.** End with Ponytail's one or two lines: what was skipped or not checked, and any risk.

## When they disagree

- Superpowers decides *whether* and *in what order*; Ponytail decides *how much code*.
- A process step may be shortened, but never skipped when it protects correctness: tests for risky logic, validation, security, accessibility, data-loss handling, and verification.
- If Ponytail says reuse existing code and a plan says build new, reuse wins unless the requirements prove otherwise.
- No abstraction, wrapper, or file exists only to satisfy a checklist.

## Defaults

- Ponytail level: `full`. Switch with `/ponytail lite|full|ultra|off`.
- Load skills with the `skill` tool when a rule above applies.
- Keep replies short. No success claim without command output.
