import { emailService } from '@/services/emailService';

(async () => {
	emailService.sendVerificationEmail('tamlam@wearetopgroup.com', 'test');
})();
