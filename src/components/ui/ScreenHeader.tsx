import type { ReactNode } from "react";
import styles from "./ScreenHeader.module.css";

type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
};

export function ScreenHeader({ title, onBack, action }: ScreenHeaderProps) {
  return (
    <div className={styles.header}>
      {onBack && (
        <button type="button" className={styles.back} onClick={onBack} aria-label="뒤로 가기">‹</button>
      )}
      <h1 className={styles.title}>{title}</h1>
      {action && <span className={styles.action}>{action}</span>}
    </div>
  );
}
