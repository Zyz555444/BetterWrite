export const UserRole = {
  SUPER_ADMIN: 'super_admin',
  SCHOOL_ADMIN: 'school_admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const RoleHierarchy: Record<UserRoleType, number> = {
  [UserRole.SUPER_ADMIN]: 4,
  [UserRole.SCHOOL_ADMIN]: 3,
  [UserRole.TEACHER]: 2,
  [UserRole.STUDENT]: 1,
};

export function hasRequiredRole(userRole: UserRoleType, requiredRole: UserRoleType): boolean {
  return RoleHierarchy[userRole] >= RoleHierarchy[requiredRole];
}
