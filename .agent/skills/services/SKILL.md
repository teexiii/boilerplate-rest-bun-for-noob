---
name: services
description: 'Business logic orchestration and service composition'
slug: services
---

# Service Layer Guide

This guide covers business logic implementation in the `services/` directory.

## Core Pattern

Services orchestrate business logic between repositories and handlers:

```typescript
export const userService = {
	async createUser(data: Omit<UserCreateInput, 'roleId'>) {
		// 1. Business logic (get default role)
		const role = await roleService.getRoleByName(AppRoleDefault.VIEWER);
		if (!role) throw new Error('Please Try Again Later', { cause: 400 });

		// 2. Password hashing
		data.password = await hashPassword(data.password);

		// 3. Repository call
		const user = await userRepo.create({ ...data, roleId: role.id });
		return user;
	},
};
```

## Error Throwing with HTTP Status

Always include HTTP status in the `cause` property:

```typescript
// 400 - Bad Request (validation errors)
throw new Error('Email already registered', { cause: 400 });
throw new Error('Password must be at least 6 characters', { cause: 400 });

// 401 - Unauthorized
throw new Error('Invalid credentials', { cause: 401 });

// 403 - Forbidden (permission denied)
throw new Error('Access denied', { cause: 403 });
throw new Error('Only owners can delete homes', { cause: 403 });

// 404 - Not Found
throw new Error('User not found', { cause: 404 });
throw new Error('Baby not found', { cause: 404 });

// 409 - Conflict
throw new Error('Role with this name already exists', { cause: 409 });

// 410 - Gone (expired resources)
throw new Error('Invite has expired', { cause: 410 });
throw new Error('Invite already accepted', { cause: 410 });

// 429 - Too Many Requests (rate limiting)
throw new Error('Too many requests. Please try again later.', { cause: 429 });
```

## Validation Patterns

### Input Validation

```typescript
async register(input: RegisterInput): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await userRepo.findByEmail(input.email);
    if (existingUser) {
        throw new Error('Email already registered', { cause: 400 });
    }

    // Validate password strength
    if (!input.password || input.password.length < 6) {
        throw new Error('Password must be at least 6 characters', { cause: 400 });
    }

    // Continue with registration...
}
```

### State Validation

```typescript
async acceptInvite(token: string, userId: string): Promise<void> {
    const invite = await homeInviteRepo.findByToken(token);
    if (!invite) {
        throw new Error('Invite not found', { cause: 404 });
    }

    if (invite.expiresAt < new Date()) {
        throw new Error('Invite has expired', { cause: 410 });
    }
    if (invite.acceptedAt) {
        throw new Error('Invite already accepted', { cause: 410 });
    }
    if (invite.declinedAt) {
        throw new Error('Invite was declined', { cause: 410 });
    }
}
```

### Unique Constraint Validation

```typescript
async updateRole(id: string, data: RoleUpdateInput) {
    const role = await this.getRoleById(id);

    // Check if name is being updated and already exists
    if (data.name && data.name !== role.name) {
        const existing = await roleRepo.findByName(data.name);
        if (existing) {
            throw new Error('Role with this name already exists', { cause: 409 });
        }
    }
}
```

## Cross-Repository Orchestration

### Multi-Step Registration

```typescript
async register(input: RegisterInput): Promise<AuthResponse> {
    // Step 1: Check if user exists (userRepo)
    const existingUser = await userRepo.findByEmail(input.email);
    if (existingUser) {
        throw new Error('Email already registered', { cause: 400 });
    }

    // Step 2: Create user (userService handles role + password)
    const user = await userService.createUser({
        email: input.email,
        password: input.password,
        name: input.name,
    });

    // Step 3: Create default home (homeService)
    const homeName = `Family ${capitalizeName(input.name || input.email.split('@')[0])}`;
    await homeService.createHome(user.id, { name: homeName });

    // Step 4: Send verification email (emailService)
    await this.sendVerificationEmail(user.id);

    // Step 5: Generate tokens
    const accessToken = await generateAccessToken(user);
    const refreshToken = await refreshTokenService.generateRefreshTokenByUser(user);

    return {
        session: { accessToken, refreshToken: refreshToken.token },
        user: toUserResponse(user),
    };
}
```

### Invite Workflow

