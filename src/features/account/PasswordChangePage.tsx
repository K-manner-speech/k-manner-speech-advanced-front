import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../../api/service";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import styles from "./SecurityPage.module.css";

const schema = z.object({
  current_password: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
  new_password: z.string().min(8, "새 비밀번호는 8자 이상이어야 해요."),
  confirm_password: z.string().min(1, "새 비밀번호를 한 번 더 입력해 주세요."),
})
  // 오타 하나로 다시 로그인하지 못하게 되므로 두 번 받아 맞춰 본다.
  .refine((values) => values.new_password === values.confirm_password, {
    path: ["confirm_password"],
    message: "새 비밀번호가 서로 다릅니다.",
  })
  .refine((values) => values.new_password !== values.current_password, {
    path: ["new_password"],
    message: "현재 비밀번호와 다른 비밀번호를 입력해 주세요.",
  });

type Values = z.infer<typeof schema>;

export function PasswordChangePage() {
  const navigate = useNavigate();
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const change = useMutation({
    mutationFn: (values: Values) =>
      api.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      }),
    onSuccess: () => navigate("/me/security", { replace: true }),
  });

  return (
    <form className={styles.page} onSubmit={form.handleSubmit((values) => change.mutate(values))}>
      <ScreenHeader title="비밀번호 변경" onBack={() => navigate(-1)} />
      <p className={styles.lead}>새 비밀번호로 안전하게 변경하세요.</p>

      <div className={styles.fields}>
        <Field
          label="현재 비밀번호"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.current_password?.message}
          {...form.register("current_password")}
        />
        <Field
          label="새 비밀번호"
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.new_password?.message}
          {...form.register("new_password")}
        />
        <Field
          label="새 비밀번호 확인"
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.confirm_password?.message}
          {...form.register("confirm_password")}
        />
      </div>

      <div className={styles.hint}>다른 서비스에서 사용하지 않은 비밀번호를 사용해요.</div>

      {change.error && <p className={styles.error} role="alert">{change.error.message}</p>}

      <div className={styles.action}>
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? "변경 중…" : "비밀번호 변경"}
        </Button>
      </div>
    </form>
  );
}
