import { beforeEach, expect, test, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("./http", () => ({
  http: { GET: get },
  unwrap: (result: { data: unknown }) => result.data,
}));

import { api, waitForTerminal } from "./service";

beforeEach(() => get.mockReset());

test("메시지 목록은 백엔드가 허용하는 페이지 크기로 요청한다", async () => {
  get.mockResolvedValue({ data: { items: [], next_cursor: null } });

  await api.messages("room-1");

  expect(get).toHaveBeenCalledWith("/api/v1/rooms/{room_id}/messages", {
    params: { path: { room_id: "room-1" }, query: { limit: 20 } },
  });
});

test("짧은 Job은 500ms 간격으로 빠르게 확인한다", async () => {
  vi.useFakeTimers();
  const load = vi.fn()
    .mockResolvedValueOnce({ status: "queued" })
    .mockResolvedValueOnce({ status: "processing" })
    .mockResolvedValueOnce({ status: "succeeded" });

  const result = waitForTerminal(load, "succeeded");
  await vi.advanceTimersByTimeAsync(999);
  expect(load).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);

  await expect(result).resolves.toEqual({ status: "succeeded" });
  expect(load).toHaveBeenCalledTimes(3);
  vi.useRealTimers();
});

test("5초 이후에는 polling 간격을 1초로 완화한다", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValue({ status: "processing" });
  const result = waitForTerminal(load, "succeeded", 6_001);
  const rejection = expect(result).rejects.toThrow(
    "처리 시간이 길어지고 있습니다",
  );

  await vi.advanceTimersByTimeAsync(5_999);
  expect(load).toHaveBeenCalledTimes(11);
  await vi.advanceTimersByTimeAsync(1);
  expect(load).toHaveBeenCalledTimes(12);
  await vi.advanceTimersByTimeAsync(1);

  await rejection;
  vi.useRealTimers();
});

test("15초 이후에는 polling 간격을 2초로 완화한다", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValue({ status: "processing" });
  const result = waitForTerminal(load, "succeeded", 17_001);
  const rejection = expect(result).rejects.toThrow(
    "처리 시간이 길어지고 있습니다",
  );

  await vi.advanceTimersByTimeAsync(16_999);
  expect(load).toHaveBeenCalledTimes(21);
  await vi.advanceTimersByTimeAsync(1);
  expect(load).toHaveBeenCalledTimes(22);
  await vi.advanceTimersByTimeAsync(1);

  await rejection;
  vi.useRealTimers();
});

test("실패 상태는 추가 polling 없이 즉시 중단한다", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValue({ status: "failed" });

  await expect(waitForTerminal(load, "succeeded")).rejects.toThrow(
    "비동기 작업이 완료되지 않았습니다",
  );
  expect(load).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
