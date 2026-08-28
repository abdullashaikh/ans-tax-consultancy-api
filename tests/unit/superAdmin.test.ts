import { RoleName } from '../../src/constants/roles';
import { PermissionName } from '../../src/constants/permissions';
import { UserService } from '../../src/services/user.service';
import { ServiceService } from '../../src/services/service.service';
import { UserRepository } from '../../src/repositories/user.repository';
import { ServiceRepository } from '../../src/repositories/service.repository';

// Mock repositories to test business logic and authorization guardrails in isolation
jest.mock('../../src/repositories/user.repository');
jest.mock('../../src/repositories/service.repository');
jest.mock('../../src/middleware/audit.middleware', () => ({
  AuditService: {
    log: jest.fn().mockResolvedValue(1),
    getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  },
}));

describe('Super Admin Role, RBAC & Pricing Governance - Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Role Hierarchy & Constants', () => {
    it('should correctly define SUPER_ADMIN as the top-level platform owner role', () => {
      expect(RoleName.SUPER_ADMIN).toBe('SUPER_ADMIN');
      expect(RoleName.ADMIN).toBe('ADMIN');
      expect(RoleName.CLIENT).toBe('CLIENT');
      expect(RoleName.SUPER_ADMIN).not.toBe(RoleName.ADMIN);
    });

    it('should include dedicated website and pricing management permissions', () => {
      expect(PermissionName.CATEGORY_MANAGE).toBe('CATEGORY_MANAGE');
      expect(PermissionName.PRICING_MANAGE).toBe('PRICING_MANAGE');
      expect(PermissionName.CONTENT_MANAGE).toBe('CONTENT_MANAGE');
    });
  });

  describe('Anti-Privilege Escalation Guardrails (UserService)', () => {
    it('should prevent an ADMIN from assigning the SUPER_ADMIN role to anyone', async () => {
      const mockUser = { id: 2, publicId: 'usr-123', email: 'test@example.com' };
      (UserRepository.findByPublicId as jest.Mock).mockResolvedValue(mockUser);
      (UserRepository.getUserRoles as jest.Mock).mockResolvedValue([RoleName.STAFF]);

      const normalAdminCaller = { id: 99, roles: [RoleName.ADMIN] };

      await expect(
        UserService.adminUpdateUser(
          'usr-123',
          { roles: [RoleName.SUPER_ADMIN, RoleName.ADMIN] },
          normalAdminCaller
        )
      ).rejects.toThrow('Only a Super Admin can grant the Super Admin role.');
    });

    it('should allow a SUPER_ADMIN to assign the SUPER_ADMIN role', async () => {
      const mockUser = { id: 2, publicId: 'usr-123', email: 'test@example.com' };
      (UserRepository.findByPublicId as jest.Mock).mockResolvedValue(mockUser);
      (UserRepository.getUserRoles as jest.Mock).mockResolvedValue([RoleName.STAFF]);
      (UserRepository.syncUserRoles as jest.Mock).mockResolvedValue(undefined);
      (UserRepository.update as jest.Mock).mockResolvedValue(undefined);

      const superAdminCaller = { id: 1, roles: [RoleName.SUPER_ADMIN] };

      await UserService.adminUpdateUser(
        'usr-123',
        { roles: [RoleName.SUPER_ADMIN, RoleName.ADMIN] },
        superAdminCaller
      );

      expect(UserRepository.syncUserRoles).toHaveBeenCalledWith(
        2,
        [RoleName.SUPER_ADMIN, RoleName.ADMIN],
        1
      );
    });

    it('should prevent non-super-admins from creating staff accounts', async () => {
      const normalAdminCaller = { id: 99, roles: [RoleName.ADMIN] };

      await expect(
        UserService.createStaffUser(
          {
            firstName: 'New',
            lastName: 'Staff',
            email: 'staff@example.com',
            password: 'Password123!',
            roles: [RoleName.STAFF],
          },
          normalAdminCaller
        )
      ).rejects.toThrow('Only a Super Admin can create staff accounts.');
    });
  });

  describe('Pricing Governance & Server-Side Validation (ServiceService)', () => {
    it('should reject negative base price with 400 Bad Request', async () => {
      (ServiceRepository.findServiceById as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'ITR Filing',
        base_price: '999.00',
      });

      await expect(
        ServiceService.updateServicePricing(1, {
          basePrice: -500,
          reason: 'Invalid negative test',
        })
      ).rejects.toThrow('Base price cannot be negative.');
    });

    it('should reject negative discount price with 400 Bad Request', async () => {
      (ServiceRepository.findServiceById as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'ITR Filing',
        base_price: '999.00',
      });

      await expect(
        ServiceService.updateServicePricing(1, {
          basePrice: 999,
          discountPrice: -100,
          reason: 'Invalid negative discount',
        })
      ).rejects.toThrow('Discount price cannot be negative.');
    });

    it('should record immutable price history entry when valid price is updated', async () => {
      (ServiceRepository.findServiceById as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'ITR Filing',
        base_price: '999.00',
        discount_price: null,
        currency: 'INR',
      });
      (ServiceRepository.updateService as jest.Mock).mockResolvedValue(undefined);
      (ServiceRepository.recordPriceHistory as jest.Mock).mockResolvedValue(101);

      await ServiceService.updateServicePricing(
        1,
        {
          basePrice: 1499,
          discountPrice: 1299,
          reason: 'Annual statutory revision',
        },
        10 // Super Admin ID
      );

      expect(ServiceRepository.recordPriceHistory).toHaveBeenCalledWith({
        serviceId: 1,
        previousBasePrice: 999,
        newBasePrice: 1499,
        previousDiscountPrice: null,
        newDiscountPrice: 1299,
        currency: 'INR',
        changedBy: 10,
        reason: 'Annual statutory revision',
      });
    });
  });
});
