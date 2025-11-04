# Repository Architecture

## Overview

This document describes the architectural patterns and design decisions for the repository layer, using `userRepo.ts` as the reference implementation.

## Design Principles

### 1. **Raw SQL Over ORM**

All read operations use raw SQL queries instead of Prisma's ORM methods for:

- **Performance**: Direct SQL execution without ORM overhead
- **Control**: Explicit query control with proper indexing
- **Optimization**: Fine-tuned queries for specific use cases

### 2. **Caching Strategy**

All read operations implement a cache-first strategy:

```
Cache Hit → Return cached data
Cache Miss → Query DB → Cache result → Return data
```

### 3. **Helper Function Pattern**

Reusable helper functions eliminate code duplication and ensure consistency.

---

## Architecture: `userRepo.ts`

### Layer Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     Public API Layer                        │
│  (findById, findByEmail, search, findAll, findByRoleId)    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Caching Layer                            │
│        (userCache: getById, getByEmail, getList)            │
└──────────────────┬──────────────────────────────────────────┘
                   │ (Cache Miss)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Access Layer                         │
│              (Raw SQL Queries via $queryRaw)                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Helper Functions                          │
│  (fetchSocials, fetchManySocials, mapRowToUser, ...)       │
└─────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database                               │
│           (PostgreSQL with UUID v7 IDs)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Helper Functions

### 1. **Data Fetching Helpers**

#### `fetchSocials(userId: string)`

Fetches social accounts for a single user.

```typescript
const socials = await fetchSocials(userId);
```

**SQL Query:**

```sql
SELECT id, provider, provider_id, email, ...
FROM socials
WHERE user_id = $1::uuid
```

**Usage:** Used by single-record queries (`findById`, `findByEmail`)

---

#### `fetchManySocials(userIds: string[])`

Fetches social accounts for multiple users in a single query.

```typescript
const allSocials = await fetchManySocials(userIds);
```

**SQL Query:**

```sql
SELECT id, provider, provider_id, email, ...
FROM socials
WHERE user_id = ANY($1::uuid[])
```

**Usage:** Used by list queries (`search`, `findAll`, `findByRoleId`)

**Benefits:**

- Single query instead of N queries
- PostgreSQL `ANY` operator for efficient array matching
- Reduces database round-trips

---

### 2. **Mapping Helpers**

#### `mapRowToUser(row: any, socials: any[])`

Maps a single raw SQL row to a user object with role and socials.

```typescript
const user = mapRowToUser(row, socials);
```

**Output Structure:**

```typescript
{
  id: string,
  email: string,
  name: string,
  // ... other user fields
  role: {
    id: string,
    name: string,
    description: string
  },
  socials: [
    { id: string, provider: string, ... }
  ]
}
```

---

#### `mapRowsToUsers(rows: any[], allSocials: any[])`

Maps multiple raw SQL rows to user objects efficiently.

```typescript
const users = mapRowsToUsers(rows, allSocials);
```

**Algorithm:**

1. Group socials by `userId` into a lookup map
2. Map each row to user object
3. Attach socials from lookup map

**Complexity:** O(n + m) where n = users, m = socials

---

### 3. **Query Helpers**

#### `whereSearch(query: string)`

Builds dynamic WHERE conditions for search queries.

**Logic:**

- Detects UUID pattern using regex
- **UUID Match**: Exact match on `id` field
- **Text Match**: Case-insensitive LIKE on `email`, `name`, `phone`

```typescript
// UUID search
const conditions = whereSearch('018e1234-5678-9abc-def0-123456789abc');
// → WHERE id = '018e1234-5678-9abc-def0-123456789abc'

// Text search
const conditions = whereSearch('john');
// → WHERE (email ILIKE '%john%' OR name ILIKE '%john%' OR phone LIKE '%john%')
```

---

## Public API Methods

### Single Record Queries

#### `findById(id: string)`

**Flow:**

```
1. Check cache by ID
2. If miss: Execute raw SQL with JOIN on roles
3. Fetch socials separately
4. Map row to user object
5. Cache result by ID
6. Return user
```

**SQL:**

```sql
SELECT u.*, r.*
FROM users u
INNER JOIN roles r ON u.role_id = r.id
WHERE u.id = $1::uuid
```

**Caching:** By user ID

---

#### `findByEmail(email: string)`

**Flow:**

