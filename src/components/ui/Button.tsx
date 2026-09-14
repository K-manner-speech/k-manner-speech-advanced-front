import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** 다이얼로그·카드 안에서만 쓴다. 공용 버튼의 최소 터치 높이는 52px 이다. */
  compact?: boolean;
  /** 시작 화면의 대표 CTA. 더 큰 글자와 그림자를 쓴다. */
  hero?: boolean;
};

export function Button({
  variant = "primary", compact = false, hero = false, className, type, ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    compact ? styles.compact : "",
    hero ? styles.hero : "",
    className ?? "",
  ].filter(Boolean).join(" ");
  return <button type={type ?? "button"} className={classes} {...rest} />;
}
