// A place's name as the door to its page, which lives in the Business app
// (MESITA-3104). With no NEXT_PUBLIC_BUSINESS_URL the name is plain text and
// says why on hover; never a link to nowhere.

export function PlaceDoor({
  href,
  id,
  className,
  children,
}: {
  href: string | null;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span id={id} className={className} title="NEXT_PUBLIC_BUSINESS_URL is not set">
        {children}
      </span>
    );
  }
  return (
    <a id={id} href={href} className={className}>
      {children}
    </a>
  );
}
