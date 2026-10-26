import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'default' | 'primary' | 'warning' | 'danger' | 'success';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  onClick,
}) => {
  const variantStyles = {
    default: {
      border: 'border-border',
      iconBg: 'bg-slate-100 text-slate-700',
      glow: '',
    },
    primary: {
      border: 'border-blue-200',
      iconBg: 'bg-blue-50 text-blue-600',
      glow: 'hover:border-blue-300',
    },
    warning: {
      border: 'border-amber-200',
      iconBg: 'bg-amber-50 text-amber-600',
      glow: 'hover:border-amber-300',
    },
    danger: {
      border: 'border-rose-200',
      iconBg: 'bg-rose-50 text-rose-600',
      glow: 'hover:border-rose-300',
    },
    success: {
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-50 text-emerald-600',
      glow: 'hover:border-emerald-300',
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`card-notion relative overflow-hidden transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
      } ${style.border} ${style.glow}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <span
              className={`inline-flex items-center text-xs font-medium ${
                trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
        <div className={`p-2.5 rounded-lg shrink-0 ${style.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
