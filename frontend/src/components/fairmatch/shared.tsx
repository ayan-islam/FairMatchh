import { Children, isValidElement, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpRight, Inbox, LoaderCircle } from "lucide-react";

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
        : /Needs review|Closed|Cancelled|Not selected|Held/.test(text)
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
    <label className="fm-search-field">
      <span>{label}</span>
      <span className="fm-search">
        <Search size={17} aria-hidden="true" />
        <input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange("")}>
            Clear
          </button>
        )}
      </span>
    </label>
  );
}
export function LoadingState({ label = "Loading saved information" }: { label?: string }) {
  return (
    <div className="fm-loading-state" role="status" aria-live="polite">
      <LoaderCircle size={24} aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>Please wait a moment.</span>
      </div>
    </div>
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
  required,
  optional,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
}) {
  const control = Children.toArray(children).find(isValidElement);
  const controlProps = (control?.props || {}) as {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    value?: unknown;
  };
  const isRequired = required ?? !!controlProps.required;
  const valueLength =
    typeof controlProps.value === "string" ? controlProps.value.length : null;
  const tooShort =
    valueLength !== null &&
    valueLength > 0 &&
    typeof controlProps.minLength === "number" &&
    valueLength < controlProps.minLength;
  const lengthRule =
    typeof controlProps.minLength === "number" &&
    typeof controlProps.maxLength === "number"
      ? `${controlProps.minLength}–${controlProps.maxLength} characters`
      : typeof controlProps.minLength === "number"
        ? `At least ${controlProps.minLength} characters`
        : typeof controlProps.maxLength === "number"
          ? `Up to ${controlProps.maxLength} characters`
          : "";
  return (
    <label className="fm-field">
      <span>
        {label}
        {isRequired && (
          <b className="fm-required" aria-hidden="true">
            *
          </b>
        )}
        {optional && !isRequired && <em className="fm-optional">Optional</em>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
      {!error && lengthRule && (
        <small className={tooShort ? "fm-field-rule fm-field-rule--invalid" : "fm-field-rule"}>
          {lengthRule}
          {valueLength !== null ? ` · ${valueLength} entered` : ""}
        </small>
      )}
      {error && (
        <small className="fm-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