```
1. Check cache by email
2. If miss: Execute raw SQL with JOIN on roles
3. Fetch socials separately
4. Map row to user object
5. Cache result by email AND ID (dual cache)
6. Return user
```

**SQL:**

```sql
SELECT u.*, r.*
FROM users u
INNER JOIN roles r ON u.role_id = r.id
WHERE u.email = $1
```

**Caching:** By email and ID (for dual access patterns)

---

### List Queries

#### `search(query: string, options?)`

**Flow:**

```
1. Check cache by search key
2. If miss:
   a. Detect if query is UUID or text
   b. Execute appropriate raw SQL query
   c. Fetch all socials in bulk
   d. Map rows to users with socials
3. Cache result list
4. Return users
```

**SQL (UUID):**

```sql
SELECT u.*, r.*
FROM users u
INNER JOIN roles r ON u.role_id = r.id
WHERE u.id = $1::uuid
ORDER BY u.email ASC
LIMIT $2 OFFSET $3
```

**SQL (Text):**

```sql
SELECT u.*, r.*
FROM users u
INNER JOIN roles r ON u.role_id = r.id
WHERE (
  LOWER(u.email) LIKE LOWER($1)
  OR LOWER(u.name) LIKE LOWER($1)
  OR u.phone LIKE $1
)
ORDER BY u.email ASC
LIMIT $2 OFFSET $3
```

**Caching:** By search query + pagination params

---

#### `findAll(options?)`

**Flow:**

```
1. Check cache by pagination key
2. If miss:
   a. Execute raw SQL (no WHERE clause)
   b. Fetch all socials in bulk
   c. Map rows to users
3. Cache result list
4. Return users
```

**SQL:**

```sql
SELECT u.*, r.*
FROM users u
INNER JOIN roles r ON u.role_id = r.id
ORDER BY u.email ASC
LIMIT $1 OFFSET $2
```

**Caching:** By pagination params

---

#### `findByRoleId(roleId: string, options?)`

**Flow:**

```
1. Check cache by role + pagination
2. If miss:
   a. Execute raw SQL filtered by roleId
   b. Fetch all socials in bulk
   c. Map rows to users
3. Cache result by role
4. Return users
```

**SQL:**

```sql
SELECT u.*, r.*
FROM users u
INNER JOIN roles r ON u.role_id = r.id
WHERE u.role_id = $1::uuid
ORDER BY u.email ASC
LIMIT $2 OFFSET $3
```

**Caching:** By roleId + pagination params

---

## Write Operations

### `create(data: UserCreateInput)`

**Flow:**

```
1. Execute Prisma create with include
2. Invalidate list caches
3. Return user
```

**Cache Strategy:** Invalidate lists (new user affects list results)

---

### `update(id: string, data: UserUpdateInput)`

**Flow:**

```
1. Execute Prisma update with include
2. Invalidate user cache (by ID and email)
3. Invalidate all list caches
4. Return user
```

**Cache Strategy:** Full invalidation (updates affect search/filter results)

---

### `updatePassword(id: string, password: string)`

**Flow:**

```
1. Execute Prisma update
2. Clear user cache only (by ID and email)
3. Return user
```

**Cache Strategy:** Partial invalidation (password doesn't affect lists)

---

### `delete(id: string)`

**Flow:**

```
1. Fetch user to get email
2. Execute Prisma delete
3. Invalidate user cache + all lists
```

**Cache Strategy:** Full invalidation

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  email              TEXT UNIQUE NOT NULL,
  phone              TEXT,
  name               TEXT,
  password           TEXT,
  image              TEXT,
  email_verified     BOOLEAN DEFAULT false,
  email_verified_at  TIMESTAMP,
  role_id            UUID NOT NULL REFERENCES roles(id),
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
```

### Socials Table

```sql
CREATE TABLE socials (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP,
  provider      TEXT NOT NULL,
  provider_id   TEXT NOT NULL,
  email         TEXT,
  profile_data  JSONB,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  UNIQUE(provider, provider_id)
);

-- Indexes
CREATE INDEX idx_socials_user_id ON socials(user_id);
```

### Roles Table

```sql
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP
);
```

---

## Performance Optimizations

### 1. **Indexed Columns**

All WHERE clauses use indexed columns:

- `users.id` (PRIMARY KEY)
- `users.email` (UNIQUE INDEX)
- `users.role_id` (FOREIGN KEY INDEX)
- `socials.user_id` (FOREIGN KEY INDEX)

### 2. **Bulk Loading**

List queries fetch socials in bulk using `ANY(array)`:

```sql
WHERE user_id = ANY($1::uuid[])
```

Instead of N queries, this executes 1 query for all users.

### 3. **Cache Layering**

```
┌─────────────────────────────────────────┐
│ Application Cache (Redis/Memory)        │  ← Fastest
├─────────────────────────────────────────┤
│ Connection Pool                         │  ← Fast
├─────────────────────────────────────────┤
│ Database Query Planner Cache            │  ← Medium
├─────────────────────────────────────────┤
│ PostgreSQL Buffer Cache                 │  ← Medium
├─────────────────────────────────────────┤
│ Disk I/O                                │  ← Slowest
└─────────────────────────────────────────┘
```

### 4. **UUID v7 Benefits**

- Time-sorted IDs enable efficient range queries
- Better index locality than UUID v4
- Eliminates auto-increment race conditions

---

## Column Mapping Convention

### Snake Case (Database) → Camel Case (Application)

```typescript
// Database columns
user_id, created_at, email_verified_at, role_id;

