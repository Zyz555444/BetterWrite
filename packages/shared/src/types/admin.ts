export interface AdminDashboardStats {
  totalSchools: number;
  totalTeachers: number;
  totalStudents: number;
  totalEssays: number;
  todayEssays: number;
  activeRate: number;
  apiCallsToday: number;
  apiCallsTotal: number;
  apiSuccessRate: number;
  apiAvgLatencyMs: number;
}

export interface SchoolWithStats {
  id: string;
  code: string;
  name: string;
  region: string;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
  totalEssays: number;
  averageScore: number | null;
}

export interface SchoolStats {
  schoolId: string;
  schoolName: string;
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
  totalEssays: number;
  averageScore: number | null;
  activeRate: number;
}

export interface ApiConfigItem {
  id: string;
  provider: string;
  apiKeyMasked: string;
  baseUrl: string | null;
  model: string | null;
  isActive: boolean;
  priority: number;
  maxTokens: number | null;
  temperature: number | null;
  rateLimitPerMin: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCallLogItem {
  id: string;
  provider: string;
  model: string | null;
  endpoint: string | null;
  tokensUsed: number | null;
  latencyMs: number | null;
  cost: number | null;
  status: string | null;
  errorMessage: string | null;
  essayId: string | null;
  createdAt: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  targetRole: string;
  isActive: boolean;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
}
