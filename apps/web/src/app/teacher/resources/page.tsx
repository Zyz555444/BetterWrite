'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserRole } from '@betterwrite/shared';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ResourceCategory {
  type: string;
  icon: string;
  label: string;
  description: string;
}

const categories: ResourceCategory[] = [
  {
    type: 'sample',
    icon: '📚',
    label: '范文库',
    description: '优秀作文范例，含亮点点评',
  },
  {
    type: 'sentence',
    icon: '✏️',
    label: '句型模板库',
    description: '高分句型与表达模板',
  },
  {
    type: 'connector',
    icon: '🔗',
    label: '连接词库',
    description: '过渡词与逻辑连接词',
  },
  {
    type: 'errorcase',
    icon: '⚠️',
    label: '错误案例库',
    description: '典型错误与改正示例',
  },
];

export default function TeacherResourcesPage() {
  const router = useRouter();

  useEffect(() => {
    console.log('[TeacherResources] page mounted');
  }, []);

  const handleNavigate = (type: string) => {
    console.log(`[TeacherResources] navigate type=${type}`);
    router.push(`/teacher/resources/${type}`);
  };

  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-title-24 font-serif font-medium text-neutral-10">教学资源库</h1>
            <p className="text-copy-14 text-neutral-8 mt-1">
              管理范文、句型模板、连接词与错误案例，为写作教学提供素材
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((category) => (
              <Card
                key={category.type}
                className="hover:ring-accent/30 cursor-pointer group"
                onClick={() => handleNavigate(category.type)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl leading-none" aria-hidden>
                      {category.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-title-20 font-medium text-neutral-10">
                          {category.label}
                        </h2>
                        <ArrowRight className="w-4 h-4 text-neutral-7 group-hover:text-accent transition-colors" />
                      </div>
                      <p className="text-copy-14 text-neutral-8 mt-1">{category.description}</p>
                      <div className="mt-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigate(category.type);
                          }}
                        >
                          <BookOpen className="w-3 h-3 mr-1" />
                          进入资源库
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
