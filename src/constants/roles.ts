export enum RoleName {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  CONSULTANT = 'CONSULTANT',
  STAFF = 'STAFF',
  CLIENT = 'CLIENT',
}

export const ALL_ROLES: RoleName[] = [
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.CONSULTANT,
  RoleName.STAFF,
  RoleName.CLIENT,
];

export const ADMIN_ROLES: RoleName[] = [
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
];

export const INTERNAL_ROLES: RoleName[] = [
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.CONSULTANT,
  RoleName.STAFF,
];