// Application objects
userId, createdAt, emailVerifiedAt, roleId;
```

### Mapping in Raw SQL

```sql
SELECT
  user_id as "userId",
  created_at as "createdAt",
  email_verified_at as "emailVerifiedAt"
FROM users
```

**Note:** Double quotes preserve case sensitivity in PostgreSQL.

---

## Cache Invalidation Strategy

### Granular Invalidation

| Operation      | Invalidate By ID | Invalidate By Email | Invalidate Lists |
| -------------- | ---------------- | ------------------- | ---------------- |
| create         | -                | -                   | ✅               |
| update         | ✅               | ✅                  | ✅               |
| updatePassword | ✅               | ✅                  | ❌               |
| updateEmail    | ✅ (both)        | ✅ (both)           | ✅               |
| delete         | ✅               | ✅                  | ✅               |

### Cache Keys

```typescript
// Single user caches
`user:id:${userId}``user:email:${email}` // List caches
`user:list:search:${query}:${limit}:${offset}``user:list:all:${limit}:${offset}``user:list:role:${roleId}:${limit}:${offset}`;
```

---

## Error Handling

### Null Handling

All find methods return `null` when no records found:

```typescript
const user = await userRepo.findById(id);
if (!user) {
	throw new Error('User not found');
}
```

### UUID Validation

UUID format is validated before casting to `::uuid`:

```typescript
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(id)) {
	throw new Error('Invalid UUID format');
}
```

---

## Testing Considerations

### Integration Tests

Test with actual database to verify:

- Raw SQL syntax correctness
- Index usage (EXPLAIN ANALYZE)
- Join correctness
- UUID casting

### Mock Strategy

Mock at the `db.$queryRaw` level:

```typescript
vi.spyOn(db, '$queryRaw').mockResolvedValue([mockRow]);
```

---

## Migration Path for Other Repositories

To apply this pattern to other repositories:

1. **Create Helper Functions**

   - `fetchRelations(id)` - Fetch related data
   - `fetchManyRelations(ids[])` - Bulk fetch relations
   - `mapRowToEntity(row, relations)` - Single mapping
   - `mapRowsToEntities(rows, relations)` - Bulk mapping

2. **Convert Find Methods**

   - Replace `findUnique` with raw SQL + `WHERE id = $1`
   - Replace `findFirst` with raw SQL + `WHERE ... LIMIT 1`
   - Replace `findMany` with raw SQL + pagination

3. **Preserve Caching**

   - Keep existing cache strategy
   - Ensure cache invalidation on writes

4. **Test Thoroughly**
   - Verify SQL syntax
   - Check index usage
   - Validate data integrity

---

## References

- [PostgreSQL UUID Functions](https://www.postgresql.org/docs/current/functions-uuid.html)
- [Prisma Raw SQL](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access)
- [PostgreSQL ANY Operator](https://www.postgresql.org/docs/current/functions-comparisons.html)
- [UUID v7 Specification](https://datatracker.ietf.org/doc/html/draft-peabody-dispatch-new-uuid-format)

---

## Changelog

### Version 1.0 (Current)

- Converted all find methods to raw SQL
- Implemented helper function pattern
- Added bulk loading for socials
- Optimized UUID v7 support
- Maintained full caching strategy
