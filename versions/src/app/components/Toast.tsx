import { useEffect, useState } from 'react';
import { CheckCircle2, Info, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning';
  duration?: number;
  onClose?: () => void;
  show?: boolean;
}

export function Toast({ 
  message, 
  type = 'info', 
  duration = 3000,
  onClose,
  show = true 
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!isVisible) return null;

  const typeStyles = {
    info: 'bg-primary text-primary-foreground',
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
  };

  const icons = {
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle2 className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className={`${typeStyles[type]} rounded-[var(--radius-lg)] px-5 py-3 shadow-lg flex items-center gap-3 min-w-[280px] max-w-[340px]`}>
        {icons[type]}
        <p className="flex-1 text-base">{message}</p>
      </div>
    </div>
  );
}

// Inline 提示组件
interface InlineHintProps {
  message: string;
  type?: 'default' | 'highlight';
}

export function InlineHint({ message, type = 'default' }: InlineHintProps) {
  const typeStyles = type === 'highlight'
    ? 'bg-primary/10 text-primary border-primary/30'
    : 'bg-accent text-muted-foreground border-border';

  return (
    <div className={`${typeStyles} rounded-[var(--radius-lg)] px-4 py-3 border text-center`}>
      <p className="text-base">{message}</p>
    </div>
  );
}
