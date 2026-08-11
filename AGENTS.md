# CourierX Engineering Instructions

## 1. Project Overview

CourierX is a multi-application logistics platform focused on:

- Local delivery within Somalia
- China → Somalia import shipping
- Customer ordering and delivery
- Driver operations
- Partner/warehouse operations
- Administrative operations and finance
- Wallet and token-based payments
- Shipment tracking and chain of custody

The repository contains multiple independent applications. Each application has its own `package.json` and dependency tree.

Do NOT assume this is a monorepo or workspace.

---

# 2. Applications

## Backend

Location:

`Backend/`

Stack:

- Node.js
- Express 4
- TypeScript
- MongoDB
- Mongoose
- Redis / ioredis
- BullMQ
- Socket.io
- Zod

Purpose:

The central API and business-logic engine.

Architecture:

`Routes → Controllers → Services → Models`

Supporting layers include:

- Middleware
- Config
- Validation
- Enums
- Queues
- Workers
- Utilities

The backend is the authoritative source of business rules.

---

## Customer Mobile App

Location:

`courierx-mobile/`

Stack:

- Expo
- React Native
- React Navigation
- Redux Toolkit
- React Query
- NativeWind

Responsibilities:

- Authentication
- Orders
- Imports
- Wallet
- Tracking
- Profile
- Notifications

---

## Driver Mobile App

Location:

`courierx-driver/`

Stack:

- Expo
- React Native
- React Navigation
- React Query

Responsibilities:

- Driver authentication
- Duty status
- Active orders
- Earnings
- Driver profile
- Delivery operations

---

## Admin Dashboard

Location:

`courierx-admin/`

Stack:

- Vite
- React
- MUI
- Radix
- Redux
- React Router

Responsibilities:

- Operations
- Users
- Drivers
- Orders
- Imports
- Finance
- Staff
- Settings
- Broadcasts
- Administration

---

## Partner Application

Location:

`courierxpartner/`

Stack:

- Vite
- React
- MUI
- Zustand
- React Router

Responsibilities:

- Warehouse intake
- Inventory
- Shipments
- Manifests
- Dispatch
- Exceptions
- Staff
- Finance
- Audit/history

---

# 3. Core Engineering Principle

Do not make changes simply because they appear cleaner.

Before modifying code:

1. Understand the existing implementation.
2. Identify the business rule involved.
3. Trace the complete data flow.
4. Identify all callers and consumers.
5. Check authentication and authorization.
6. Check database implications.
7. Check frontend implications.
8. Check realtime/background-job implications.
9. Check backward compatibility.
10. Only then implement the change.

Prefer the smallest correct change that solves the actual problem.

Do not perform unnecessary rewrites.

---

# 4. Architecture Rules

Follow the existing layered architecture.

Backend responsibilities:

### Routes

Routes should primarily:

- Register endpoints
- Apply middleware
- Apply authorization
- Call controllers

Do not put business logic in routes.

### Controllers

Controllers should:

- Validate/request-process input
- Extract authenticated identity
- Call services
- Return HTTP responses

Do not move complex business logic into controllers.

### Services

Services contain:

- Business rules
- Transactions
- Pricing
- Wallet operations
- State transitions
- Domain workflows

Business logic should normally live here.

### Models

Models define:

- Database structure
- Indexes
- Schema validation
- Database-level invariants

Do not put large application workflows inside Mongoose models.

---

# 5. Backend Is the Source of Truth

Never trust the frontend for:

- Prices
- Wallet balances
- Permissions
- Roles
- Order state
- Driver eligibility
- Payment amounts
- Import fees
- Commissions
- Ownership
- Custody
- Security decisions

The frontend may display and request these operations.

The backend must independently validate them.

---

# 6. Authentication and Authorization

CourierX has multiple authentication flows.

Customer/Driver authentication may involve:

- Firebase authentication
- Phone OTP
- Google authentication
- Firebase ID tokens
- Internal JWTs

Admin/Partner authentication uses separate authentication mechanisms.

Existing authorization mechanisms include:

- `authenticate`
- `authenticateHardened`
- `authorize`
- `authorizeAdmin`
- `authorizeDriver`
- `enforceCapability`
- `requireSudo`
- `enforceCustody`
- `checkPartnerStatus`
- `importOwnershipGuard`

Do not bypass existing security middleware.

Do not weaken authorization simply to make a feature work.

When adding a protected endpoint, determine:

1. Who can call it?
2. What role/capability is required?
3. Does the user own the resource?
4. Does physical custody matter?
5. Does the action require sudo/step-up authentication?
6. Does the operation need an audit record?

---

# 7. Financial and Wallet Rules

Wallet operations are highly sensitive.

Never directly mutate wallet balances unless the existing architecture explicitly requires it.

Use the existing wallet/ledger services.

