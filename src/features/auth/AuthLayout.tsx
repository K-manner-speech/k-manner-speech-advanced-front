import type { PropsWithChildren } from "react";
import { PhoneFrame } from "../../components/shell/PhoneFrame";
import styles from "./AuthLayout.module.css";

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  titleId?: string;
  /** 가입은 여러 단계라 어디쯤인지 보여 준다. 이때는 브랜드 대신 이 줄을 쓴다. */
  step?: string;
  onBack?: () => void;
}>;

/** 인증 화면들이 공유하는 머리 부분. 브랜드와 제목 위치를 한곳에서 정한다. */
export function AuthLayout({ title, titleId, step, onBack, children }: AuthLayoutProps) {
  const stepped = step !== undefined || onBack !== undefined;
  return (
    <PhoneFrame>
      {stepped ? (
        <div className={styles.topRow}>
          {onBack ? (
            <button type="button" className={styles.back} onClick={onBack} aria-label="뒤로 가기">‹</button>
          ) : <span />}
          {step && <span className={styles.stepPill}>{step}</span>}
        </div>
      ) : (
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">K</span>
          <span className={styles.name}>K-MANNER SPEECH</span>
        </div>
      )}
      <h1 className={styles.headline} id={titleId}>{title}</h1>
      {children}
    </PhoneFrame>
  );
}
