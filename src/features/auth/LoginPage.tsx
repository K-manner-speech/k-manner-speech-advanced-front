import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "./AuthContext";
import styles from "../../components/ui/Pages.module.css";

const schema = z.object({
  email: z.email("올바른 이메일을 입력해 주세요."),
  password: z.string().min(6, "비밀번호는 6자 이상 입력해 주세요."),
});
type LoginValues = z.infer<typeof schema>;

export function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<LoginValues>({ resolver: zodResolver(schema) });

  if (session) return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signIn(values.email, values.password);
      navigate("/", { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "로그인하지 못했습니다.");
    }
  });

  return (
    <main className={styles.authPage}>
      <section className={styles.authCard} aria-labelledby="login-title">
        <div className={styles.brandMark}>K</div>
        <p className={styles.eyebrow}>Korean communication coach</p>
        <h1 id="login-title">한국어 대화를 편안하게 연습하세요</h1>
        <p className={styles.lead}>상황별 대화와 이력서 기반 면접을 실제처럼 준비합니다.</p>
        {search.get("expired") && (
          <div className={styles.warning} role="alert">
            세션이 만료되었습니다. 미전송 입력은 보존되지 않았어요. 다시 로그인해 주세요.
          </div>
        )}
        <form onSubmit={submit} className={styles.form} noValidate>
          <label>
            이메일
            <input type="email" autoComplete="email" {...form.register("email")} />
            <span className={styles.fieldError}>{form.formState.errors.email?.message}</span>
          </label>
          <label>
            비밀번호
            <input type="password" autoComplete="current-password" {...form.register("password")} />
            <span className={styles.fieldError}>{form.formState.errors.password?.message}</span>
          </label>
          {submitError && <div role="alert" className={styles.error}>{submitError}</div>}
          <button className={styles.primaryButton} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "로그인 중…" : "로그인"}
          </button>
        </form>
        <p className={styles.caption}>로컬 시연에서는 준비된 테스트 계정으로 로그인해 주세요.</p>
      </section>
    </main>
  );
}
