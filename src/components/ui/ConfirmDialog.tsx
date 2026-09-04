import { useEffect, useId } from "react";
import styles from "./ConfirmDialog.module.css";

type ConfirmDialogProps = {
  title: string;
  description: string;
  /** 무엇에 대한 동작인지 보여 주는 요약. 이름과 종류를 한 줄씩 담는다. */
  subject?: { name: string; caption?: string };
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 되돌릴 수 없는 동작을 한 번 더 묻는다. 방 삭제와 연습 종료가 함께 쓴다. */
export function ConfirmDialog({
  title, description, subject, confirmLabel, pendingLabel,
  pending = false, error, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [pending, onCancel]);

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !pending) onCancel();
      }}
    >
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
        {subject && (
          <div className={styles.detail}>
            {subject.name}
            {subject.caption && <small>{subject.caption}</small>}
          </div>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} disabled={pending} onClick={onCancel}>
            취소
          </button>
          <button type="button" className={styles.confirm} disabled={pending} onClick={onConfirm}>
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
