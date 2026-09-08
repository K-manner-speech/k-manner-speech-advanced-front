import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { AuthLayout } from "./AuthLayout";
import { useAuth } from "./AuthContext";
import styles from "./AuthLayout.module.css";

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
    <AuthLayout
      title={"K-Manner Speech와\n함께 시작해요"}
      titleId="signup-title"
      step="가입 1/2 · Sign up"
      onBack={() => navigate("/login")}
    >
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
            autoComplete="new-password"
            placeholder="8자 이상 · 8+ characters"
            error={form.formState.errors.password?.message}
            {...form.register("password")}
          />
          <Field
            label="비밀번호 확인 · Confirm"
            type="password"
            autoComplete="new-password"
            placeholder="8자 이상 · 8+ characters"
            error={form.formState.errors.passwordConfirm?.message}
            {...form.register("passwordConfirm")}
          />
        </div>

        <label className={styles.consent}>
          <input type="checkbox" {...form.register("terms")} />
          <span>
            <b>[필수]</b> 이용약관 및 개인정보처리방침 동의
            <br />
            Required · Terms &amp; Privacy
          </span>
        </label>
        {form.formState.errors.terms && (
          <div className={styles.error} role="alert">{form.formState.errors.terms.message}</div>
        )}
        {submitError && <div className={styles.error} role="alert">{submitError}</div>}

        <div className={styles.action}>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "회원가입 중…" : "회원가입 · Create account"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
