import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { AuthLayout } from "./AuthLayout";
import { useAuth } from "./AuthContext";
import styles from "./AuthLayout.module.css";

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
    <AuthLayout title={"환영합니다\n다시 만나서 반가워요"} titleId="login-title">
      {search.get("expired") && (
        <div className={styles.notice} role="alert">
          세션이 만료되었습니다. 미전송 입력은 보존되지 않았어요. 다시 로그인해 주세요.
        </div>
      )}
      {search.get("registered") && (
        <div className={styles.notice} role="alert">
          회원가입 요청이 완료되었습니다. 이메일 인증 후 로그인해 주세요.
        </div>
      )}

      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.card}>
          <Field
            label="이메일 · Email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <Field
            label="비밀번호 · Password"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호 입력 · Password"
            error={form.formState.errors.password?.message}
            {...form.register("password")}
          />
          <div className={styles.links}>
            <Link className={styles.link} to="/signup">회원가입 · Sign up</Link>
            <span className={styles.help}>
              이메일 / 비밀번호 찾기
              <b>Forgot Email or password?</b>
            </span>
          </div>
        </div>

        {submitError && <div className={styles.error} role="alert">{submitError}</div>}

        <div className={styles.action}>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "로그인 중…" : "로그인 · Log in"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
