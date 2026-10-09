import { ButtonHTMLAttributes } from 'react';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'default' | 'large';
  children: React.ReactNode;
}

export function PrimaryButton({
  variant = 'primary',
  size = 'default',
  children,
  disabled,
  className = '',
  ...props
}: PrimaryButtonProps) {
  const baseStyles = 'rounded-[var(--radius-xl)] font-medium transition-all duration-200 ease-out';
  
  const sizeStyles = size === 'large' 
    ? 'px-8 py-4 min-h-[56px]' 
    : 'px-6 py-3 min-h-[44px]';
  
  const variantStyles = {
    primary: disabled
      ? 'bg-disabled text-disabled-foreground cursor-not-allowed'
      : 'bg-primary text-primary-foreground active:bg-primary-pressed active:scale-[0.98]',
    secondary: disabled
      ? 'bg-disabled text-disabled-foreground cursor-not-allowed'
      : 'bg-secondary text-secondary-foreground active:bg-secondary-pressed active:scale-[0.98]',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton(props: Omit<PrimaryButtonProps, 'variant'>) {
  return <PrimaryButton {...props} variant="secondary" />;
}
