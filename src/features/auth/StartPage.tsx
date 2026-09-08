import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { PhoneFrame } from "../../components/shell/PhoneFrame";
import styles from "./StartPage.module.css";

export function StartPage() {
  const navigate = useNavigate();
  return (
    <PhoneFrame>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">K</span>
        <span className={styles.name}>K-MANNER SPEECH</span>
      </div>

      <div className={styles.hero} aria-hidden="true">
        <span className={`${styles.bubble} ${styles.asked}`}>안녕하세요</span>
        <span className={`${styles.bubble} ${styles.answered}`}>반가워요!</span>
      </div>

      <h1 className={styles.headline}>자연스러운 한국어,<br />지금 시작해요</h1>
      <p className={styles.lead}>
        <span>상황에 맞게 말하고 나만의 표현을 익혀보세요.</span>
        <span>Speak Korean that fits the moment.</span>
      </p>

      <div className={styles.action}>
        <Button hero onClick={() => navigate("/login")}>시작하기 · Get started</Button>
      </div>
    </PhoneFrame>
  );
}
