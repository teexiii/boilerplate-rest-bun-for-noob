import { isLocal, isProd } from '@/config';
import appConfig from '@/config/appConfig';
import { spawn } from 'bun';

interface SendEmailOptions {
	to: string;
	subject: string;
	text: string;
	html?: string;
	from?: string;
}

/**
 * Send email using sendmail on Ubuntu
 */
async function sendEmail(options: SendEmailOptions): Promise<void> {
	// Skip sending emails in local or test environments
	if (isLocal) return;

	const from = options.from || appConfig.mail.from;

	// Build email headers and body
	const emailContent = [
		`From: ${from}`,
		`To: ${options.to}`,
		`Subject: ${options.subject}`,
		`Content-Type: ${options.html ? 'text/html' : 'text/plain'}; charset=UTF-8`,
		'',
		options.html || options.text,
	].join('\n');

	// Spawn sendmail process
	const proc = spawn({
		cmd: ['/usr/sbin/sendmail', '-t', '-i'],
		stdin: 'pipe',
		stdout: 'pipe',
		stderr: 'pipe',
	});

	// Write email content to stdin
	proc.stdin.write(emailContent);
	proc.stdin.end();

	// Wait for process to complete
	const result = await proc.exited;

	if (result !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`Sendmail failed with exit code ${result}: ${stderr}`);
	}
}

export const emailService = {
	/**
	 * Send email verification link to user
	 */
	async sendVerificationEmail(email: string, token: string) {
		try {
			const verificationUrl = appConfig.getWebappUrl(`/verify-email?token=${token}`);

			if (isLocal) {
				console.log(`[DEV] Verification email for ${email} with token: ${token}`);
				console.log(verificationUrl);
				return;
			}

			await sendEmail({
				to: email,
				subject: 'Verify your email address',
				text: `Please verify your email address by clicking this link: ${verificationUrl}`,
				html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
						<h1>Verify your email address</h1>
						<p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
						<div style="margin: 30px 0;">
							<a href="${verificationUrl}"
							   style="background-color: #007bff; color: white; padding: 12px 24px;
							          text-decoration: none; border-radius: 4px; display: inline-block;">
								Verify Email
							</a>
						</div>
						<p style="color: #666; font-size: 14px;">
							Or copy and paste this link into your browser:<br>
							<a href="${verificationUrl}">${verificationUrl}</a>
						</p>
						<p style="color: #999; font-size: 12px; margin-top: 40px;">
							If you didn't create an account, you can safely ignore this email.
						</p>
					</div>
				`,
			});

			console.log(`Verification email sent to ${email}`);
		} catch (error) {
			throw new Error(`sendVerificationEmail failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},

	/**
	 * Send password reset email
	 */
	async sendPasswordResetEmail(email: string, token: string) {
		try {
			const resetUrl = appConfig.getWebappUrl(`/reset-password?token=${token}`);

			if (isLocal) {
				console.log(`[DEV] Password reset email for ${email} with token: ${token}`);
				console.log(resetUrl);
				return;
			}

			await sendEmail({
				to: email,
				subject: 'Reset your password',
				text: `Reset your password by clicking this link: ${resetUrl}`,
				html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
						<h1>Reset your password</h1>
						<p>You requested to reset your password. Click the button below to set a new password:</p>
						<div style="margin: 30px 0;">
							<a href="${resetUrl}"
							   style="background-color: #007bff; color: white; padding: 12px 24px;
							          text-decoration: none; border-radius: 4px; display: inline-block;">
								Reset Password
							</a>
						</div>
						<p style="color: #666; font-size: 14px;">
							Or copy and paste this link into your browser:<br>
							<a href="${resetUrl}">${resetUrl}</a>
						</p>
						<p style="color: #999; font-size: 12px; margin-top: 40px;">
							If you didn't request a password reset, you can safely ignore this email.
							Your password will not be changed.
						</p>
					</div>
				`,
			});

			console.log(`Password reset email sent to ${email}`);
		} catch (error) {
			throw new Error(`sendPasswordResetEmail failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	},
};
