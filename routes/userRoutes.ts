import { userHandler } from '@/handlers/userHandler';
import { authenticate, requireAdmin, requireSelfOrAdmin } from '@/middleware/auth';
import { requireHash } from '@/middleware/security';
import type { Route } from '@/types/auth';

export const userRoutes: Route[] = [
	// Admin routes
	{
		path: '/api/user',
		method: 'POST',
		middleware: [requireHash, authenticate, requireAdmin],
		handler: userHandler.createUser,
	},
	{
		path: '/api/users',
		method: 'GET',
		middleware: [requireHash, authenticate, requireAdmin],
		handler: userHandler.getAllUsers,
	},
	{
		path: '/api/users/:id',
		method: 'DELETE',
		middleware: [requireHash, authenticate, requireAdmin],
		handler: userHandler.deleteUser,
	},
	{
		path: '/api/users/search',
		method: 'GET',
		middleware: [requireHash, authenticate, requireAdmin],
		handler: userHandler.searchUsers,
	},

	// Role management
	{
		path: '/api/users/:id/role',
		method: 'PATCH',
		middleware: [requireHash, authenticate, requireAdmin],
		handler: userHandler.changeUserRole,
	},

	// Self or admin routes
	{
		path: '/api/users/:id',
		method: 'GET',
		middleware: [requireHash, authenticate, requireSelfOrAdmin('id')],
		handler: userHandler.getUserById,
	},
	{
		path: '/api/users/:id',
		method: 'PUT',
		middleware: [requireHash, authenticate, requireSelfOrAdmin('id')],
		handler: userHandler.updateUser,
	},

	// Profile routes (self)
	{
		path: '/api/profile',
		method: 'GET',
		middleware: [requireHash, authenticate],
		handler: userHandler.getProfile,
	},
	{
		path: '/api/profile',
		method: 'PUT',
		middleware: [requireHash, authenticate],
		handler: userHandler.updateProfile,
	},
	{
		path: '/api/profile/change-password',
		method: 'POST',
		middleware: [requireHash, authenticate],
		handler: userHandler.changePassword,
	},
];
