import { describe, expect, test, vi } from "vitest";
import { playCompletedTts, playStreamingTts, STREAMING_TTS_BUFFER_POLICY, ttsProcessorSource, type StreamingPlaybackResult } from "./ttsStreaming";

vi.mock("../../api/supabase", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }) } },
}));

function stubAudioContext() {
  const close = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("AudioContext", class {
    state = "running";
    destination = {};
    audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
    resume = vi.fn().mockResolvedValue(undefined);
    close = close;
  });
  vi.stubGlobal("AudioWorkletNode", class {
    port = { postMessage: vi.fn(), onmessage: null };
    connect = vi.fn();
  });
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:tts"), revokeObjectURL: vi.fn() });
  return close;
}

describe("streaming TTS buffering policy", () => {
  test("24kHz PCM을 최초 1초 모은 뒤 재생한다", () => {
    expect(STREAMING_TTS_BUFFER_POLICY.initialSamples).toBe(24_000);
    expect(ttsProcessorSource).toContain("this.hasStarted?12000:24000");
  });

  test("언더런 후에는 0.5초를 다시 모을 때까지 재생을 멈춘다", () => {
    expect(STREAMING_TTS_BUFFER_POLICY.rebufferSamples).toBe(12_000);
    expect(ttsProcessorSource).toContain("this.started=false");
    expect(ttsProcessorSource).toContain("this.hasStarted=true");
  });

  test("HTTP 종료가 아니라 남은 PCM 소진 뒤 재생 완료를 알린다", () => {
    expect(ttsProcessorSource).toContain("type:'playback-ended'");
    expect(ttsProcessorSource).not.toContain("type:'ended'");
  });

  test("스트림 요청이 실패하면 AudioContext를 닫아 누수를 막는다", async () => {
    const close = stubAudioContext();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, body: null }));

    await expect(playStreamingTts("m1")).rejects.toThrow("실시간 음성을 사용할 수 없습니다.");
    expect(close).toHaveBeenCalled();
  });

  test("스트림이 도중에 끊겨도 AudioContext를 닫아 누수를 막는다", async () => {
    const close = stubAudioContext();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: vi.fn().mockRejectedValue(new Error("network down")) }) },
    }));

    await expect(playStreamingTts("m1")).rejects.toThrow("network down");
    expect(close).toHaveBeenCalled();
  });

  test("첫 네트워크 바이트와 첫 오디오 렌더를 별도 지표로 정의한다", () => {
    const result: StreamingPlaybackResult = {
      firstByteMs: 100,
      firstRenderMs: 1_000,
      completeMs: 2_000,
      underrunMs: 0,
      pcmDurationMs: 2_500,
    };

    expect(result.firstByteMs).toBeLessThan(result.firstRenderMs);
  });

  test("새 WAV 재생은 기존 플레이어를 중지해 음성이 겹치지 않는다", async () => {
    const players: Array<{ play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; removeAttribute: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal("Audio", function AudioMock() {
      const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() };
      players.push(player);
      return player;
    });

    await playCompletedTts("https://example.test/first.wav");
    await playCompletedTts("https://example.test/second.wav");

    expect(players[0]?.pause).toHaveBeenCalledOnce();
    expect(players[0]?.removeAttribute).toHaveBeenCalledWith("src");
    expect(players[1]?.play).toHaveBeenCalledOnce();
  });
});
