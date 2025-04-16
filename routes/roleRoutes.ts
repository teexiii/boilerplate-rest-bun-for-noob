import { roleHandler } from '@/handlers/roleHandler';
import { authenticate, requireAdmin } from '@/middleware/auth';
import type { Route } from '@/types/auth';

export const roleRoutes: Route[] = [
	// Public routes - accessible to all authenticated users
	{
		path: '/api/roles',
		method: 'GET',
		middleware: [authenticate],
		handler: roleHandler.getAllRoles,
	},

	// Admin routes - role management
	{
		path: '/api/roles',
		method: 'POST',
		middleware: [authenticate, requireAdmin],
		handler: roleHandler.createRole,
	},
	{
		path: '/api/roles/:id',
		method: 'GET',
		middleware: [authenticate, requireAdmin],
		handler: roleHandler.getRoleById,
	},
	{
		path: '/api/roles/:id',
		method: 'PUT',
		middleware: [authenticate, requireAdmin],
		handler: roleHandler.updateRole,
	},
	{
		path: '/api/roles/:id',
		method: 'DELETE',
		middleware: [authenticate, requireAdmin],
		handler: roleHandler.deleteRole,
	},
	{
		path: '/api/roles/:id/users',
		method: 'GET',
		middleware: [authenticate, requireAdmin],
		handler: roleHandler.getRoleUsers,
	},
];
