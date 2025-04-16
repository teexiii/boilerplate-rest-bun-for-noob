export interface RoleCreateInput {
	name: string;
	description?: string;
}

export interface RoleUpdateInput {
	name?: string;
	description?: string;
}
