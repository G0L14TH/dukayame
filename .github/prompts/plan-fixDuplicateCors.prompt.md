## Plan: Fix duplicate CORS declaration in server.js

TL;DR - Remove the duplicate `allowedOrigins` and duplicate `app.use(cors(...))` block in `server.js`, leaving a single CORS setup before route registration.

**Steps**
1. Open `c:\dukayame\server.js`.
2. Remove the second declaration of `const allowedOrigins = [...]` starting around line 99.
3. Remove the second `app.use(cors({...}))` block that immediately follows that duplicate declaration.
4. Ensure the remaining CORS middleware block is still placed before any route handlers and before `app.listen`.
5. Save the file.

**Relevant files**
- `c:\dukayame\server.js` — fix duplicate CORS setup and `allowedOrigins` redeclaration.

**Verification**
1. Run the server again with `node server.js`.
2. Confirm that the SyntaxError is gone and server starts successfully.
3. Optionally test a CORS request from the allowed origin(s) to verify middleware still works.

**Decisions**
- Keep the first CORS configuration block and remove the redundant second one.
- Do not alter CORS logic or allowed origins values beyond removing the duplicate.