Wallet operations must preserve:

- Atomicity
- Double-entry accounting
- Transaction integrity
- Idempotency
- Auditability
- Currency correctness
- Concurrency safety

Never create a financial operation that can partially succeed.

For financial changes, inspect:

- `Wallet`
- `WalletService`
- `Transaction`
- `LedgerEntry`
- system accounts
- escrow logic
- deposit logic
- withdrawal logic
- order settlement

before making changes.

---

# 8. CourierX Coin / CXC Migration

CourierX is transitioning from direct USD wallet operations toward CourierX Coins (`CXC`).

The intended architecture includes:

- USD for external fiat transactions
- CXC for internal platform transactions
- Token exchange/conversion logic
- Token minting
- Token burning
- Token escrow
- Token ledger entries

Important:

Do NOT assume the migration is complete.

The system currently needs to support legacy USD workflows while CXC functionality is introduced safely.

During migration:

- Preserve existing USD functionality.
- Prefer additive schema changes.
- Do not destroy historical financial records.
- Do not silently convert balances.
- Do not perform production balance migrations without explicit instruction.
- Preserve exchange-rate snapshots for financial transactions.
- Use server-side conversion logic.
- Never calculate authoritative token amounts solely on the client.

For any CXC implementation, inspect the current wallet, ledger, transaction, escrow, deposit, withdrawal, and order-settlement implementations before changing them.

---

# 9. Orders and State Machines

CourierX uses explicit state machines for important workflows.

Relevant state machines include:

- Orders
- Imports
- Manifests

Do not introduce state transitions by directly modifying status fields unless the existing architecture explicitly permits it.

Before changing a workflow:

1. Find the state machine.
2. Identify allowed transitions.
3. Identify guards/invariants.
4. Identify side effects.
5. Identify notifications.
6. Identify ledger/payment effects.
7. Identify realtime events.

Never create a new state that conflicts with the existing state machine.

---

# 10. Import and Shipment Operations

Imports use chain-of-custody concepts.

Important concepts include:

- Current location
- Partner organization
- Partner location
- Custody authority
- Manifest
- Shipment
- Intake
- Dispatch
- Exceptions
- Local handoff

Partner users must not be allowed to operate on shipments outside their authorized custody/location.

Do not bypass custody checks for convenience.

---

# 11. Payments and Order Settlement

Order financial operations must remain atomic.

Typical flow:

Customer funds
→ Order escrow
→ Delivery completion
→ Driver payout
→ System commission/revenue

When modifying this flow:

- Preserve atomic transactions.
- Prevent double settlement.
- Handle retries safely.
- Respect idempotency.
- Prevent balance leakage.
- Verify currency.
- Verify ownership.
- Verify order state.

Never assume a request will only be submitted once.

---

# 12. Idempotency

CourierX uses idempotency protection for mutation requests.

Many POST/PATCH/PUT/DELETE operations require:

`X-Idempotency-Key`

When adding a mutation endpoint:

- Follow the existing idempotency architecture.
- Do not create a second incompatible idempotency system.
- Ensure retries cannot duplicate financial or operational actions.

Financial operations must be safe against retries.

---

# 13. Concurrency

CourierX uses optimistic concurrency and database transactions.

When modifying records that can be changed concurrently:

- Check existing version/concurrency mechanisms.
- Preserve `409 Conflict` behavior where applicable.
- Use MongoDB sessions/transactions for multi-document financial operations.
- Do not use read → modify → save for sensitive balances if it creates race conditions.

---

# 14. Realtime Systems

CourierX uses Socket.io and notification infrastructure.

When changing order/import/driver workflows, determine whether the operation should trigger:

- Socket events
- Push notifications
- Admin notifications
- Driver notifications
- Customer notifications
- Audit events

Do not add realtime events randomly.

Follow existing event naming and service patterns.

---

# 15. Frontend Rules

Before changing a frontend feature:

1. Identify the screen.
2. Identify its navigation path.
3. Identify its API/service calls.
4. Identify its state management.
5. Identify its React Query usage.
6. Identify authentication requirements.
7. Identify loading/error/empty states.
8. Identify offline/network behavior.

Do not duplicate backend business logic in the frontend.

Frontend validation improves UX but does not replace backend validation.

---

# 16. Navigation

Before adding or modifying a screen:

- Find the existing navigator.
- Determine the correct stack/tab.
- Preserve authentication guards.
- Preserve role-based navigation.
- Preserve deep-link/navigation behavior.
- Avoid duplicate navigation systems.

Do not create a new navigation architecture unless explicitly requested.

---

# 17. API Communication

Use the existing API clients/services.

Do not create random `fetch()` or Axios instances if a centralized client already exists.

Preserve:

- Authorization headers
- Refresh/session behavior
- Idempotency headers
- Error handling
- Request IDs
- 401 handling
- 403 handling
- 409 conflict handling

