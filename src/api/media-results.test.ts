import { beforeEach, expect, test, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() } }));
vi.mock("./http", () => ({
  http: request,
  unwrap: (result: { data: unknown }) => result.data,
}));

import { api } from "./service";

beforeEach(() => {
  vi.clearAllMocks();
  request.GET.mockResolvedValue({ data: {} });
  request.POST.mockResolvedValue({ data: {} });
  request.DELETE.mockResolvedValue({ data: null });
});

test("media와 results 변경 API는 경로, body, 멱등성 헤더를 전송한다", async () => {
  await api.retryFeedback("m0");
  await api.retryTts("m1");
  await api.repeatMessage("m1", "추천 표현");
  await api.retryResult("room1");
  await api.deleteResult("result1");

  expect(request.POST).toHaveBeenNthCalledWith(1, "/api/v1/messages/{message_id}/feedback/retry", expect.objectContaining({ params: { path: { message_id: "m0" }, header: { "Idempotency-Key": expect.any(String) } } }));
  expect(request.POST).toHaveBeenNthCalledWith(2, "/api/v1/messages/{message_id}/tts/retry", expect.objectContaining({ params: { path: { message_id: "m1" }, header: { "Idempotency-Key": expect.any(String) } } }));
  expect(request.POST).toHaveBeenNthCalledWith(3, "/api/v1/messages/{message_id}/repeat", expect.objectContaining({ body: { recommended_expression: "추천 표현" }, params: { path: { message_id: "m1" }, header: { "Idempotency-Key": expect.any(String) } } }));
  expect(request.POST).toHaveBeenNthCalledWith(4, "/api/v1/rooms/{room_id}/result/retry", expect.objectContaining({ params: { path: { room_id: "room1" }, header: { "Idempotency-Key": expect.any(String) } } }));
  expect(request.DELETE).toHaveBeenCalledWith("/api/v1/results/{result_id}", expect.objectContaining({ params: { path: { result_id: "result1" }, header: { "Idempotency-Key": expect.any(String) } } }));
});

test("결과 목록과 상세는 독립 결과 API를 사용한다", async () => {
  await api.results(undefined, 20);
  await api.resultById("result1");
  expect(request.GET).toHaveBeenNthCalledWith(1, "/api/v1/results", { params: { query: { cursor: null, limit: 20 } } });
  expect(request.GET).toHaveBeenNthCalledWith(2, "/api/v1/results/{result_id}", { params: { path: { result_id: "result1" } } });
});

test("메시지 목록은 서버 최대 페이지 크기 20으로 요청한다", async () => {
  await api.messages("room1");
  expect(request.GET).toHaveBeenCalledWith("/api/v1/rooms/{room_id}/messages", {
    params: { path: { room_id: "room1" }, query: { limit: 20 } },
  });
});