```typescript
async inviteMember(homeId: string, inviterId: string, email: string, role: HomeRole = 'MEMBER') {
    // Step 1: Verify home and inviter permission
    const home = await homeRepo.findById(homeId);
    const inviter = home.members.find((m) => m.userId === inviterId);
    if (!inviter || (inviter.role !== 'OWNER' && inviter.role !== 'ADMIN')) {
        throw new Error('Only owners and admins can invite members', { cause: 403 });
    }

    // Step 2: Check for existing invite
    const hasPendingInvite = await homeInviteRepo.existsPendingForEmailAndHome(email, homeId);
    if (hasPendingInvite) {
        throw new Error('Invitation already sent to this email', { cause: 400 });
    }

    // Step 3: Get inviter info for email
    const inviterUser = await userRepo.findById(inviterId);

    // Step 4: Create invite record
    const invite = await homeInviteRepo.create(homeId, email, role, inviterId);

    // Step 5: Send email notification (async, don't await)
    emailService.sendHomeInviteEmail(email, home.name, inviterUser?.name, invite.token);

    return { invited: true, pending: true };
}
```

## Service Composition

Expose helper methods for other services to use:

```typescript
// homeService.ts
async hasAccess(homeId: string, userId: string): Promise<boolean> {
    // App-level admins always have access
    const user = await userRepo.findById(userId);
    if (user?.role.name === AppRoleDefault.ADMIN) return true;

    const member = await homeRepo.findMember(homeId, userId);
    return member !== null;
}

async hasEditAccess(homeId: string, userId: string): Promise<boolean> {
    const user = await userRepo.findById(userId);
    if (user?.role.name === AppRoleDefault.ADMIN) return true;

    const member = await homeRepo.findMember(homeId, userId);
    if (!member) return false;
    return member.role !== 'VIEWER';
}
```

```typescript
// babyService.ts - uses homeService helpers
async createBaby(userId: string, data: BabyCreateInput): Promise<BabyWithHome> {
    const hasAccess = await homeService.hasEditAccess(data.homeId, userId);
    if (!hasAccess) {
        throw new Error('Access denied', { cause: 403 });
    }
    return babyRepo.create(data);
}

async hasAccess(babyId: string, userId: string): Promise<boolean> {
    const baby = await babyRepo.findById(babyId);
    if (!baby) return false;
    return homeService.hasAccess(baby.homeId, userId);
}
```

## Password Hashing

Use Bun's native password utilities with pepper:

```typescript
import hashPassword from '@/lib/auth/password/hashPassword';
import checkCorrectPassword from '@/lib/auth/password/checkCorrectPassword';

// Hashing
data.password = await hashPassword(data.password);

// Verification
const validPassword = await checkCorrectPassword(user.password, input.password);
if (!validPassword) {
	throw new Error('Incorrect Username Or Password', { cause: 400 });
}
```

## JWT Token Generation

```typescript
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/jwt';

// Generate tokens
const accessToken = await generateAccessToken(user);
const newToken = await refreshTokenService.generateRefreshTokenByUser(user);

// Verify tokens
const payload = await verifyAccessToken(token);
const refreshPayload = await verifyRefreshToken(refreshToken);
```

## Rate Limiting Pattern

```typescript
async resendVerificationEmail(input: ResendVerificationInput) {
    const user = await userRepo.findByEmail(input.email);
    if (!user) throw new Error('User not found', { cause: 404 });

    if (user.emailVerified) {
        throw new Error('Email already verified', { cause: 400 });
    }

    // Check rate limit (max 5 emails per hour)
    const recentCount = await verificationTokenRepo.countRecentTokens(
        user.id,
        'EMAIL_VERIFICATION',
        60 // minutes
    );

    if (recentCount >= 5) {
        throw new Error('Too many verification emails sent. Please try again later.', { cause: 429 });
    }

    return this.sendVerificationEmail(user.id);
}
```

## Async Email Sending

Don't block operations waiting for email delivery:

```typescript
async sendVerificationEmail(userId: string) {
    const token = await verificationTokenRepo.create(userId, 'EMAIL_VERIFICATION');
    const user = await userService.getUserById(userId);

    // DO_NOT_AWAIT - Send email asynchronously
    emailService.sendVerificationEmail(user.email, token);

    return { token, message: 'Verification email sent successfully' };
}
```

## Transaction Management

Use repository-level transactions with coordinated service logic:

```typescript
async generateRefreshTokenByUser(user: Pick<UserWithRole, 'id'>) {
    const expiration = timeToMs(appConfig.jwt.refreshTokenExpiresIn);
    const expiresAt = new Date(Date.now() + expiration);

    // Step 1: Create record with placeholder token
    const record = await refreshTokenRepo.create({
        token: '_pending_',
        expiresAt,
        userId: user.id,
    });

    // Step 2: Generate JWT with DB-assigned id
    const refreshTokenToken = await generateRefreshToken(user, record.id);

    // Step 3: Update with actual JWT
    return await refreshTokenRepo.updateToken(record.id, refreshTokenToken);
}
```