---

# 18. Error Handling

When fixing an error:

Do not immediately patch the line that crashes.

Trace:

`UI → API call → route → middleware → controller → service → model/database`

Determine the root cause.

Fix the root cause rather than hiding the symptom.

Never:

- Add empty `catch` blocks
- Suppress TypeScript errors
- Use `any` to hide type problems
- Remove validation just to make tests pass
- Disable security middleware
- Ignore failed promises
- Comment out broken code without understanding it

---

# 19. Environment Variables and Secrets

Never expose secrets.

Never commit:

- Firebase service-account keys
- API keys
- JWT secrets
- Database credentials
- Private keys
- Production tokens
- `.env` contents

Do not print secrets in logs.

If a secret appears in source control, flag it immediately.

---

# 20. Dependencies

Do not install a new dependency unless it is actually necessary.

Before adding one:

1. Check whether the project already has an equivalent.
2. Check whether the dependency conflicts with the existing stack.
3. Check whether it is required across multiple apps.
4. Consider bundle size and maintenance cost.

Do not perform dependency upgrades as part of unrelated fixes.

---

# 21. Testing

Every meaningful backend change should be verified.

Prefer:

- Existing tests
- Unit tests
- Integration tests
- API tests
- TypeScript compilation
- Linting
- Expo/React Native checks where applicable

For financial changes, test:

- Successful operation
- Failure
- Retry
- Duplicate request
- Insufficient balance
- Concurrent requests
- Transaction rollback
- Authorization failure

Do not claim a feature is complete without verification.

---

# 22. Build and Runtime Verification

After changes, run the smallest relevant verification first.

Examples:

Backend:

- TypeScript compilation
- Tests
- Relevant API tests

Mobile:

- TypeScript check
- Expo diagnostics
- Relevant tests
- Development build if required

Admin/Partner:

- TypeScript/build checks
- Relevant tests

If a build fails, diagnose the actual failure.

Do not randomly modify configuration until the build passes.

---

# 23. Git and File Safety

Do not assume the root directory is a Git repository.

The applications may have independent Git repositories.

Before making large changes:

- Check repository boundaries.
- Check `git status`.
- Do not overwrite unrelated work.
- Do not reset or delete user changes.
- Do not run destructive Git commands without explicit permission.

Never delete files merely because they appear unused without verifying references.

---

# 24. Working With Existing Code

The project is already substantially implemented.

Prefer:

`Understand → Extend → Refactor carefully`

over:

`Rewrite → Replace → Hope`

Reuse existing:

- Services
- Hooks
- Components
- Middleware
- Utilities
- Models
- State management
- API clients
- Navigation
- Validation
- Error handling

Do not create duplicate implementations of existing functionality.

---

# 25. When Requirements Are Ambiguous

Do not guess about high-impact behavior.

If ambiguity affects:

- Money
- Security
- Authentication
- Authorization
- Data integrity
- Order settlement
- Shipment custody
- Database migrations

Stop and explain the ambiguity before making the change.

For low-risk implementation details, choose the solution that best matches the existing architecture.

---

# 26. Implementation Workflow

For every significant task, follow this process:

### Step 1 — Inspect

Read the relevant files and understand the current implementation.

### Step 2 — Trace

Trace the complete flow across frontend, API, services, database, and realtime systems where applicable.

### Step 3 — Plan

State:

- Root cause/problem
- Files involved
- Proposed solution
- Risks
- Verification strategy

### Step 4 — Implement

Make the smallest correct change.

### Step 5 — Verify

Run relevant checks/tests.

### Step 6 — Review

Look for:

- Security regressions
- Race conditions
- Duplicate logic
- Error handling problems
- Breaking API changes
- Data integrity problems
- Unintended UI behavior

### Step 7 — Report

Clearly report:

- What changed
- Why it changed
- Files changed
- Tests/checks run
- Remaining risks
- Anything that requires manual verification

---

# 27. Critical Rule for AI Coding Agents

You are an engineering agent working on an existing production-oriented application.

Do not optimize for the number of files changed.

Optimize for:

1. Correctness
2. Security
3. Data integrity
4. Maintainability
5. Backward compatibility
6. Performance
7. User experience

Never claim something works without verifying it.

Never invent files, APIs, models, routes, fields, or business rules.

If you cannot find something in the codebase, say that you could not find it.

When uncertain, inspect the repository instead of guessing.

---

# 28. Default Behavior

Unless the user explicitly asks for implementation:

- Do not modify files.
- Analyze first.
- Explain findings.
- Identify risks.
- Provide a plan.

When the user explicitly asks you to implement a change:

- Inspect first.
- Implement only the requested scope.
- Preserve existing architecture.
- Verify the result.
- Report exactly what was changed.