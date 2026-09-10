"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, StatusBadge } from "./shared";
import { request } from "@/lib/api";
import type { Candidate } from "@/lib/demo-data";

type Item = { index: number; assessment: "Supported" | "Partial" | "Needs evidence"; source: string; quote: string; reason: string };
type Report = { applicationId: string; snapshot: string; criteria: string[]; sources: {field:string;text:string}[]; currentBand: string; version: number; reviewCurrent: boolean; latestReview?: {snapshot:string;items:Item[];band:string;actor:string;at:string} };
const fieldNames: Record<string,string> = {experience:"Work experience",education:"Education",skills:"Skills",example:"Work example",none:"No supporting passage found"};

export function CriteriaReviewDialog({candidate,auth,onClose,onSaved}:{candidate:Candidate;auth:string;onClose:()=>void;onSaved:(saved:Candidate)=>void}) {
  const [report,setReport]=useState<Report>();
  const [items,setItems]=useState<Item[]>([]);
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    void request<Report>(`employer/applications/${encodeURIComponent(candidate.id)}/criteria-review`,"GET",undefined,auth)
      .then(data=>{if(!cancelled){setReport(data);setError("");setConfirmed(false);setItems(data.latestReview?.snapshot===data.snapshot?data.latestReview.items:data.criteria.map((_,index)=>({index,assessment:"Needs evidence",source:"none",quote:"",reason:""})));}})
      .catch(e=>{if(!cancelled)setError(e.message);});
    return()=>{cancelled=true;};
  },[candidate.id,auth,revision]);
  function edit(index:number,changes:Partial<Item>){setItems(old=>old.map(i=>i.index===index?{...i,...changes}:i));setConfirmed(false);}
  const supported=items.filter(i=>i.assessment==="Supported").length;
  const partial=items.filter(i=>i.assessment==="Partial").length;
  const summary=items.length&&supported===items.length?"Strong evidence":supported+partial>0?"Consider":"Needs review";
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="fm-dialog fm-dialog-wide">
    <DialogHeader><DialogTitle>Review each job requirement</DialogTitle><DialogDescription>{candidate.id} · Assess submitted evidence, cite a passage and explain each decision.</DialogDescription></DialogHeader>
    <div className="fm-dialog-body fs-form">
      {error&&<p role="alert" className="fm-error">{error}</p>}
      {!report&&!error&&<p>Loading saved criteria and evidence...</p>}
      {report&&<>
        <p>Java summarizes your assessments: all requirements supported = Strong evidence; some supported or partial = Consider; otherwise = Needs review. This does not rank candidates, verify qualifications or change the hiring stage.</p>
        {report.latestReview&&<p>{report.reviewCurrent?"Saved review is current.":"The previous review needs checking against the current criteria or evidence band."} Last saved by {report.latestReview.actor} on {new Date(report.latestReview.at).toLocaleString()}.</p>}
        {!report.criteria.length&&<p>This job has no requirements to assess. Add job-related requirements before reviewing.</p>}
        {items.map(item=><section className="fs-source fs-criterion" key={item.index}>
          <h3>{item.index+1}. {report.criteria[item.index]}</h3>
          <Field label={`Assessment for requirement ${item.index+1}`}><select value={item.assessment} disabled={busy} onChange={e=>edit(item.index,{assessment:e.target.value as Item["assessment"],...(e.target.value!=="Needs evidence"&&item.source==="none"?{source:"experience"}:{})})}>
            <option>Supported</option><option>Partial</option><option>Needs evidence</option>
          </select></Field>
          <Field label={`Source for requirement ${item.index+1}`}><select value={item.source} disabled={busy} onChange={e=>edit(item.index,{source:e.target.value,quote:""})}>
            <option value="none" disabled={item.assessment!=="Needs evidence"}>No supporting passage found</option>
            {report.sources.map(source=><option value={source.field} key={source.field}>{fieldNames[source.field]}</option>)}
          </select></Field>
          {item.source!=="none"&&<>
            <details className="fs-source" open><summary>Submitted {fieldNames[item.source]?.toLowerCase()}</summary><pre>{report.sources.find(s=>s.field===item.source)?.text || "This submitted field is empty."}</pre></details>
            <Field label={`Exact supporting passage for requirement ${item.index+1}`}><Textarea disabled={busy} value={item.quote} maxLength={1000} onChange={e=>edit(item.index,{quote:e.target.value})} placeholder="Copy an exact passage from the submitted field above." /></Field>
          </>}
          <Field label={`Reason for requirement ${item.index+1}`}><Textarea disabled={busy} value={item.reason} minLength={15} maxLength={1500} onChange={e=>edit(item.index,{reason:e.target.value})} placeholder="Explain the evidence, its limits and any clarification needed." /></Field>
        </section>)}
        {!!items.length&&<><p>Unsaved summary: <StatusBadge>{summary}</StatusBadge> · {supported} supported, {partial} partial, {items.length-supported-partial} need evidence.</p>
          <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)} /> I reviewed every requirement and checked the quoted evidence.</label></>}
      </>}
    </div>
    <div className="fs-actions">
      <Button variant="outline" disabled={busy} onClick={()=>{setReport(undefined);setError("");setRevision(r=>r+1);}}>Reload and discard edits</Button>
      <Button disabled={busy||!report||!items.length||!confirmed||items.some(i=>i.reason.trim().length<15||(i.source!=="none"&&i.quote.trim().length<3))} onClick={async()=>{
        if(!report||busy)return;setBusy(true);setError("");
        try {const result=await request<{application:Candidate}>(`employer/applications/${encodeURIComponent(candidate.id)}/criteria-review`,"POST",{snapshot:report.snapshot,expectedVersion:report.version,expectedBand:report.currentBand,items,confirmed},auth);onSaved(result.application);}
        catch(e){setError((e as Error).message);}finally{setBusy(false);}
      }}>{busy?"Saving...":"Save requirement review"}</Button>
    </div>
  </DialogContent></Dialog>;
}
