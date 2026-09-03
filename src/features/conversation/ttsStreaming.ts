import { publicConfig } from "../../lib/env";
import { supabase } from "../../api/supabase";

const SAMPLE_RATE = 24_000;
export const STREAMING_TTS_BUFFER_POLICY = {
  initialSamples: SAMPLE_RATE,
  rebufferSamples: SAMPLE_RATE / 2,
} as const;

export const ttsProcessorSource = `
class TtsPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super(); this.queue=[]; this.offset=0; this.buffered=0; this.started=false;
    this.hasStarted=false;this.leftover=null;this.ended=false;this.endSent=false;this.underruns=0;
    this.port.onmessage=(event)=>{
      if(event.data==='end'){
        this.ended=true;
        if(this.buffered>0){this.started=true;this.hasStarted=true;}
        else if(!this.endSent){this.endSent=true;this.port.postMessage({type:'playback-ended',underruns:this.underruns});}
        return;
      }
      let bytes=new Uint8Array(event.data);
      if(this.leftover!==null){const joined=new Uint8Array(bytes.length+1);joined[0]=this.leftover;joined.set(bytes,1);bytes=joined;this.leftover=null;}
      if(bytes.length%2){this.leftover=bytes[bytes.length-1];bytes=bytes.slice(0,-1);}
      const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),samples=new Float32Array(bytes.length/2);
      for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;
      this.queue.push(samples);this.buffered+=samples.length;
      const threshold=this.hasStarted?${STREAMING_TTS_BUFFER_POLICY.rebufferSamples}:${STREAMING_TTS_BUFFER_POLICY.initialSamples};
      if(!this.started&&this.buffered>=threshold){this.started=true;this.hasStarted=true;}
    };
  }
  process(_inputs,outputs){const output=outputs[0][0];let written=0;
    if(this.started)while(written<output.length&&this.queue.length){const block=this.queue[0],count=Math.min(output.length-written,block.length-this.offset);output.set(block.subarray(this.offset,this.offset+count),written);written+=count;this.offset+=count;this.buffered-=count;if(this.offset===block.length){this.queue.shift();this.offset=0;}}
    if(written&&!this.first){this.first=true;this.port.postMessage({type:'first-render'});}
    if(this.started&&this.buffered===0){
      this.started=false;
      if(this.ended&&!this.endSent){this.endSent=true;this.port.postMessage({type:'playback-ended',underruns:this.underruns});}
      else if(!this.ended)this.underruns++;
    }
    return true;
  }
}
registerProcessor('tts-pcm-processor',TtsPcmProcessor);`;

export interface StreamingPlaybackResult {
  firstRenderMs: number;
  completeMs: number;
  underrunMs: number;
  pcmDurationMs: number;
}

interface PrimedPlayer {
  context: AudioContext;
  node: AudioWorkletNode;
}

let primedPlayer: Promise<PrimedPlayer> | null = null;
let activePlayback: { stop: () => void } | null = null;

export function stopActiveTtsPlayback(): void {
  const playback = activePlayback;
  activePlayback = null;
  playback?.stop();
}

async function createPlayer(): Promise<PrimedPlayer> {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  const moduleUrl = URL.createObjectURL(new Blob([ttsProcessorSource], { type: "text/javascript" }));
  try {
    await context.audioWorklet.addModule(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
  const node = new AudioWorkletNode(context, "tts-pcm-processor", { outputChannelCount: [1] });
  node.connect(context.destination);
  await context.resume();
  return { context, node };
}

export function primeStreamingTts(): void {
  if (typeof AudioContext === "undefined") return;
  if (primedPlayer) return;
  const attempt = createPlayer();
  primedPlayer = attempt;
  void attempt.catch(() => {
    if (primedPlayer === attempt) primedPlayer = null;
  });
}

export async function playStreamingTts(messageId: string): Promise<StreamingPlaybackResult> {
  stopActiveTtsPlayback();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");
  const player = primedPlayer ? await primedPlayer : await createPlayer();
  primedPlayer = null;
  const { context, node } = player;
  // stop()과 실패 경로가 겹쳐도 이미 닫힌 컨텍스트를 다시 닫지 않는다.
  const closePlayer = async () => {
    if (context.state !== "closed") await context.close().catch(() => undefined);
  };
  const controller = new AbortController();
  let rejectCancelled!: (reason: Error) => void;
  const cancelled = new Promise<never>((_resolve, reject) => { rejectCancelled = reject; });
  const playback = {
    stop: () => {
      controller.abort();
      void closePlayer();
      rejectCancelled(new Error("음성 재생이 취소되었습니다."));
    },
  };
  activePlayback = playback;
  const started = performance.now();
  let firstRender = 0;
  let underruns = 0;
  let resolveEnd!: () => void;
  const ended = new Promise<void>((resolve) => { resolveEnd = resolve; });
  const playbackFinished = Promise.race([ended, cancelled]);
  void playbackFinished.catch(() => undefined);
  node.port.onmessage = (event) => {
    if (event.data?.type === "first-render") firstRender = performance.now();
    if (event.data?.type === "playback-ended") { underruns = event.data.underruns; resolveEnd(); }
  };
  let bytes = 0;
  let completed = 0;
  try {
    const response = await fetch(
      `${publicConfig.VITE_API_BASE_URL}/api/v1/messages/${messageId}/audio/stream`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal },
    );
    if (!response.ok || !response.body) throw new Error("실시간 음성을 사용할 수 없습니다.");
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      const pcm = value.byteOffset === 0 && value.byteLength === value.buffer.byteLength
        ? value.buffer
        : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      node.port.postMessage(pcm, [pcm]);
    }
    completed = performance.now();
    if (!bytes) throw new Error("실시간 음성이 비어 있습니다.");
  } catch (error) {
    await closePlayer();
    if (activePlayback === playback) activePlayback = null;
    throw error;
  }
  node.port.postMessage("end");
  await playbackFinished;
  if (activePlayback === playback) activePlayback = null;
  window.setTimeout(() => { void closePlayer(); }, 100);
  return {
    firstRenderMs: firstRender - started,
    completeMs: completed - started,
    underrunMs: underruns * 128 / SAMPLE_RATE * 1000,
    pcmDurationMs: bytes / 2 / SAMPLE_RATE * 1000,
  };
}

export async function playCompletedTts(url: string, startAtMilliseconds = 0): Promise<void> {
  stopActiveTtsPlayback();
  const audio = new Audio(url);
  const playback = {
    stop: () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
  activePlayback = playback;
  if (startAtMilliseconds > 0) audio.currentTime = startAtMilliseconds / 1000;
  audio.onended = () => { if (activePlayback === playback) activePlayback = null; };
  audio.onerror = () => { if (activePlayback === playback) activePlayback = null; };
  await audio.play();
}
