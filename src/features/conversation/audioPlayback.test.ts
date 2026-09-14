import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../../api/service";
import { playAutomaticMessageAudio, playManualMessageAudio } from "./audioPlayback";
import { playCompletedTts, playStreamingTts } from "./ttsStreaming";

vi.mock("../../api/service", () => ({ api: { audio: vi.fn(), retryTts: vi.fn() } }));
vi.mock("./ttsStreaming", () => ({ playCompletedTts: vi.fn(), playStreamingTts: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

test("자동 스트리밍 재생은 사용자 요청부터 첫 실제 렌더까지 구조화 로그를 남긴다", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(performance, "now").mockReturnValue(500);
  vi.mocked(api.audio)
    .mockResolvedValueOnce({ status: "processing", signed_url: null, expires_at: null, audio_type: "persona_tts", duration_ms: null })
    .mockResolvedValueOnce({ status: "ready", signed_url: "https://example.test/full.wav", expires_at: null, audio_type: "persona_tts", duration_ms: 4_000 });
  vi.mocked(playStreamingTts).mockResolvedValue({ firstByteMs: 250, firstRenderMs: 1_100, completeMs: 3_000, underrunMs: 0, pcmDurationMs: 4_000 });

  await playAutomaticMessageAudio("message-1", 100);

  expect(log).toHaveBeenCalledWith("tts_playback_performance", {
    message_id: "message-1",
    mode: "streaming",
    conversation_to_tts_ms: 400,
    first_byte_ms: 250,
    first_render_ms: 1_100,
    total_time_to_audio_ms: 1_500,
    stream_complete_ms: 3_000,
    pcm_duration_ms: 4_000,
    underrun_ms: 0,
    result: "success",
  });
});

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
  vi.mocked(playStreamingTts).mockResolvedValue({ firstByteMs: 5, firstRenderMs: 10, completeMs: 20, underrunMs: 0, pcmDurationMs: 1_000 });

  await playAutomaticMessageAudio("message-1");

  expect(playCompletedTts).toHaveBeenCalledWith("https://example.test/full.wav", 1_000);
});

test("수동 재생은 스트림을 열지 않고 완성 WAV만 사용한다", async () => {
  vi.mocked(api.audio).mockResolvedValue({ status: "ready", signed_url: "https://example.test/full.wav", expires_at: null, audio_type: "persona_tts", duration_ms: 4_000 });

  await playManualMessageAudio("message-1");

  expect(playStreamingTts).not.toHaveBeenCalled();
  expect(playCompletedTts).toHaveBeenCalledWith("https://example.test/full.wav");
});

test("첫 메시지에 음성이 없으면 생성을 요청하고 기존 실시간 스트리밍 경로로 재생한다", async () => {
  vi.mocked(api.audio)
    .mockRejectedValueOnce(new Error("AUDIO_NOT_FOUND"))
    .mockResolvedValueOnce({ status: "processing", signed_url: null, expires_at: null, audio_type: "persona_tts", duration_ms: null })
    .mockResolvedValueOnce({ status: "ready", signed_url: "https://example.test/full.wav", expires_at: null, audio_type: "persona_tts", duration_ms: 4_000 });
  vi.mocked(api.retryTts).mockResolvedValue({} as never);
  vi.mocked(playStreamingTts).mockResolvedValue({ firstByteMs: 250, firstRenderMs: 1_100, completeMs: 3_000, underrunMs: 0, pcmDurationMs: 4_000 });

  await playManualMessageAudio("opening-message");

  expect(api.retryTts).toHaveBeenCalledWith("opening-message");
  expect(playStreamingTts).toHaveBeenCalledWith("opening-message");
});
