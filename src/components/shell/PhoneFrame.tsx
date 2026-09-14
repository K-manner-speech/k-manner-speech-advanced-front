import type { PropsWithChildren } from "react";
import styles from "./PhoneFrame.module.css";

/** 인증 전 화면의 공통 틀. 상태 바는 시안과 같은 자리를 지키기 위한 장식이다. */
export function PhoneFrame({ children }: PropsWithChildren) {
  return (
    <div className={styles.frame}>
      <div className={styles.statusBar} aria-hidden="true">
        <span>9:41</span>
        <span>5G ▰</span>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
