import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../../api/service";
import { playAutomaticMessageAudio, playManualMessageAudio } from "./audioPlayback";
import { playCompletedTts, playStreamingTts } from "./ttsStreaming";

vi.mock("../../api/service", () => ({ api: { audio: vi.fn() } }));
vi.mock("./ttsStreaming", () => ({ playCompletedTts: vi.fn(), playStreamingTts: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

test("빈 자동 스트림은 오류로 끝내지 않고 완성 WAV를 자동 재생한다", async () => {
  vi.mocked(api.audio)
    .mockResolvedValueOnce({ status: "processing", signed_url: null, expires_at: null, audio_type: "persona_tts", duration_ms: null })
    .mockResolvedValueOnce({ status: "ready", signed_url: "https://example.test/full.wav", expires_at: null, audio_type: "persona_tts", duration_ms: 4_000 });
  vi.mocked(playStreamingTts).mockRejectedValue(new Error("실시간 음성이 비어 있습니다."));

  await playAutomaticMessageAudio("message-1");

  expect(playCompletedTts).toHaveBeenCalledWith("https://example.test/full.wav");
});

test("부분 스트림은 완성 WAV의 남은 위치부터 이어 재생한다", async () => {
  vi.mocked(api.audio)
    .mockResolvedValueOnce({ status: "processing", signed_url: null, expires_at: null, audio_type: "persona_tts", duration_ms: null })
    .mockResolvedValueOnce({ status: "ready", signed_url: "https://example.test/full.wav", expires_at: null, audio_type: "persona_tts", duration_ms: 4_000 });
  vi.mocked(playStreamingTts).mockResolvedValue({ firstRenderMs: 10, completeMs: 20, underrunMs: 0, pcmDurationMs: 1_000 });

  await playAutomaticMessageAudio("message-1");

  expect(playCompletedTts).toHaveBeenCalledWith("https://example.test/full.wav", 1_000);
});

test("수동 재생은 스트림을 열지 않고 완성 WAV만 사용한다", async () => {
  vi.mocked(api.audio).mockResolvedValue({ status: "ready", signed_url: "https://example.test/full.wav", expires_at: null, audio_type: "persona_tts", duration_ms: 4_000 });

  await playManualMessageAudio("message-1");

  expect(playStreamingTts).not.toHaveBeenCalled();
  expect(playCompletedTts).toHaveBeenCalledWith("https://example.test/full.wav");
});
