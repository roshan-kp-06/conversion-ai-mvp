import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated';
}

const variantClasses = {
  default: 'bg-white rounded-xl shadow-sm border border-gray-200',
  bordered: 'bg-white rounded-xl border-2 border-gray-200',
  elevated: 'bg-white rounded-xl shadow-lg',
};

export function Card({
  variant = 'default',
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div className={`${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl ${className}`} {...props}>
      {children}
    </div>
  );
}
