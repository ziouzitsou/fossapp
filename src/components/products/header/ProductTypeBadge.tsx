import React from 'react';
import { TemplateType } from '@/types/product';

interface ProductTypeBadgeProps {
  templateType: TemplateType;
  classId: string;
  className?: string;
}

interface BadgeConfig {
  icon: string;
  label: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export function ProductTypeBadge({ templateType, classId, className = '' }: ProductTypeBadgeProps) {
  const badges: Record<TemplateType, BadgeConfig> = {
    luminaire: {
      icon: '💡',
      label: 'COMPLETE LUMINAIRE',
      description: 'Ready to install lighting fixture',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      textColor: 'text-blue-900 dark:text-blue-100',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    accessory: {
      icon: '🔧',
      label: 'COMPONENT / ACCESSORY',
      description: 'Requires installation by qualified electrician',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
      textColor: 'text-orange-900 dark:text-orange-100',
      borderColor: 'border-orange-200 dark:border-orange-800',
    },
    lightline: {
      icon: '🔗',
      label: 'SYSTEM COMPONENT',
      description: 'Part of light-line system - requires compatible track',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
      textColor: 'text-purple-900 dark:text-purple-100',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
    generic: {
      icon: '📦',
      label: 'PRODUCT',
      description: '',
      bgColor: 'bg-gray-50 dark:bg-gray-950',
      textColor: 'text-gray-900 dark:text-gray-100',
      borderColor: 'border-gray-200 dark:border-gray-800',
    },
  };

  const badge = badges[templateType];

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg border
        ${badge.bgColor} ${badge.textColor} ${badge.borderColor}
        ${className}
      `}
    >
      <span className="text-lg" role="img" aria-label={badge.label}>
        {badge.icon}
      </span>
      <div>
        <div className="font-semibold text-sm">{badge.label}</div>
        {badge.description && (
          <div className="text-xs opacity-75">{badge.description}</div>
        )}
      </div>
      {/* Optional: Show ETIM class for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <span className="ml-2 text-xs opacity-50 font-mono">
          {classId}
        </span>
      )}
    </div>
  );
}