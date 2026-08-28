import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/schema";
import { publicConfig } from "../lib/env";
import { supabase } from "./supabase";

export class ApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    retryable = false,
    status = 0,
  ) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      request.headers.set("Authorization", `Bearer ${data.session.access_token}`);
    }
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401) {
      await supabase.auth.signOut();
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    return response;
  },
};

export const http = createClient<paths>({ baseUrl: publicConfig.VITE_API_BASE_URL });
http.use(authMiddleware);

export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined) return result.data;
  // 204 No Content는 본문이 없어 data가 undefined다. 성공을 실패로 오인하지 않는다.
  if (result.error === undefined && result.response.ok) return undefined as T;
  const payload = result.error as
    | { code?: string; message?: string; retryable?: boolean }
    | { error?: { code?: string; message?: string; retryable?: boolean } }
    | undefined;
  const detail = payload && "error" in payload ? payload.error : payload as {
    code?: string;
    message?: string;
    retryable?: boolean;
  } | undefined;
  throw new ApiError(
    detail?.code ?? "REQUEST_FAILED",
    detail?.message ?? "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    detail?.retryable ?? false,
    result.response.status,
  );
}
