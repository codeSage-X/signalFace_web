/** Keep shared post links clickable without interpreting message text as HTML. */
export function MessageText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>]+)/g);
  return <>{parts.map((part, index) => /^https?:\/\//.test(part)
    ? <a key={index} href={part} className="break-all underline underline-offset-2" target="_blank" rel="noopener noreferrer">{part}</a>
    : part)}</>;
}
