import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../../api/service";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useAuth } from "../auth";
import styles from "./SecurityPage.module.css";

const schema = z.object({
  email: z.string().trim().email("올바른 이메일 주소를 입력해 주세요."),
});
type Values = z.infer<typeof schema>;

export function EmailChangePage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const change = useMutation({ mutationFn: (values: Values) => api.changeEmail(values.email) });

  return (
    <form className={styles.page} onSubmit={form.handleSubmit((values) => change.mutate(values))}>
      <ScreenHeader title="이메일 변경" onBack={() => navigate(-1)} />
      <p className={styles.lead}>확인 메일을 보낸 뒤 새 주소로 바뀝니다.</p>

      <div className={styles.fields}>
        <Field label="현재 이메일" value={session?.user.email ?? "-"} readOnly />
        <Field
          label="새 이메일"
          type="email"
          autoComplete="email"
          placeholder="new@example.com"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
      </div>

      {/* 여기서 끝난 것이 아니다. 링크를 눌러야 확정된다는 사실을 감추면
          사용자는 바뀐 줄 알고 예전 주소로 로그인을 시도한다. */}
      {change.data?.pending_email ? (
        <div className={styles.notice} role="status">
          <strong>{change.data.pending_email}으로 확인 메일을 보냈어요</strong>
          <span>메일의 링크를 눌러야 주소가 바뀝니다. 그때까지는 지금 주소로 로그인해 주세요.</span>
        </div>
      ) : (
        <div className={styles.hint}>새 주소로 확인 메일을 보내요. 링크를 눌러야 변경이 끝납니다.</div>
      )}

      {change.error && <p className={styles.error} role="alert">{change.error.message}</p>}

      <div className={styles.action}>
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? "보내는 중…" : "확인 메일 보내기"}
        </Button>
      </div>
    </form>
  );
}
