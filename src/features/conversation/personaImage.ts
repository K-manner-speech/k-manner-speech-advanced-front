const supportedEmotions = new Set([
  "neutral",
  "happy",
  "sad",
  "angry",
  "curious",
  "embarrassment",
]);

/** 이미지가 아직 없는 페르소나의 자리 표시자. 다른 인물의 얼굴로 대신하지 않는다. */
export const PERSONA_PLACEHOLDER = "/personas/placeholder.svg";

/**
 * 면접관이 임시로 빌려 쓰는 얼굴.
 *
 * 면접방에는 페르소나 행이 없어 `avatar_key` 가 비어 있다. 전용 면접관
 * 페르소나를 만들면 이 상수와 쓰는 곳을 함께 지운다.
 */
export const INTERVIEWER_AVATAR_KEY = "test-team-lead";

/** 면접관으로 나서는 페르소나의 이름과 역할. 백엔드의 면접관 음성과 같은 인물이다. */
export const INTERVIEWER_NAME = "김민준 팀장";
export const INTERVIEWER_ROLE = "개발팀장";

/** 폴더·파일명은 영문 소문자, 숫자, 하이픈만 쓴다(PERSONA_IMAGE_GUIDE 7절). */
const avatarKeyPattern = /^[a-z0-9-]+$/;

type ReactionMessage = {
  sender_type: string;
  sequence_no: number;
  emotion: { status: string; label: string | null } | null;
};

export function latestPersonaReaction(messages: ReactionMessage[]): string {
  const latest = [...messages]
    .sort((left, right) => right.sequence_no - left.sequence_no)
    .find(
      (message) =>
        message.sender_type === "persona" &&
        message.emotion?.status === "succeeded" &&
        Boolean(message.emotion.label && supportedEmotions.has(message.emotion.label)),
    );
  return latest?.emotion?.label ?? "neutral";
}

/** 감정 라벨을 허용 목록 안의 값으로 좁힌다. 모델 문자열을 경로에 그대로 붙이지 않는다. */
export function normalizeEmotion(label: string | null | undefined): string {
  return label && supportedEmotions.has(label) ? label : "neutral";
}

/**
 * 페르소나와 감정에 맞는 이미지 경로를 만든다.
 *
 * 인물은 `avatar_key`가 정하고 표정은 감정이 정한다. 예전에는 감정만으로
 * 경로를 만들어 모든 페르소나가 같은 얼굴을 썼다. 키가 없거나 규칙에 맞지
 * 않으면 자리 표시자를 쓴다. 없는 인물의 자리를 다른 인물로 채우면 사용자가
 * 누구와 이야기하는지 잘못 익히기 때문이다.
 */
export function personaImage(
  avatarKey: string | null | undefined,
  label?: string | null,
): string {
  if (!avatarKey || !avatarKeyPattern.test(avatarKey)) return PERSONA_PLACEHOLDER;
  return `/personas/${avatarKey}/${normalizeEmotion(label)}.png`;
}
