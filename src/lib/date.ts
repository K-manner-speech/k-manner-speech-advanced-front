/** 목록에 찍는 날짜. 시안은 2026/08/21 처럼 자리를 채운 형태를 쓴다.
 *
 * 자리를 채우지 않으면 줄마다 글자 수가 달라져 세로로 어긋나 보인다.
 * 화면마다 따로 만들면 대화방 목록과 피드백 목록의 표기가 갈린다. */
export function formatListDate(value: string): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}
