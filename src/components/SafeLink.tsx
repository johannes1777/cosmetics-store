import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { isExternalLink, isSafeLink } from "../lib/links";

// Renders a button/link only if the address passes the safety check again here,
// even though the database has already checked it.
export default function SafeLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  if (!isSafeLink(to)) return null;
  if (isExternalLink(to)) {
    return (
      <a className={className} href={to} target="_blank" rel="noopener noreferrer">
        {children}<span className="visually-hidden"> (opens in a new tab)</span>
      </a>
    );
  }
  return <Link to={to} className={className}>{children}</Link>;
}
