---
name: swagger
description: 'OpenAPI spec, Swagger UI serving, and endpoint documentation'
slug: swagger
---

# Swagger / OpenAPI Guide

This guide covers the Swagger documentation system in `swagger/` and `routes/swaggerRoutes.ts`.

## File Structure

```
swagger/
├── index.ts    # Swagger UI server (HTML, JSON, static files)
└── spec.ts     # OpenAPI 3.0.3 spec definition
routes/
└── swaggerRoutes.ts  # Routes to serve docs
```

## Accessing Swagger UI

- **UI**: `GET /api/docs` — Interactive Swagger UI
- **JSON**: `GET /api/docs/swagger.json` — Raw OpenAPI spec
- **Static**: `GET /api/docs/:filename` — CSS/JS assets from `swagger-ui-dist`

## Spec Structure (`swagger/spec.ts`)

The spec is a single exported TypeScript object:

```typescript
import pkg from '@/package.json';
import appConfig from '@/config/appConfig';

export const openApiSpec = {
	openapi: '3.0.3',
	info: {
		title: pkg.name,
		version: pkg.version,
		description: 'Baby Care API - Track baby activities, growth, and more',
	},
	servers: [
		{
			url: appConfig.getBaseUrl(),
			description: 'Current server',
		},
	],
	tags: [
		{ name: 'Health', description: 'Health check endpoints' },
		{ name: 'Auth', description: 'Authentication endpoints' },
		// ... more tags
		{ name: 'Admin', description: 'Admin panel endpoints' },
	],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT',
			},
		},
		schemas: {
			// Reusable schema definitions
		},
	},
	paths: {
		// Endpoint definitions
	},
};
```

## Adding a New Tag

Add to the `tags` array in `spec.ts`:

```typescript
tags: [
    // ... existing tags
    { name: 'NewEntity', description: 'New entity endpoints' },
],
```

## Adding a Schema

Add to `components.schemas`:

```typescript
schemas: {
    NewEntity: {
        type: 'object',
        properties: {
            id: { type: 'string', format: 'uuid', example: '550e8400-...' },
            name: { type: 'string', example: 'Example' },
            createdAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' },
        },
        example: {
            id: '550e8400-...',
            name: 'Example',
            createdAt: '2024-01-15T10:30:00Z',
        },
    },
}
```

## Adding a Path

### Public Endpoint

```typescript
paths: {
    '/api/entity': {
        get: {
            tags: ['NewEntity'],
            summary: 'List entities',
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            ],
            responses: {
                '200': {
                    description: 'Success',
                    content: {
                        'application/json': {
                            example: { status: true, data: [] },
                        },
                    },
                },
            },
        },
    },
}
```

### Authenticated Endpoint

```typescript
'/api/entity/{id}': {
    get: {
        tags: ['NewEntity'],
        summary: 'Get entity by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
            '200': {
                description: 'Success',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/NewEntity' },
                    },
                },
            },
            '401': {
                description: 'Unauthorized',
                content: {
                    'application/json': {
                        example: { status: false, message: 'Authentication required' },
                    },
                },
            },
            '404': {
                description: 'Not Found',
                content: {
                    'application/json': {
                        example: { status: false, message: 'Entity not found' },
                    },
                },
            },
        },
    },
}
```

### Request Body Endpoint

```typescript
'/api/entity': {
    post: {
        tags: ['NewEntity'],
        summary: 'Create entity',
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['name'],
                        properties: {
                            name: { type: 'string' },
                            description: { type: 'string' },
                        },
                    },
                    example: { name: 'New Entity', description: 'Details' },
                },
            },
        },
        responses: {
            '200': {
                description: 'Created',
                content: {
                    'application/json': {
                        example: { status: true, data: { id: '...', name: 'New Entity' } },
                    },
                },
            },
            '400': {
                description: 'Bad Request',
                content: {
                    'application/json': {
                        example: { status: false, message: 'Name is required' },
                    },
                },
            },
        },
    },
}
```

## Admin Endpoints Pattern

Admin endpoints always use the `Admin` tag and `bearerAuth`:

```typescript
'/api/admin/entities': {
    get: {
        tags: ['Admin'],
        summary: 'List entities (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
            '200': { description: 'Success', content: { 'application/json': { example: { status: true, data: { list: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { example: { status: false, message: 'Authentication required' } } } },
            '403': { description: 'Forbidden', content: { 'application/json': { example: { status: false, message: 'Admin access required' } } } },
        },
    },
},
```

## Response Conventions

| Pattern              | Schema                                                         |
| -------------------- | -------------------------------------------------------------- |
| Success with data    | `{ status: true, data: { ... } }`                              |
| Success with message | `{ status: true, message: '...' }`                             |
| Success with list    | `{ status: true, data: { list: [...], pagination: { ... } } }` |
| Error                | `{ status: false, message: '...' }`                            |

## Swagger UI Serving (`swagger/index.ts`)

The UI is served from `swagger-ui-dist` with three functions:

```typescript
serveSwaggerJson(); // Returns the spec as JSON
serveSwaggerUi(baseUrl); // Returns HTML with Swagger UI, loads spec from baseUrl
serveSwaggerStatic(filename); // Serves CSS/JS/images from swagger-ui-dist
```

## Path Variable Syntax

> **Important**: Swagger uses `{id}` syntax in paths, while the app router uses `:id`. Always use `{id}` in the spec.

```typescript
// spec.ts path key
'/api/homes/{id}': { ... }

// Parameter definition
parameters: [
    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
],
```
