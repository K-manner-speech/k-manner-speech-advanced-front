import styles from "./Pages.module.css";

type Props = { title: string; detail?: string; onRetry?: () => void };
export function StatusPanel({ title, detail, onRetry }: Props) {
  return (
    <section className={styles.statusPanel} role="status">
      <span className={styles.statusPulse} aria-hidden="true" />
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
      {onRetry && <button className={styles.secondaryButton} onClick={onRetry}>다시 시도</button>}
    </section>
  );
}
