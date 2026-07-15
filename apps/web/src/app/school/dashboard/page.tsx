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
          <h1 className="text-title-24 font-serif font-medium text-neutral-10">学校管理控制台</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: '班级数量', value: '-' },
              { label: '教师数量', value: '-' },
              { label: '学生数量', value: '-' },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-copy-14 font-medium text-neutral-8">
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-title-28 font-medium text-neutral-10">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
