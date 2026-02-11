import { roleHandler } from '@/handlers/roleHandler';
import { authenticate, requireAdmin } from '@/middleware/auth';
import { requireHash } from '@/middleware/security';
import type { Route } from '@/types/auth';

export const roleRoutes: Route[] = [
	// Public routes - accessible to all authenticated users
	{
		path: '/api/roles',
		method: 'GET',
		middleware: [requireHash, authenticate],
		handler: roleHandler.getAllRoles,
	},

	// Admin routes - role management
	{
		path: '/api/roles',
		method: 'POST',
		middleware: [requireHash, authenticate, requireAdmin],
		handler: roleHandler.createRole,
	},
	{
		path: '/api/roles/:id',
		method: 'GET',
		middleware: [requireHash, authenticate, requireAdmin],
		handler: roleHandler.getRoleById,
	},
	{
		path: '/api/roles/:id',
		method: 'PUT',
		middleware: [requireHash, authenticate, requireAdmin],
		handler: roleHandler.updateRole,
	},
	{
		path: '/api/roles/:id',
		method: 'DELETE',
		middleware: [requireHash, authenticate, requireAdmin],
		handler: roleHandler.deleteRole,
	},
	{
		path: '/api/roles/:id/users',
		method: 'GET',
		middleware: [requireHash, authenticate, requireAdmin],
		handler: roleHandler.getRoleUsers,
	},
];
