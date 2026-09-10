import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpRight, Inbox } from "lucide-react";

export function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  const text = String(children);
  const resolved =
    tone ||
    (/Strong|Active|Passed|Verified|Confirmed|Hired|Complete|Meets|Ready/.test(
      text,
    )
      ? "positive"
      : /Consider|Draft|Pending|Review|Scheduled|Interview/.test(text)
        ? "warning"
        : /Needs review|Closed|Not selected|Held/.test(text)
          ? "danger"
          : /Offer/.test(text)
            ? "purple"
            : "neutral");
  return <Badge className={"fm-badge fm-badge--" + resolved}>{children}</Badge>;
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="fm-page-heading">
      <div>
        {eyebrow && <p className="fm-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="fm-heading-actions">{actions}</div>}
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"fm-panel " + className}>
      {title && (
        <div className="fm-panel-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  icon?: ReactNode;
}) {
  return (
    <div className="fm-metric">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  label = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="fm-search">
      <Search size={17} />
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange("")}>
          Clear
        </button>
      )}
    </label>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="fm-empty">
      <Inbox size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function TextAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" className="fm-text-action" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </Button>
  );
}
export function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="fm-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && (
        <small className="fm-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
