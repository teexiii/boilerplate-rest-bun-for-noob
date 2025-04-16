import { userHandler } from '@/handlers/userHandler';
import { authenticate, requireAdmin, requireSelfOrAdmin } from '@/middleware/auth';
import type { Route } from '@/types/auth';

export const userRoutes: Route[] = [
	// Admin routes
	{
		path: '/api/user',
		method: 'POST',
		middleware: [authenticate, requireAdmin],
		handler: userHandler.createUser,
	},
	{
		path: '/api/users',
		method: 'GET',
		middleware: [authenticate, requireAdmin],
		handler: userHandler.getAllUsers,
	},
	{
		path: '/api/users/:id',
		method: 'DELETE',
		middleware: [authenticate, requireAdmin],
		handler: userHandler.deleteUser,
	},
	{
		path: '/api/users/search',
		method: 'GET',
		middleware: [authenticate, requireAdmin],
		handler: userHandler.searchUsers,
	},

	// Role management
	{
		path: '/api/users/:id/role',
		method: 'PATCH',
		middleware: [authenticate, requireAdmin],
		handler: userHandler.changeUserRole,
	},

	// Self or admin routes
	{
		path: '/api/users/:id',
		method: 'GET',
		middleware: [authenticate, requireSelfOrAdmin('id')],
		handler: userHandler.getUserById,
	},
	{
		path: '/api/users/:id',
		method: 'PUT',
		middleware: [authenticate, requireSelfOrAdmin('id')],
		handler: userHandler.updateUser,
	},

	// Profile routes (self)
	{
		path: '/api/profile',
		method: 'GET',
		middleware: [authenticate],
		handler: userHandler.getProfile,
	},
	{
		path: '/api/profile',
		method: 'PUT',
		middleware: [authenticate],
		handler: userHandler.updateProfile,
	},
	{
		path: '/api/profile/change-password',
		method: 'POST',
		middleware: [authenticate],
		handler: userHandler.changePassword,
	},
];
