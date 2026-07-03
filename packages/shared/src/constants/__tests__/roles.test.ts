import { describe, expect, it } from 'vitest';
import { RoleHierarchy, UserRole, hasRequiredRole } from '../roles.js';

describe('RoleHierarchy', () => {
  it('assigns correct hierarchy values', () => {
    expect(RoleHierarchy[UserRole.SUPER_ADMIN]).toBe(4);
    expect(RoleHierarchy[UserRole.SCHOOL_ADMIN]).toBe(3);
    expect(RoleHierarchy[UserRole.TEACHER]).toBe(2);
    expect(RoleHierarchy[UserRole.STUDENT]).toBe(1);
  });
});

describe('hasRequiredRole', () => {
  it('allows super_admin to access any role route', () => {
    expect(hasRequiredRole(UserRole.SUPER_ADMIN, UserRole.STUDENT)).toBe(true);
    expect(hasRequiredRole(UserRole.SUPER_ADMIN, UserRole.TEACHER)).toBe(true);
    expect(hasRequiredRole(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)).toBe(true);
    expect(hasRequiredRole(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)).toBe(true);
  });

  it('allows school_admin to access teacher and student routes', () => {
    expect(hasRequiredRole(UserRole.SCHOOL_ADMIN, UserRole.TEACHER)).toBe(true);
    expect(hasRequiredRole(UserRole.SCHOOL_ADMIN, UserRole.STUDENT)).toBe(true);
  });

  it('denies school_admin from super_admin routes', () => {
    expect(hasRequiredRole(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)).toBe(false);
  });

  it('allows teacher to access own role and student routes', () => {
    expect(hasRequiredRole(UserRole.TEACHER, UserRole.TEACHER)).toBe(true);
    expect(hasRequiredRole(UserRole.TEACHER, UserRole.STUDENT)).toBe(true);
  });

  it('denies teacher from school_admin and super_admin routes', () => {
    expect(hasRequiredRole(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)).toBe(false);
    expect(hasRequiredRole(UserRole.TEACHER, UserRole.SUPER_ADMIN)).toBe(false);
  });

  it('allows student to access only student routes', () => {
    expect(hasRequiredRole(UserRole.STUDENT, UserRole.STUDENT)).toBe(true);
  });

  it('denies student from all higher roles', () => {
    expect(hasRequiredRole(UserRole.STUDENT, UserRole.TEACHER)).toBe(false);
    expect(hasRequiredRole(UserRole.STUDENT, UserRole.SCHOOL_ADMIN)).toBe(false);
    expect(hasRequiredRole(UserRole.STUDENT, UserRole.SUPER_ADMIN)).toBe(false);
  });
});
