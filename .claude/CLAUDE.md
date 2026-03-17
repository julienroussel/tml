# Code Quality Standards

This project uses **Ultracite** (Biome) for automated linting and formatting. Most style issues are caught and fixed automatically — the rules below cover what Biome **cannot** enforce.

## What to Focus On

1. **Business logic correctness** — Biome can't validate algorithms or domain rules
2. **Meaningful naming** — descriptive names for functions, variables, types, and files
3. **Architecture decisions** — component boundaries, data flow, API shape
4. **Edge cases** — boundary conditions, empty/null/error states, race conditions
5. **Accessibility** — semantic HTML, ARIA attributes, keyboard navigation, screen reader support
6. **Security** — validate user input, avoid `dangerouslySetInnerHTML`, sanitize data at system boundaries

## Code Patterns

- Prefer early returns to reduce nesting
- Extract complex conditions into well-named boolean variables
- Prefer simple conditionals over nested ternary operators
- Throw `Error` objects with descriptive messages, not strings
- Don't catch errors just to rethrow them unchanged
- Group related code together and separate concerns
- Keep functions focused and under reasonable cognitive complexity

## Testing

- Write assertions inside `it()` or `test()` blocks
- Use `async/await` in async tests — never `done` callbacks
- Don't commit `.only` or `.skip`
- Keep test suites reasonably flat — avoid excessive `describe` nesting
