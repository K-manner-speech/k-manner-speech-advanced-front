import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import styles from "../../components/ui/Pages.module.css";
import { useAuth } from "./AuthContext";

const schema = z
  .object({
    email: z.email("올바른 이메일을 입력해 주세요."),
    password: z.string().min(8, "비밀번호는 8자 이상 입력해 주세요."),
    passwordConfirm: z.string(),
    terms: z.boolean().refine(Boolean, "필수 약관에 동의해 주세요."),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

type SignupValues = z.infer<typeof schema>;

export function SignupPage() {
  const { session, signUp } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<SignupValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", passwordConfirm: "", terms: false },
  });

  if (session) return <Navigate to="/onboarding" replace />;

  const submit = form.handleSubmit(async ({ email, password }) => {
    setSubmitError(null);
    try {
      await signUp(email, password);
      navigate("/login?registered=1", { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "회원가입하지 못했습니다.");
    }
  });

  return (
    <main className={styles.authPage}>
      <section className={`${styles.authCard} ${styles.signupCard}`} aria-labelledby="signup-title">
        <div className={styles.authStatus}><span>9:41</span><span>5G ▰</span></div>
        <span className={styles.signupStep}>가입 1/2 · Sign up</span>
        <h1 id="signup-title" className={styles.signupTitle}>K-Manner Speech와<br />함께 시작해요</h1>
        <p className={styles.signupLead}>회원가입 · Sign up</p>
        <form id="signup-form" onSubmit={submit} className={styles.signupForm} noValidate>
          <label>
            이메일 · Email
            <input type="email" autoComplete="email" placeholder="name@example.com" {...form.register("email")} />
            <span className={styles.fieldError}>{form.formState.errors.email?.message}</span>
          </label>
          <label>
            비밀번호 · Password
            <input type="password" autoComplete="new-password" placeholder="8자 이상 · 8+ characters" {...form.register("password")} />
            <span className={styles.fieldError}>{form.formState.errors.password?.message}</span>
          </label>
          <label>
            비밀번호 확인 · Confirm
            <input type="password" autoComplete="new-password" placeholder="8자 이상 · 8+ characters" {...form.register("passwordConfirm")} />
            <span className={styles.fieldError}>{form.formState.errors.passwordConfirm?.message}</span>
          </label>
        </form>
        <label className={styles.termsConsent}>
          <input type="checkbox" form="signup-form" {...form.register("terms")} />
          <span>[필수] 약관·개인정보 동의<br /><small>Required · Terms &amp; Privacy</small></span>
          <span className={styles.fieldError}>{form.formState.errors.terms?.message}</span>
        </label>
        {submitError && <div role="alert" className={styles.signupError}>{submitError}</div>}
        <Link className={styles.signupLoginLink} to="/login">계정이 있나요?&nbsp; 로그인 · Log in</Link>
        <button className={styles.signupSubmit} type="submit" form="signup-form" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "회원가입 중…" : "회원가입 · Create account"}
        </button>
      </section>
    </main>
  );
}
