import { useState } from "react";
import { PERSONA_PLACEHOLDER, personaImage } from "../../features/conversation/personaImage";

type PersonaAvatarProps = {
  /** 페르소나의 avatar_key. 인물을 정한다. */
  avatarKey: string | null | undefined;
  /** 감정 라벨. 표정을 정한다. 없으면 neutral. */
  emotion?: string | null;
  /** 이미지를 설명하는 대체 텍스트. 장식용이면 빈 문자열을 넘긴다. */
  alt: string;
  className?: string;
};

/**
 * 페르소나 얼굴. 파일이 아직 없으면 자리 표시자로 바꾼다.
 *
 * 페르소나별 이미지는 순차적으로 준비되므로 일부 인물의 파일이 없는 기간이
 * 생긴다. 그동안 깨진 이미지를 보여 주지 않도록 불러오기 실패를 받아 넘긴다.
 */
export function PersonaAvatar({ avatarKey, emotion, alt, className }: PersonaAvatarProps) {
  const source = personaImage(avatarKey, emotion);
  // 실패한 경로를 기억한다. 감정이나 인물이 바뀌면 새 경로로 다시 시도해야 한다.
  const [failedSource, setFailedSource] = useState<string | null>(null);

  return (
    <img
      className={className}
      src={failedSource === source ? PERSONA_PLACEHOLDER : source}
      alt={alt}
      onError={() => setFailedSource(source)}
    />
  );
}
