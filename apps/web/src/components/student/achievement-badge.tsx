'use client';

import { Award, BookOpen, Flame, Lock, PenLine, Star, Target, Trophy, Zap } from 'lucide-react';
import type { ComponentType } from 'react';

interface AchievementBadgeProps {
  achievement: {
    code: string;
    tier: string;
    title: string;
    description: string | null;
    icon: string | null;
    isUnlocked: boolean;
  };
  size?: 'sm' | 'md';
}

const tierGradients: Record<string, string> = {
  bronze: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
  silver: 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)',
  gold: 'linear-gradient(135deg, #FFD700 0%, #DAA520 100%)',
  platinum: 'linear-gradient(135deg, #E5E4E2 0%, #B9B9B8 100%)',
};

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  award: Award,
  book: BookOpen,
  book_open: BookOpen,
  flame: Flame,
  pen: PenLine,
  pen_line: PenLine,
  star: Star,
  target: Target,
  trophy: Trophy,
  zap: Zap,
};

export function AchievementBadge({ achievement, size = 'md' }: AchievementBadgeProps) {
  const isSm = size === 'sm';
  const badgeSize = isSm ? 'w-12 h-12' : 'w-20 h-20';
  const iconClass = isSm ? 'w-5 h-5' : 'w-8 h-8';
  const charClass = isSm ? 'text-copy-16' : 'text-title-24';
  const titleClass = isSm ? 'text-label-12' : 'text-copy-14';
  const gradient = tierGradients[achievement.tier] ?? tierGradients.bronze;

  const iconName = achievement.icon ? achievement.icon.toLowerCase() : null;
  const IconComp = iconName ? iconMap[iconName] : undefined;
  const fallbackChar = achievement.icon
    ? achievement.icon.charAt(0).toUpperCase()
    : achievement.title.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col items-center text-center gap-2">
      <div
        className={`${badgeSize} rounded-full flex items-center justify-center font-serif font-medium text-white ring-1 ring-neutral-4 ${
          achievement.isUnlocked ? '' : 'grayscale opacity-60'
        }`}
        style={{ backgroundImage: gradient }}
      >
        {achievement.isUnlocked ? (
          IconComp ? (
            <IconComp className={iconClass} />
          ) : (
            <span className={charClass}>{fallbackChar}</span>
          )
        ) : (
          <Lock className={iconClass} />
        )}
      </div>
      <div className="max-w-[160px]">
        <p className={`${titleClass} font-medium text-neutral-10`}>{achievement.title}</p>
        {!isSm && achievement.description ? (
          <p className="text-label-12 text-neutral-8 mt-1">{achievement.description}</p>
        ) : null}
      </div>
    </div>
  );
}
