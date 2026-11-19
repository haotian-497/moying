export function QuotedText({
  text,
  quote,
  markId,
  className,
}: {
  text: string;
  quote: string;
  markId?: string;
  className?: string;
}) {
  const index = quote ? text.indexOf(quote) : -1;
  if (index < 0) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, index)}
      <mark id={markId} className="scroll-mt-28 rounded bg-cinnabar-soft px-0.5 text-inherit">
        {quote}
      </mark>
      {text.slice(index + quote.length)}
    </span>
  );
}
