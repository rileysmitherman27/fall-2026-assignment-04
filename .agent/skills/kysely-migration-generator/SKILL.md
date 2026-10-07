---
name: kysely-migration-generator
description: Translates a Mermaid erDiagram (docs/architecture/schema.mmd or erd.svg) into a type-safe, production-ready Kysely database migration in src/db/migrations/. Use whenever the user asks to generate a migration, create tables, or implement a database schema from an ERD or Mermaid diagram.
---

# Kysely Migration Generator

Convert a Mermaid ERD into a Kysely migration that compiles and runs.

## Inputs
- Primary: `docs/architecture/schema.mmd`. If only `docs/architecture/erd.svg` exists, use its text content to recover entities, attributes and relationships.
- Reference style: `src/db/migrations/001_initial_schema.ts`. Read it first and match its conventions (imports, `serial` ids, `timestamptz` with `sql\`CURRENT_TIMESTAMP\``, `.references(...)`, `ifExists()` in `down`).
- Existing tables: inspect **all** files already in `src/db/migrations/`. Never recreate a table that an earlier migration created (e.g. `users`). Reference it in foreign keys only.

## Translation rules

### Entities → tables
- Convert entity names to `snake_case` plural-style table names matching the diagram (`USERS` → `users`, `BOOK_AUTHORS` → `book_authors`).
- Attribute names are already `snake_case`; keep them.
- Skip entities that already exist in earlier migrations.

### Keys and columns
| Mermaid | Kysely |
| --- | --- |
| `int id PK` | `.addColumn('id', 'serial', (col) => col.primaryKey())` (use `'uuid'` with `sql\`gen_random_uuid()\`` default only if the diagram says uuid) |
| `int x_id FK` | `.addColumn('x_id', 'integer', (col) => col.references('x.id').onDelete('cascade').notNull())` |
| `string` | `'varchar(255)'` |
| `text` | `'text'` |
| `int` | `'integer'` |
| `boolean` | `'boolean'` |
| `decimal` | `'numeric(10, 2)'` |
| `date` | `'date'` |
| `timestamp` | `'timestamptz'` with `.defaultTo(sql\`CURRENT_TIMESTAMP\`).notNull()` for created/logged-at style columns |
| `UK` | `.unique()` |

- Attributes are `.notNull()` by default. Make a column nullable only if the diagram comment says optional/nullable, or the relationship uses `|o` on the FK's own side (zero-or-one parent), in which case also use `.onDelete('set null')` instead of cascade.
- Composite primary keys (junction tables where both attributes are `PK, FK`) use `.addPrimaryKeyConstraint('<table>_pk', ['a_id', 'b_id'])` and no `id` column.

### Cardinalities
- `||--o{` (one-to-many): FK column lives on the "many" table, `references('parent.id').onDelete('cascade')`.
- `||--o|` (one-to-one): FK column lives on the "zero-or-one" table and must also be `.unique()`.
- Many-to-many: only appears via an explicit junction entity; create it with two FKs (composite PK or surrogate id + unique pair).

## Output file
- Write to `src/db/migrations/<timestamp>_<migration_name>.ts`, where `<timestamp>` is `YYYYMMDDHHmmss` for the current time and `<migration_name>` is descriptive snake_case (e.g. `20261007120000_library_management.ts`). This sorts after existing `001_...` files.
- Do **not** modify or delete existing migration files.

## Required structure
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // create tables in dependency order: parents before children
}

export async function down(db: Kysely<any>): Promise<void> {
  // drop tables in REVERSE dependency order: children before parents
  // use .ifExists(); never drop tables created by earlier migrations
}
```
- Export both `up(db: Kysely<any>)` and `down(db: Kysely<any>)`.
- Only import `sql` if it is used.
- `up` creates parents before children; `down` drops in exactly the reverse order (junction tables first).
- `down` only drops tables created in this migration.

## Verification (always do this before finishing)
Run, in order, from the repository root:
1. `npm run build` — must complete with no TypeScript errors.
2. `npm run migrate:up` — must apply the new migration cleanly against the local PostgreSQL (`docker compose up -d` first if the DB is not running).
3. Optionally `npm run migrate:down` then `npm run migrate:up` to confirm `down` is correct.

If any step fails, read the error, fix the migration file, and re-run. Report the file path created and the result of each command. Do not claim success without running them.