import { X } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from './PrimaryButton';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  primaryAction,
  secondaryAction,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal 内容 */}
      <div className="relative bg-card rounded-[var(--radius-2xl)] shadow-2xl w-full max-w-[340px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 头部 */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full transition-colors active:bg-accent"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="关闭"
          >
            <X className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5">
          {children}
        </div>

        {/* 底部操作按钮 */}
        {(primaryAction || secondaryAction) && (
          <div className="flex gap-3 p-5 pt-0">
            {secondaryAction && (
              <SecondaryButton
                onClick={secondaryAction.onClick}
                className="flex-1"
              >
                {secondaryAction.label}
              </SecondaryButton>
            )}
            {primaryAction && (
              <PrimaryButton
                onClick={primaryAction.onClick}
                className="flex-1"
              >
                {primaryAction.label}
              </PrimaryButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 命名作品 Modal 示例
interface NamingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function NamingModal({ isOpen, onClose, onSave }: NamingModalProps) {
  const [name, setName] = React.useState('');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name);
      setName('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="命名你的练习"
      primaryAction={{
        label: '保存',
        onClick: handleSave,
      }}
      secondaryAction={{
        label: '取消',
        onClick: onClose,
      }}
    >
      <div className="space-y-4">
        <p className="text-muted-foreground">为这次练习起个名字吧！</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：今天的节奏练习"
          className="w-full px-4 py-3 bg-input-background rounded-[var(--radius-lg)] border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>
    </Modal>
  );
}

import React from 'react';
