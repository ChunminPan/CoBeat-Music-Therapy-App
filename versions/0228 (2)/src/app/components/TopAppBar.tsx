import { ArrowLeft, HelpCircle, Settings } from 'lucide-react';

interface TopAppBarProps {
  title: string;
  onBack?: () => void;
  onHelp?: () => void;
  onSettings?: () => void;
  showBack?: boolean;
  showHelp?: boolean;
  showSettings?: boolean;
}

export function TopAppBar({
  title,
  onBack,
  onHelp,
  onSettings,
  showBack = true,
  showHelp = false,
  showSettings = true,
}: TopAppBarProps) {
  return (
    <div 
      className="w-full px-4 py-3 bg-card flex items-center justify-between"
      style={{ minHeight: 'var(--safe-area-top)' }}
    >
      {/* 左侧：返回按钮 */}
      <div style={{ minWidth: 44, minHeight: 44 }} className="flex items-center justify-start">
        {showBack && (
          <button
            onClick={onBack}
            className="flex items-center justify-center rounded-full transition-colors active:bg-accent"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="返回"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
        )}
      </div>

      {/* 中间：标题 */}
      <h2 className="flex-1 text-center px-2 text-foreground">
        {title}
      </h2>

      {/* 右侧：帮助/设置按钮 */}
      <div style={{ minWidth: 44, minHeight: 44 }} className="flex items-center justify-end gap-1">
        {showHelp && (
          <button
            onClick={onHelp}
            className="flex items-center justify-center rounded-full transition-colors active:bg-accent"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="帮助"
          >
            <HelpCircle className="w-6 h-6 text-muted-foreground" />
          </button>
        )}
        {showSettings && (
          <button
            onClick={onSettings}
            className="flex items-center justify-center rounded-full transition-colors active:bg-accent"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="设置"
          >
            <Settings className="w-6 h-6 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
