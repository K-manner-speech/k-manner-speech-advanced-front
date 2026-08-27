import { beforeEach, expect, test, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("./http", () => ({
  http: { GET: get },
  unwrap: (result: { data: unknown }) => result.data,
}));

import { api } from "./service";

beforeEach(() => get.mockReset());

test("메시지 목록은 백엔드가 허용하는 페이지 크기로 요청한다", async () => {
  get.mockResolvedValue({ data: { items: [], next_cursor: null } });

  await api.messages("room-1");

  expect(get).toHaveBeenCalledWith("/api/v1/rooms/{room_id}/messages", {
    params: { path: { room_id: "room-1" }, query: { limit: 20 } },
  });
});
