"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, Panel, PageHeading, StatusBadge } from "./shared";
import { request } from "@/lib/api";
import { type Job, exportCsv } from "@/lib/demo-data";
import { toast } from "sonner";

type Criterion = { index:number; weight:number; anchors:string[]; essential:boolean; essentialReason:string };
type Rubric = { id:string; requirements:string[]; criteria:Criterion[]; version:number; reason:string; actor:string; at:string };
type Item = { index:number; rating:number|null; source:string; quote:string; reason:string };
type Review = { stage:string; rubricVersion:number; items:Item[]; scoreUnits:number|null; assessed:number; version:number; actor:string; at:string };
type Row = { applicationId:string; stage:string; rank:number|null; score:number|null; assessed:number; total:number; status:string; essentialGaps:string[]; review:Review|null };
type Board = { jobId:string; jobTitle:string; stage:string; snapshot:string; requirements:string[]; rubric:Rubric|null; rubricCurrent:boolean; ranked:Row[]; pending:Row[]; rubricHistory:Rubric[] };
type Report = { applicationId:string; stage:string; snapshot:string; rubric:Rubric; sources:{field:string;text:string}[]; latestReview:Review|null; current:boolean; version:number; history:Review[] };
const ratings=["0 - Not demonstrated after assessment","1 - Limited demonstration","2 - Partial demonstration","3 - Meets the requirement","4 - Exceeds the requirement"];
const stages=["New","Shortlisted","Interview","Offer","Hired","Not selected","Withdrawn"];
const sourceLabels:Record<string,string>={experience:"Work experience",education:"Education",skills:"Skills",example:"Work example",none:"No supporting passage"};
export function CandidateRanking({jobs,auth,initialJobId}:{jobs:Job[];auth:string;initialJobId?:string}) {
 const [jobId,setJobId]=useState(initialJobId||jobs[0]?.id||"");
 const [stage,setStage]=useState("New"); const [revision,setRevision]=useState(0);
 const [board,setBoard]=useState<Board>(); const [error,setError]=useState("");
 const [editing,setEditing]=useState(false); const [application,setApplication]=useState<string>();
 useEffect(()=>{let cancelled=false; if(!jobId)return;
  void request<Board>(`employer/jobs/${encodeURIComponent(jobId)}/ranking?stage=${encodeURIComponent(stage)}`,"GET",undefined,auth).then(value=>{if(!cancelled){setBoard(value);setError("");}}).catch(e=>{if(!cancelled)setError(e.message);});
  return()=>{cancelled=true;};
 },[jobId,stage,auth,revision]);
 const current=board?.jobId===jobId&&board.stage===stage?board:undefined;
 function refresh(){setBoard(undefined);setRevision(v=>v+1);}
 return <>
  <PageHeading eyebrow="EXPLAINED COMPARISON" title="Candidate ranking" description="Compare reviewed evidence for one job and one hiring stage. Hiring decisions remain with your team." actions={<Button variant="outline" onClick={refresh}>Refresh ranking</Button>}/>
  <div className="fm-notice"><div><strong>Set a consistent rubric before assessing candidates.</strong><p>Use job-related competencies, not identity, university prestige, CV design or keyword repetition. Missing evidence stays Not assessed. Scores are rubric results, not probabilities of success.</p></div></div>
  <div className="fs-ranking-filters">
   <Field label="Ranking job"><select value={jobId} onChange={e=>{setJobId(e.target.value);setBoard(undefined);}}><option value="" disabled>Select a job</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.title} · {j.status}</option>)}</select></Field>
   <Field label="Hiring stage to compare"><select value={stage} onChange={e=>{setStage(e.target.value);setBoard(undefined);}}>{stages.map(s=><option key={s}>{s}</option>)}</select></Field>
  </div>
  {error&&<p role="alert" className="fm-error">{error}</p>}
  {!jobs.length&&<p>Create and save a job draft with requirements first, then configure its ranking rubric here before publishing.</p>}
  {jobId&&!current&&!error&&<p role="status">Loading ranking...</p>}
  {current&&<>
   <Panel className="fs-ranking-panel" title="Scoring rubric" description="Each requirement gets a weight and five defined rating levels. Weights must total 100%.">
    <p>{current.rubricCurrent?`Version ${current.rubric!.version} · Saved by ${current.rubric!.actor} · ${new Date(current.rubric!.at).toLocaleString()}`:current.rubric?"Job requirements changed. Update the rubric and reassess candidates.":"No rubric saved yet. Candidates are not ranked until you configure and assess the requirements."}</p>
    <Button variant="outline" disabled={!current.requirements.length} onClick={()=>setEditing(true)}>{current.rubric?"Edit scoring rubric":"Configure scoring rubric"}</Button>
    {!current.requirements.length&&<p>Add job-related requirements in Jobs → Edit first.</p>}
    {current.rubricCurrent&&<details className="fs-ranking-details"><summary>View weights and rating definitions</summary>{current.rubric!.criteria.map(c=><section key={c.index}><h3>{current.requirements[c.index]} · {c.weight}% {c.essential?"· Essential":""}</h3>{c.essential&&<p>Why essential: {c.essentialReason}</p>}<ol start={0}>{c.anchors.map((a,i)=><li key={i}><strong>{ratings[i]}:</strong> {a}</li>)}</ol></section>)}</details>}
    {current.rubricHistory.length>0&&<details className="fs-ranking-details"><summary>Rubric change history ({current.rubricHistory.length})</summary>{current.rubricHistory.map(r=><section key={r.version}><h3>Version {r.version}</h3><p>{r.reason} · {r.actor} · {new Date(r.at).toLocaleString()}</p><ul>{r.criteria.map(c=><li key={c.index}>{r.requirements[c.index]}: {c.weight}%</li>)}</ul></section>)}</details>}
   </Panel>
   <div className="fs-ranking-summary"><StatusBadge>{current.ranked.length} fully assessed</StatusBadge><StatusBadge>{current.pending.length} awaiting assessment or outside ranking</StatusBadge><Button variant="outline" onClick={()=>exportCsv("fairmatch-ranking.csv",[["Job","Stage","Rubric version","Rank","Application","Score / 100","Assessed","Total","Status","Essential requirements to clarify"],...[...current.ranked,...current.pending].map(r=>[current.jobTitle,stage,String(current.rubric?.version||0),r.rank===null?"":String(r.rank),r.applicationId,r.score===null?"":String(r.score),String(r.assessed),String(r.total),r.status,r.essentialGaps.join("; ")])])}>Export this comparison</Button></div>
   <RankingRows title="Completed assessments" description="Equal scores share a rank. Essential requirements needing clarification stay visible; they do not trigger automatic rejection." rows={current.ranked} rubric={current.rubric} onReview={setApplication} enabled={current.rubricCurrent}/>
   <RankingRows title="Assessment queue" description="Missing, incomplete or stale reviews are not treated as zero scores. Complete the same assessment before comparing." rows={current.pending} rubric={current.rubric} onReview={setApplication} enabled={current.rubricCurrent&&!['Withdrawn','Not selected'].includes(stage)}/>
  </>}
  {editing&&current&&<RubricEditor board={current} auth={auth} onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);refresh();toast.success("Rubric saved. Previous scores require reassessment.");}}/>}
  {application&&<RankingReview jobId={jobId} applicationId={application} auth={auth} onClose={()=>setApplication(undefined)} onSaved={()=>{setApplication(undefined);refresh();toast.success("Assessment saved. Hiring stage unchanged.");}}/>}
 </>;
}
function RankingRows({title,description,rows,rubric,onReview,enabled}:{title:string;description:string;rows:Row[];rubric:Rubric|null;onReview:(id:string)=>void;enabled:boolean}) {
 return <Panel className="fs-ranking-panel" title={title} description={description}>
  {!rows.length?<p>No applications in this section for the selected job and stage.</p>:rows.map(row=><section className="fs-ranking-row" key={row.applicationId}>
   <div className="fs-ranking-row-heading"><div><h3>{row.rank!==null?`Rank ${row.rank} · `:""}{row.applicationId}</h3><p>{row.status} · {row.assessed}/{row.total} criteria assessed</p></div><strong>{row.score===null?"Not ranked":`${row.score.toFixed(2)} / 100`}</strong></div>
   {!!row.essentialGaps.length&&<p className="fs-extraction-note">Essential requirements needing clarification: {row.essentialGaps.join("; ")}. The recruiter must review these explicitly.</p>}
   <Button variant="outline" disabled={!enabled} onClick={()=>onReview(row.applicationId)}>{row.review?"Review or update assessment":"Assess candidate"}</Button>
   {row.review&&rubric&&<details className="fs-ranking-details"><summary>Why this result?</summary><p>Reviewer: {row.review.actor} · {new Date(row.review.at).toLocaleString()} · Rubric {row.review.rubricVersion} · Review {row.review.version}</p>{row.review.items.map(i=>{const c=rubric.criteria[i.index];return <section key={i.index}><h3>{rubric.requirements[i.index]}</h3><p>{i.rating===null?"Not assessed":`${i.rating}/4 × ${c.weight}% = ${(i.rating*c.weight/4).toFixed(2)} points`}</p>{i.quote&&<blockquote>{i.quote}</blockquote>}<p>{sourceLabels[i.source] || "Candidate clarification"} · {i.reason||"Awaiting assessment"}</p></section>;})}</details>}
  </section>)}
 </Panel>;
}
function RubricEditor({board,auth,onClose,onSaved}:{board:Board;auth:string;onClose:()=>void;onSaved:()=>void}) {
 const [criteria,setCriteria]=useState<Criterion[]>(board.rubricCurrent?board.rubric!.criteria:board.requirements.map((_,index)=>({index,weight:Math.floor(100/board.requirements.length)+(index<100%board.requirements.length?1:0),anchors:["After assessment, the required competency was not demonstrated.","Demonstrates basic awareness but cannot explain a relevant contribution.","Demonstrates part of the requirement with a limited relevant example.","Demonstrates the requirement with a specific contribution and clear explanation.","Demonstrates the requirement with a clear contribution, outcome and justified improvements."],essential:false,essentialReason:""})));
 const [reason,setReason]=useState("");const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const total=criteria.reduce((sum,c)=>sum+c.weight,0);
 function edit(index:number,change:Partial<Criterion>){setCriteria(old=>old.map(c=>c.index===index?{...c,...change}:c));setConfirmed(false);}
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="fm-dialog fm-dialog-wide fs-review-dialog"><DialogHeader><DialogTitle>Configure scoring rubric</DialogTitle><DialogDescription>{board.jobTitle} · Use consistent, job-specific rating definitions for everyone.</DialogDescription></DialogHeader><div className="fm-dialog-body fs-form">
  <p>The starting weights and descriptions are editable templates, not validated standards. Adapt the descriptions to the actual work before using them. Save this rubric while the job is a draft where possible. Every saved change invalidates all previous scores.</p>
  {criteria.map(c=><section className="fs-source fs-criterion" key={c.index}><h3>{c.index+1}. {board.requirements[c.index]}</h3><Field label={`Weight for criterion ${c.index+1} (%)`}><Input type="number" min={1} max={100} value={c.weight} onChange={e=>edit(c.index,{weight:Number(e.target.value)})}/></Field>
   {c.anchors.map((a,n)=><Field key={n} label={`Criterion ${c.index+1}: ${ratings[n]}`}><Textarea maxLength={500} value={a} onChange={e=>edit(c.index,{anchors:c.anchors.map((v,i)=>i===n?e.target.value:v)})}/></Field>)}
   <label className="fm-check-row"><input type="checkbox" checked={c.essential} onChange={e=>edit(c.index,{essential:e.target.checked})}/><span>This is an essential requirement (ratings below 3 need explicit clarification).</span></label>
   {c.essential&&<Field label={`Why criterion ${c.index+1} is essential`}><Textarea maxLength={500} value={c.essentialReason} onChange={e=>edit(c.index,{essentialReason:e.target.value})}/></Field>}
  </section>)}
  <Field label="Reason for this rubric or change"><Textarea maxLength={1500} value={reason} onChange={e=>{setReason(e.target.value);setConfirmed(false);}}/></Field>
  <label className="fm-check-row"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I checked these weights and rating descriptions against the job. I will apply them consistently and will not score identity, prestige or unrelated personal characteristics.</span></label>
  {error&&<p role="alert" className="fm-error">{error}</p>}
 </div><div className="fs-review-footer"><p>Total weight: <strong>{total}%</strong> (must be 100%). Changes require reassessment for all candidates.</p><div className="fs-actions"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy||!confirmed||total!==100||reason.trim().length<20} onClick={async()=>{setBusy(true);setError("");try{await request(`employer/jobs/${board.jobId}/ranking/rubric`,"PUT",{snapshot:board.snapshot,expectedVersion:board.rubric?.version||0,criteria,reason,confirmed},auth);onSaved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?"Saving...":"Save scoring rubric"}</Button></div></div></DialogContent></Dialog>;
}
function RankingReview({jobId,applicationId,auth,onClose,onSaved}:{jobId:string;applicationId:string;auth:string;onClose:()=>void;onSaved:()=>void}) {
 const [report,setReport]=useState<Report>();const [items,setItems]=useState<Item[]>([]);const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [revision,setRevision]=useState(0);
 const path=`employer/jobs/${jobId}/ranking/applications/${applicationId}`;
 useEffect(()=>{let cancelled=false;void request<Report>(path,"GET",undefined,auth).then(r=>{if(!cancelled){setReport(r);setItems(r.current?r.latestReview!.items:r.rubric.criteria.map(c=>({index:c.index,rating:null,source:"none",quote:"",reason:""})));setConfirmed(false);setError("");}}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};},[path,auth,revision]);
 function edit(index:number,change:Partial<Item>){setItems(old=>old.map(i=>i.index===index?{...i,...change}:i));setConfirmed(false);}
 const complete=items.length>0&&items.every(i=>i.rating!==null);
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="fm-dialog fm-dialog-wide fs-review-dialog"><DialogHeader><DialogTitle>Assess candidate evidence</DialogTitle><DialogDescription>{applicationId} · {report?.stage} · Rubric {report?.rubric.version}</DialogDescription></DialogHeader><div className="fm-dialog-body fs-form">
  {!report&&!error&&<p>Loading rubric and submitted evidence...</p>}
  <p>Leave missing or unclear evidence Not assessed and request clarification through Applications → Supporting information. The latest 20 candidate clarification replies are available as evidence; new replies invalidate previous scores. Zero means you assessed the competency and it was not demonstrated. Neither option changes the hiring stage.</p>
  {report?.latestReview&&!report.current&&<p className="fs-extraction-note">The prior assessment is stale. Assess the current evidence against the current rubric; old scores have not been copied.</p>}
  {report&&items.map(item=>{const c=report.rubric.criteria[item.index];return <section className="fs-source fs-criterion" key={item.index}>
   <h3>{item.index+1}. {report.rubric.requirements[item.index]} · {c.weight}%</h3>
   <details><summary>Rating definitions</summary><ol start={0}>{c.anchors.map((a,i)=><li key={i}><strong>{ratings[i]}:</strong> {a}</li>)}</ol></details>
   <Field label={`Rating for criterion ${item.index+1}`}><select value={item.rating===null?"":String(item.rating)} onChange={e=>edit(item.index,{rating:e.target.value===""?null:Number(e.target.value),...(e.target.value!==""&&e.target.value!=="0"&&item.source==="none"?{source:"experience",quote:""}:{})})}><option value="">Not assessed / needs clarification</option>{ratings.map((r,i)=><option value={i} key={i}>{r}</option>)}</select></Field>
   {item.rating!==null&&<p>{c.anchors[item.rating]}</p>}
   <Field label={`Evidence source for criterion ${item.index+1}`}><select value={item.source} onChange={e=>edit(item.index,{source:e.target.value,quote:""})}><option value="none" disabled={item.rating!==null&&item.rating>0}>No supporting passage</option>{report.sources.map((source,index)=><option value={source.field} key={source.field}>{sourceLabels[source.field] || `Candidate clarification ${index-3}`}</option>)}</select></Field>
   {item.source!=="none"&&<><details open><summary>Submitted {sourceLabels[item.source] || "candidate clarification"}</summary><pre>{report.sources.find(s=>s.field===item.source)?.text||"This field is empty."}</pre></details><Field label={`Exact quote for criterion ${item.index+1}`}><Textarea maxLength={1000} value={item.quote} onChange={e=>edit(item.index,{quote:e.target.value})}/></Field></>}
   <Field label={`Assessment reason for criterion ${item.index+1}`}><Textarea maxLength={1500} value={item.reason} onChange={e=>edit(item.index,{reason:e.target.value})} placeholder="Explain the rating against its definition, or record the clarification needed."/></Field>
  </section>;})}
  {!!report?.history.length&&<details className="fs-ranking-details"><summary>Previous assessments ({report.history.length})</summary>{report.history.map((r,n)=><section key={n}><h3>{r.stage} · Rubric {r.rubricVersion} · Review {r.version}</h3><p>{r.actor} · {new Date(r.at).toLocaleString()} · {r.scoreUnits===null?"Incomplete":`${r.scoreUnits/4}/100 (historical)`}</p>{r.items.map(i=><p key={i.index}>Criterion {i.index+1}: {i.rating===null?"Not assessed":`${i.rating}/4`} · {i.reason}{i.quote?` · Quote: ${i.quote}`:""}</p>)}</section>)}</details>}
  <label className="fm-check-row"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I checked each entered rating and its source. Unresolved evidence is marked Not assessed. I am saving an assessment, not a hiring decision.</span></label>
  {error&&<p role="alert" className="fm-error">{error}</p>}
 </div><div className="fs-review-footer"><p>{complete&&report?`Unsaved rubric score: ${items.reduce((sum,i)=>sum+i.rating!*report.rubric.criteria[i.index].weight/4,0).toFixed(2)}/100. Java validates and calculates the saved score.`:`${items.filter(i=>i.rating!==null).length}/${items.length} assessed. Incomplete reviews stay in the assessment queue without a rank.`}</p><div className="fs-actions"><Button variant="outline" disabled={busy} onClick={()=>{setReport(undefined);setItems([]);setConfirmed(false);setRevision(v=>v+1);}}>Reload and discard edits</Button><Button disabled={busy||!report||!confirmed} onClick={async()=>{if(!report)return;setBusy(true);setError("");try{await request(path,"POST",{snapshot:report.snapshot,expectedVersion:report.version,items,confirmed},auth);onSaved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?"Saving...":complete?"Save assessment":"Save incomplete assessment"}</Button></div></div></DialogContent></Dialog>;
}
