import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { classEnrollments, classes, essayTasks, schools, users } from './schema/index.js';

function generateRandomPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function seed() {
  console.log('🌱 Seeding database...');

  const now = new Date().toISOString();
  const superAdminPassword = generateRandomPassword();
  const schoolAdminPassword = generateRandomPassword();
  const teacherPassword = generateRandomPassword();
  const studentPassword = generateRandomPassword();

  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);
  const schoolAdminHash = await bcrypt.hash(schoolAdminPassword, 10);
  const teacherHash = await bcrypt.hash(teacherPassword, 10);
  const studentHash = await bcrypt.hash(studentPassword, 10);

  const schoolId = randomUUID();
  const superAdminId = randomUUID();
  const schoolAdminId = randomUUID();
  const teacherId = randomUUID();
  const studentId = randomUUID();
  const classId = randomUUID();

  // 事务包裹所有写入，任一步失败则整体回滚，避免残留残缺数据。
  await db.transaction(async (tx) => {
    await tx.insert(schools).values({
      id: schoolId,
      code: 'SZFTSYZX',
      name: '深圳市福田区实验中学',
      region: '福田',
      contactName: '王校长',
      contactPhone: '13800138000',
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(users).values([
      {
        id: superAdminId,
        email: 'superadmin@betterwrite.cn',
        passwordHash: superAdminHash,
        name: '超级管理员',
        role: 'super_admin',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: schoolAdminId,
        email: 'admin@school.com',
        passwordHash: schoolAdminHash,
        name: '学校管理员',
        role: 'school_admin',
        schoolId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: teacherId,
        email: 'teacher@school.com',
        passwordHash: teacherHash,
        name: '张老师',
        role: 'teacher',
        schoolId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: studentId,
        email: 'student@school.com',
        passwordHash: studentHash,
        name: '李同学',
        role: 'student',
        schoolId,
        studentNo: '20250101',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await tx.insert(classes).values({
      id: classId,
      schoolId,
      code: '2025-C3-01',
      name: '初三(1)班',
      grade: '初三',
      teacherId,
      academicYear: '2025-2026',
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(classEnrollments).values([
      { id: randomUUID(), classId, userId: teacherId, role: 'teacher', createdAt: now },
      { id: randomUUID(), classId, userId: studentId, role: 'student', createdAt: now },
    ]);

    await tx.insert(essayTasks).values({
      id: randomUUID(),
      classId,
      createdBy: teacherId,
      title: '给学弟学妹的初中生活建议',
      topicType: '书信',
      topicCategory: '校园生活',
      requirements:
        '假设你是李华，即将初中毕业。请给初一学弟学妹写一封信，分享你的初中生活经验并提出建议。词数80-125。',
      keyPoints: JSON.stringify(['表达祝福', '分享一条经验', '提出两点建议', '表达期望']),
      wordLimitMin: 80,
      wordLimitMax: 125,
      timeLimitMinutes: 15,
      status: 'published',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now,
    });
  });

  console.log('✅ Seed completed');
  console.log(`  Super Admin: superadmin@betterwrite.cn / ${superAdminPassword}`);
  console.log(`  School Admin: admin@school.com / ${schoolAdminPassword}`);
  console.log(`  Teacher: teacher@school.com / ${teacherPassword}`);
  console.log(`  Student: student@school.com / ${studentPassword}`);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
