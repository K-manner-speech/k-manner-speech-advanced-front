import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
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
        <div className={styles.authStatus}><span>9:41</span><span>5G ▰</span></div>
        <div className={styles.brandRow}><div className={styles.brandMark}>K</div><strong>K-MANNER SPEECH</strong></div>
        <h1 id="login-title">환영합니다<br />다시 만나서 반가워요</h1>
        <p className={styles.lead}>로그인 · Log in</p>
        {search.get("expired") && (
          <div className={styles.warning} role="alert">
            세션이 만료되었습니다. 미전송 입력은 보존되지 않았어요. 다시 로그인해 주세요.
          </div>
        )}
        {search.get("registered") && (
          <div className={styles.infoStrip} role="alert">
            회원가입 요청이 완료되었습니다. 이메일 인증 후 로그인해 주세요.
          </div>
        )}
        <form onSubmit={submit} className={styles.form} noValidate>
          <label>
            이메일 · Email
            <input type="email" autoComplete="email" placeholder="name@example.com" {...form.register("email")} />
            <span className={styles.fieldError}>{form.formState.errors.email?.message}</span>
          </label>
          <label>
            비밀번호 · Password
            <input type="password" autoComplete="current-password" placeholder="비밀번호 입력 · Password" {...form.register("password")} />
            <span className={styles.fieldError}>{form.formState.errors.password?.message}</span>
          </label>
          <span className={styles.authHelp}>이메일 / 비밀번호 찾기<br />Forgot Email or password?</span>
          {submitError && <div role="alert" className={styles.error}>{submitError}</div>}
          <Link className={styles.secondaryButton} to="/signup">처음이신가요? 회원가입 · Sign up</Link>
          <button className={styles.primaryButton} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "로그인 중…" : "로그인 · Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}
