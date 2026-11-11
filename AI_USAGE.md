# AI_USAGE.md

Record of AI tool use on this project (T6, D-6).

| Tool | Part of work | Where the AI was wrong | How I caught it |
|------|-------------|------------------------|-----------------|
| AI coding assistant | Initial architecture planning | Suggested Prisma as the ORM for the .NET backend | Prisma is a Node.js ORM; it cannot be used in a C# project. Caught by checking the technology requirements; fixed to EF Core + raw SQL (D1). |
| AI coding assistant | UI design review against mockups | Mockup placeholders were treated as requirements (e.g. fee amount, single global hold limit, hard-coded "10 minutes") | Compared each mockup element against the written requirement list; identified 10 discrepancies now tracked in PROJECT_STATE.md section 11.3. |
| AI coding assistant | S0 Frontend scaffolding | Scaffolding downgraded React 19 to 18 without adding `@types/node`, which Vite tsconfig needed | Caught during container build when `tsc -b` failed with `TS2688: Cannot find type definition file for 'node'`. Fixed by adding `@types/node` to `devDependencies`. |
| AI coding assistant | S7 Frontend layout & navigation | Extracted unused `isActive` in `NavLink` className callback in `RootLayout.tsx` | Caught during `npm run build` by `tsc -b` failing with TS6133 (`'isActive' is declared but its value is never read`). Fixed by changing callback to `() =>`. |


