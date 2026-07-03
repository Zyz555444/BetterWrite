import type { UserRoleType } from '../constants/roles.js';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRoleType;
  schoolId: string | null;
  studentNo: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
