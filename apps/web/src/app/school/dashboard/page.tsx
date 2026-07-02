'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@betterwrite/shared';

export default function SchoolDashboardPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.SCHOOL_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-serif font-bold text-text-primary">学校管理控制台</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: '班级数量', value: '-' },
              { label: '教师数量', value: '-' },
              { label: '学生数量', value: '-' },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
