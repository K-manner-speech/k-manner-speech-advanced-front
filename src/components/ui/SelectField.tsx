import type { Ref, SelectHTMLAttributes } from "react";
import { useId } from "react";
import styles from "./Field.module.css";

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  label: string;
  placeholder: string;
  error?: string;
  options: { value: string; label: string }[];
  ref?: Ref<HTMLSelectElement>;
};

/** 입력과 같은 테두리 규칙을 쓰되 목록에서 고르는 항목. */
export function SelectField({
  label, placeholder, error, options, className, ...rest
}: SelectFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const classes = [styles.input, styles.select, error ? styles.invalid : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <select
        id={id}
        className={classes}
        defaultValue=""
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {error && <p className={styles.error} id={errorId} role="alert">{error}</p>}
    </div>
  );
}
