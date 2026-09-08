import { Button } from "./Button";
import styles from "./StatusPanel.module.css";

type Props = { title: string; detail?: string; onRetry?: () => void };

export function StatusPanel({ title, detail, onRetry }: Props) {
  return (
    <section className={styles.panel} role="status">
      <span className={styles.pulse} aria-hidden="true" />
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
      {onRetry && (
        <Button variant="secondary" compact className={styles.retry} onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </section>
  );
}
