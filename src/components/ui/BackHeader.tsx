import type { ReactNode } from "react";

type BackHeaderProps = {
  title: string;
  onBack: () => void;
  action?: ReactNode;
};

export function BackHeader({ title, onBack, action }: BackHeaderProps) {
  return <div className="figmaBackHeader">
    <button type="button" onClick={onBack} aria-label="뒤로 가기">‹</button>
    <strong>{title}</strong>
    {action && <span className="figmaBackHeaderAction">{action}</span>}
  </div>;
}
