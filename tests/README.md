# Testing Guide

## Test Database Setup

This project uses a separate test database to avoid polluting the development database.

### Configuration

- **Development DB**: `local-daiphatxanh-api`
- **Test DB**: `local-daiphatxanh-api-test`
- **Test Redis DB**: Database 1 (vs Database 0 for dev)

### First Time Setup

1. **Setup test database** (only needed once or after schema changes):

   ```bash
   npm run reset-db-test
   ```

   Or manually:

   ```bash
   bun --env-file=.env.test run -- prisma generate
   bun --env-file=.env.test run -- npx prisma db push --force-reset
   ```

2. **Run tests**:
   ```bash
   npm test
   # or
   bun test
   ```

### Available Test Commands

```bash
# Run all tests with coverage
npm test

# Run specific test file
bun test tests/unit/bookService.test.ts

# Run integration tests only
bun test tests/integration/

# Run unit tests only
bun test tests/unit/

# Reset test database (drops all data and recreates schema)
npm run reset-db-test
```

## Test Structure

```
tests/
├── unit/              # Unit tests (service, repository logic)
│   └── bookService.test.ts
└── integration/       # Integration tests (full API endpoints)
    └── book.test.ts
```

## Writing Tests

### Unit Tests

- Test individual functions/methods in isolation
- Mock external dependencies (database, external APIs)
- Fast execution
- Example: `tests/unit/bookService.test.ts`

### Integration Tests

- Test full request/response cycle
- Use actual test database
- Test authentication, authorization, validation
- Example: `tests/integration/book.test.ts`

### Best Practices

1. **Use unique identifiers**: All test data should have unique slugs/names to avoid conflicts

   ```ts
   const PREFIX_NAME_TEXT = `book-test-${Date.now()}`;
   ```

2. **Clean up after tests**: Always clean up test data in `afterAll`

   ```ts
   afterAll(async () => {
   	await db.book.deleteMany({
   		where: { slug: { startsWith: PREFIX_NAME_TEXT } },
   	});
   });
   ```

3. **Isolate tests**: Each test should be independent and not rely on other tests

4. **Use descriptive test names**: Clearly describe what is being tested

## Troubleshooting

### Database connection errors

If you see "Database does not exist" errors:

```bash
npm run reset-db-test
```

### Schema out of sync

After changing `prisma/schema.prisma`:

```bash
npm run reset-db-test
```

### Tests failing due to old data

Clean up test database:

```bash
npm run reset-db-test
```
