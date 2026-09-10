"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, Panel } from "./shared";
import { request } from "@/lib/api";
type Message = { id: string; sender: string; message: string; at: string };
export function ApplicationConversation({
  auth,
  id,
  employer = false,
  onClose,
}: {
  auth: string;
  id: string;
  employer?: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const base = `${employer ? "employer" : "candidate"}/applications/${encodeURIComponent(id)}`;
  useEffect(() => {
    let cancelled = false;
    void request<Message[]>(`${base}/messages`, "GET", undefined, auth)
      .then((m) => !cancelled && setMessages(m))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [auth, base, revision]);
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="fm-dialog">
        <DialogHeader>
          <DialogTitle>Supporting information</DialogTitle>
          <DialogDescription>
            {id} · Saved application conversation
          </DialogDescription>
        </DialogHeader>
        <div className="fm-dialog-body">
          {!messages.length && <p>No messages yet.</p>}
          {messages.map((m) => (
            <Panel key={m.id} title={m.sender}>
              <p style={{ whiteSpace: "pre-wrap" }}>{m.message}</p>
              <small>{new Date(m.at).toLocaleString()}</small>
            </Panel>
          ))}
          <Field
            label={
              employer
                ? "Request job-related evidence"
                : "Reply with supporting evidence"
            }
          >
            <Textarea
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <p>
            Keep messages relevant to the job. Avoid names or contact details in
            evidence intended for blind review.
          </p>
          {error && (
            <p role="alert" className="fm-error">
              {error}
            </p>
          )}
        </div>
        <Button
          disabled={busy || text.trim().length < 20}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await request(
                `${base}/${employer ? "information-request" : "messages"}`,
                "POST",
                { message: text },
                auth,
              );
              setText("");
              setRevision((r) => r + 1);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving..." : "Send in-app message"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
