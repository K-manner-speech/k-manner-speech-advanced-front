import type { InputHTMLAttributes, Ref } from "react";
import { useId } from "react";
import styles from "./Field.module.css";

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  error?: string;
  /** react-hook-form 이 비제어 입력으로 다루므로 ref 를 그대로 넘긴다. */
  ref?: Ref<HTMLInputElement>;
};

export function Field({ label, error, className, ...rest }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const classes = [styles.input, error ? styles.invalid : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <input
        id={id}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error && <p className={styles.error} id={errorId} role="alert">{error}</p>}
    </div>
  );
}
