"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, Panel, PageHeading, StatusBadge } from "./shared";
import { request } from "@/lib/api";
import { type Candidate, type Job, exportCsv } from "@/lib/demo-data";
import { toast } from "sonner";
import { ArrowUpRight, CalendarDays, ChevronRight, ClipboardCheck, FileSearch, MessageSquareText, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";

type Criterion = { index:number; weight:number; anchors:string[]; essential:boolean; essentialReason:string };
type Rubric = { id:string; requirements:string[]; criteria:Criterion[]; version:number; reason:string; actor:string; at:string };
type Item = { index:number; rating:number|null; source:string; quote:string; reason:string };
type Review = { stage:string; rubricVersion:number; items:Item[]; scoreUnits:number|null; assessed:number; version:number; actor:string; at:string };
type Row = { applicationId:string; stage:string; rank:number|null; score:number|null; assessed:number; total:number; status:string; essentialGaps:string[]; review:Review|null };
type AutoMatch = { requirement:string; weight:number; matchedWords:string[]; totalTerms:number; source:string; excerpt:string; points:number };
type AutoRow = { applicationId:string; rank:number; score:number; matched:number; total:number; matches:AutoMatch[] };
type Board = { jobId:string; jobTitle:string; stage:string; snapshot:string; requirements:string[]; rubric:Rubric|null; rubricCurrent:boolean; autoRanked:AutoRow[]; ranked:Row[]; pending:Row[]; rubricHistory:Rubric[] };
type Report = { applicationId:string; stage:string; snapshot:string; rubric:Rubric; sources:{field:string;text:string}[]; latestReview:Review|null; current:boolean; version:number; history:Review[] };
const ratings=["0 - Not demonstrated after assessment","1 - Limited demonstration","2 - Partial demonstration","3 - Meets the requirement","4 - Exceeds the requirement"];
const stages=["New","Shortlisted","Interview","Offer","Hired","Not selected"];
const sourceLabels:Record<string,string>={experience:"Work experience",education:"Education",skills:"Skills",example:"Work example",cv_skills:"Shared CV skills",cv_courses:"Shared CV courses",cv_projects:"Shared CV projects",none:"No supporting passage"};
type CandidateAction = "evidence" | "review" | "request" | "stage" | "schedule";
export function CandidateRanking({jobs,candidates,auth,initialJobId,onCandidateAction}:{jobs:Job[];candidates:Candidate[];auth:string;initialJobId?:string;onCandidateAction:(action:CandidateAction,candidate:Candidate)=>void}) {
 const [jobId,setJobId]=useState(initialJobId||jobs[0]?.id||"");
 const [stage,setStage]=useState("New"); const [revision,setRevision]=useState(0);
 const [board,setBoard]=useState<Board>(); const [error,setError]=useState("");
 const [editing,setEditing]=useState(false); const [application,setApplication]=useState<string>();
 const [candidateMenu,setCandidateMenu]=useState<string>();
 useEffect(()=>{let cancelled=false; if(!jobId)return;
  void request<Board>(`employer/jobs/${encodeURIComponent(jobId)}/ranking?stage=${encodeURIComponent(stage)}`,"GET",undefined,auth).then(value=>{if(!cancelled){setBoard(value);setError("");}}).catch(e=>{if(!cancelled)setError(e.message);});
  return()=>{cancelled=true;};
 },[jobId,stage,auth,revision,candidates]);
 const current=board?.jobId===jobId&&board.stage===stage?board:undefined;
 function refresh(){setBoard(undefined);setRevision(v=>v+1);}
 const selectedCandidate=candidateMenu?candidates.find(candidate=>candidate.id===candidateMenu):undefined;
 const selectedAutomatic=candidateMenu&&current?current.autoRanked.find(row=>row.applicationId===candidateMenu):undefined;
 const selectedHuman=candidateMenu&&current?[...current.ranked,...current.pending].find(row=>row.applicationId===candidateMenu):undefined;
 const openCandidate=(id:string)=>{if(candidates.some(candidate=>candidate.id===id))setCandidateMenu(id);else toast.error("This application is no longer available. Refresh the ranking.");};
 const exportRanking=()=>current&&exportCsv("fairmatch-ranking.csv",[["Job","Stage","Application","Automatic rank","Text match / 100","Requirements matched","Requirements total","Human rank","Human rubric score / 100","Human assessment status"],...current.autoRanked.map(r=>{const human=[...current.ranked,...current.pending].find(h=>h.applicationId===r.applicationId);return [current.jobTitle,stage,r.applicationId,String(r.rank),String(r.score),String(r.matched),String(r.total),human?.rank===null||!human?"":String(human.rank),human?.score===null||!human?"":String(human.score),human?.status||""];})]);
 return <>
  <PageHeading eyebrow="EXPLAINED COMPARISON" title="Candidate ranking" description="Review an automatic, evidence-linked comparison and continue each candidate's hiring workflow from one place." actions={<Button variant="outline" onClick={refresh}><RefreshCw size={16}/>Refresh</Button>}/>
  <section className="fs-ranking-intro" aria-label="How automatic ranking works"><Sparkles size={20}/><div><strong>Automatic first-pass comparison</strong><p>FairMatch matches job-requirement terms with submitted application evidence. Use the cited passages to guide review; the match is not a qualification or hiring decision.</p></div></section>
  <section className="fs-ranking-toolbar" aria-label="Ranking controls">
   <div className="fs-ranking-filters">
    <Field label="Job"><select required value={jobId} onChange={e=>{setJobId(e.target.value);setBoard(undefined);}}><option value="" disabled>Select a job</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.title} · {j.status}</option>)}</select></Field>
    <Field label="Hiring stage"><select required value={stage} onChange={e=>{setStage(e.target.value);setBoard(undefined);}}>{stages.map(s=><option key={s}>{s}</option>)}</select></Field>
   </div>
   {current&&<div className="fs-ranking-toolbar-meta"><span><strong>{current.autoRanked.length}</strong> compared</span><span><strong>{current.ranked.length}</strong> assessed</span><Button variant="outline" onClick={exportRanking}>Export CSV</Button></div>}
  </section>
  {error&&<p role="alert" className="fm-error">{error}</p>}
  {!jobs.length&&<p>Create and save a job draft with requirements first, then configure its ranking rubric here before publishing.</p>}
  {jobId&&!current&&!error&&<p role="status">Loading ranking...</p>}
  {current&&<>
   <div className="fs-ranking-workspace">
    <Panel className="fs-ranking-results" title="Ranked candidates" description={`${current.jobTitle} · ${stage} · ${current.rubricCurrent?"Current rubric weights":"Equal requirement weights"}`}>
     {!current.requirements.length&&<p>Add clear job requirements in Jobs to enable automatic comparison.</p>}
     {current.requirements.length>0&&!current.autoRanked.length&&<div className="fs-ranking-empty"><FileSearch size={24}/><strong>No applications at this stage</strong><p>Choose another hiring stage or return when candidates reach this point.</p></div>}
     <div className="fs-ranking-list">{current.autoRanked.map(row=><article className="fs-ranking-candidate" key={row.applicationId}>
      <div className="fs-ranking-candidate-main"><span className="fs-ranking-position" aria-label={`Rank ${row.rank}`}>{row.rank}</span><div className="fs-ranking-identity"><button onClick={()=>openCandidate(row.applicationId)}>{row.applicationId}<ArrowUpRight size={15}/></button><p>{row.matched} of {row.total} requirements contain a text match</p></div><div className="fs-ranking-score"><strong>{row.score.toFixed(0)}</strong><span>/ 100 match</span></div></div>
      <div className="fs-ranking-meter" role="progressbar" aria-label="Automatic text match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(row.score)}><span style={{width:`${Math.max(0,Math.min(100,row.score))}%`}}/></div>
      <details className="fs-ranking-details"><summary>Why this position?<ChevronRight size={16}/></summary>{row.matches.map((match,index)=><section key={index}><h3>{match.requirement} · {match.weight}% weight</h3><p>{match.matchedWords.length}/{match.totalTerms} distinct requirement terms found in one passage · {match.points.toFixed(2)} match points</p>{match.matchedWords.length>0&&<p>Matched terms: {match.matchedWords.join(", ")}</p>}{match.excerpt?<><p>Source: {sourceLabels[match.source]||"Candidate clarification"}</p><blockquote>{match.excerpt}</blockquote></>:<p>No matching passage in the submitted application. This does not prove the candidate lacks the requirement.</p>}</section>)}</details>
     </article>)}</div>
    </Panel>
    <Panel className="fs-ranking-rubric" title="Scoring setup" description="Controls requirement weights and optional human assessment.">
     <div className="fs-ranking-rubric-status"><SlidersHorizontal size={19}/><div><strong>{current.rubricCurrent?`Rubric version ${current.rubric!.version}`:current.rubric?"Rubric needs updating":"Equal weights in use"}</strong><p>{current.rubricCurrent?`Saved ${new Date(current.rubric!.at).toLocaleDateString()}`:"Automatic ranking remains available."}</p></div></div>
     <Button variant="outline" disabled={!current.requirements.length} onClick={()=>setEditing(true)}>{current.rubric?"Edit scoring rubric":"Configure rubric"}</Button>
     {!current.requirements.length&&<p>Add job requirements in Jobs first.</p>}
     {current.rubricCurrent&&<details className="fs-ranking-details"><summary>Weights and definitions<ChevronRight size={16}/></summary>{current.rubric!.criteria.map(c=><section key={c.index}><h3>{current.requirements[c.index]} · {c.weight}% {c.essential?"· Essential":""}</h3>{c.essential&&<p>Why essential: {c.essentialReason}</p>}<ol start={0}>{c.anchors.map((a,i)=><li key={i}><strong>{ratings[i]}:</strong> {a}</li>)}</ol></section>)}</details>}
     {current.rubricHistory.length>0&&<details className="fs-ranking-details"><summary>Change history ({current.rubricHistory.length})<ChevronRight size={16}/></summary>{current.rubricHistory.map(r=><section key={r.version}><h3>Version {r.version}</h3><p>{r.reason} · {r.actor} · {new Date(r.at).toLocaleString()}</p></section>)}</details>}
    </Panel>
   </div>
   <details className="fs-ranking-assessments"><summary><div><span className="fs-ranking-assessment-icon"><ClipboardCheck size={19}/></span><span><strong>Optional recruiter assessments</strong><small>Use a consistent rubric for a deeper human review. Automatic ranking does not require this.</small></span></div><span>{current.ranked.length} complete · {current.pending.length} waiting</span></summary><div className="fs-ranking-assessment-body">
    <RankingRows title="Completed assessments" description="Equal scores share a rank. Essential gaps stay visible for clarification." rows={current.ranked} rubric={current.rubric} onReview={setApplication} onOpen={openCandidate} enabled={current.rubricCurrent}/>
    <RankingRows title="Assessment queue" description="Missing or stale reviews remain unranked instead of being treated as zero." rows={current.pending} rubric={current.rubric} onReview={setApplication} onOpen={openCandidate} enabled={current.rubricCurrent&&!['Withdrawn','Not selected'].includes(stage)}/>
   </div></details>
  </>}
  {editing&&current&&<RubricEditor board={current} auth={auth} onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);refresh();toast.success("Rubric saved. Previous scores require reassessment.");}}/>}
  {application&&<RankingReview jobId={jobId} applicationId={application} auth={auth} onClose={()=>setApplication(undefined)} onSaved={()=>{setApplication(undefined);refresh();toast.success("Assessment saved. Hiring stage unchanged.");}}/>}
  {candidateMenu&&selectedCandidate&&<Dialog open onOpenChange={value=>!value&&setCandidateMenu(undefined)}><DialogContent className="fm-dialog fm-dialog-wide fs-candidate-action-dialog"><DialogHeader><DialogTitle>Candidate action centre</DialogTitle><DialogDescription>Review the anonymous application and continue its hiring workflow.</DialogDescription></DialogHeader><div className="fm-dialog-body"><div className="fs-candidate-action-heading"><span className="fs-ranking-position">{selectedAutomatic?.rank||"—"}</span><div><button className="fs-candidate-action-id" onClick={()=>{setCandidateMenu(undefined);onCandidateAction("evidence",selectedCandidate);}}>{selectedCandidate.id}<ArrowUpRight size={16}/></button><p>{current?.jobTitle} · {selectedCandidate.stage}</p></div>{selectedAutomatic&&<StatusBadge>{selectedAutomatic.score.toFixed(0)} / 100 match</StatusBadge>}</div><div className="fs-candidate-action-facts"><div><span>Evidence band</span><strong>{selectedCandidate.band}</strong></div><div><span>Requirements matched</span><strong>{selectedAutomatic?`${selectedAutomatic.matched} of ${selectedAutomatic.total}`:"Not compared"}</strong></div><div><span>Human assessment</span><strong>{selectedHuman?.status||"Not started"}</strong></div></div><p className="fs-candidate-action-help">Choose the next task. Each action uses the same saved application and returns to this ranking when closed.</p><div className="fs-candidate-action-grid"><Button variant="outline" onClick={()=>{setCandidateMenu(undefined);onCandidateAction("evidence",selectedCandidate);}}><FileSearch size={17}/>View all evidence</Button><Button variant="outline" onClick={()=>{setCandidateMenu(undefined);onCandidateAction("review",selectedCandidate);}}><ClipboardCheck size={17}/>Review requirements</Button><Button variant="outline" onClick={()=>{setCandidateMenu(undefined);onCandidateAction("request",selectedCandidate);}}><MessageSquareText size={17}/>Request information</Button><Button variant="outline" onClick={()=>{setCandidateMenu(undefined);onCandidateAction("schedule",selectedCandidate);}}><CalendarDays size={17}/>Schedule interview</Button><Button variant="outline" onClick={()=>{setCandidateMenu(undefined);setApplication(selectedCandidate.id);}} disabled={!current?.rubricCurrent}><SlidersHorizontal size={17}/>Assess with rubric</Button><Button onClick={()=>{setCandidateMenu(undefined);onCandidateAction("stage",selectedCandidate);}}>Update hiring stage<ChevronRight size={17}/></Button></div>{!current?.rubricCurrent&&<p className="fs-candidate-action-note">Configure a rubric to enable the optional human assessment.</p>}</div></DialogContent></Dialog>}
 </>;
}
function RankingRows({title,description,rows,rubric,onReview,onOpen,enabled}:{title:string;description:string;rows:Row[];rubric:Rubric|null;onReview:(id:string)=>void;onOpen:(id:string)=>void;enabled:boolean}) {
 return <Panel className="fs-ranking-panel" title={title} description={description}>
  {!rows.length?<p>No applications in this section for the selected job and stage.</p>:rows.map(row=><section className="fs-ranking-row" key={row.applicationId}>
   <div className="fs-ranking-row-heading"><div><button className="fs-candidate-link" onClick={()=>onOpen(row.applicationId)}>{row.rank!==null?`Rank ${row.rank} · `:""}{row.applicationId}<ArrowUpRight size={14}/></button><p>{row.status} · {row.assessed}/{row.total} criteria assessed</p></div><strong>{row.score===null?"Not ranked":`${row.score.toFixed(2)} / 100`}</strong></div>
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
  {criteria.map(c=><section className="fs-source fs-criterion" key={c.index}><h3>{c.index+1}. {board.requirements[c.index]}</h3><Field label={`Weight for criterion ${c.index+1} (%)`}><Input required type="number" min={1} max={100} value={c.weight} onChange={e=>edit(c.index,{weight:Number(e.target.value)})}/></Field>
   {c.anchors.map((a,n)=><Field key={n} label={`Criterion ${c.index+1}: ${ratings[n]}`}><Textarea required minLength={10} maxLength={500} value={a} onChange={e=>edit(c.index,{anchors:c.anchors.map((v,i)=>i===n?e.target.value:v)})}/></Field>)}
   <label className="fm-check-row"><input type="checkbox" checked={c.essential} onChange={e=>edit(c.index,{essential:e.target.checked})}/><span>This is an essential requirement (ratings below 3 need explicit clarification).</span></label>
   {c.essential&&<Field label={`Why criterion ${c.index+1} is essential`}><Textarea required minLength={20} maxLength={500} value={c.essentialReason} onChange={e=>edit(c.index,{essentialReason:e.target.value})}/></Field>}
  </section>)}
  <Field label="Reason for this rubric or change"><Textarea required minLength={20} maxLength={1500} value={reason} onChange={e=>{setReason(e.target.value);setConfirmed(false);}}/></Field>
  <label className="fm-check-row"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I checked these weights and rating descriptions against the job. I will apply them consistently and will not score identity, prestige or unrelated personal characteristics.<b className="fm-required" aria-hidden="true">*</b></span></label>
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
   {item.source!=="none"&&<><details open><summary>Submitted {sourceLabels[item.source] || "candidate clarification"}</summary><pre>{report.sources.find(s=>s.field===item.source)?.text||"This field is empty."}</pre></details><Field label={`Exact quote for criterion ${item.index+1}`}><Textarea required minLength={3} maxLength={1000} value={item.quote} onChange={e=>edit(item.index,{quote:e.target.value})}/></Field></>}
   <Field label={`Assessment reason for criterion ${item.index+1}`} optional={item.rating===null}><Textarea required={item.rating!==null} minLength={item.rating!==null?15:undefined} maxLength={1500} value={item.reason} onChange={e=>edit(item.index,{reason:e.target.value})} placeholder="Explain the rating against its definition, or record the clarification needed."/></Field>
  </section>;})}
  {!!report?.history.length&&<details className="fs-ranking-details"><summary>Previous assessments ({report.history.length})</summary>{report.history.map((r,n)=><section key={n}><h3>{r.stage} · Rubric {r.rubricVersion} · Review {r.version}</h3><p>{r.actor} · {new Date(r.at).toLocaleString()} · {r.scoreUnits===null?"Incomplete":`${r.scoreUnits/4}/100 (historical)`}</p>{r.items.map(i=><p key={i.index}>Criterion {i.index+1}: {i.rating===null?"Not assessed":`${i.rating}/4`} · {i.reason}{i.quote?` · Quote: ${i.quote}`:""}</p>)}</section>)}</details>}
  <label className="fm-check-row"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I checked each entered rating and its source. Unresolved evidence is marked Not assessed. I am saving an assessment, not a hiring decision.</span></label>
  {error&&<p role="alert" className="fm-error">{error}</p>}
 </div><div className="fs-review-footer"><p>{complete&&report?`Unsaved rubric score: ${items.reduce((sum,i)=>sum+i.rating!*report.rubric.criteria[i.index].weight/4,0).toFixed(2)}/100. Java validates and calculates the saved score.`:`${items.filter(i=>i.rating!==null).length}/${items.length} assessed. Incomplete reviews stay in the assessment queue without a rank.`}</p><div className="fs-actions"><Button variant="outline" disabled={busy} onClick={()=>{setReport(undefined);setItems([]);setConfirmed(false);setRevision(v=>v+1);}}>Reload and discard edits</Button><Button disabled={busy||!report||!confirmed} onClick={async()=>{if(!report)return;setBusy(true);setError("");try{await request(path,"POST",{snapshot:report.snapshot,expectedVersion:report.version,items,confirmed},auth);onSaved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?"Saving...":complete?"Save assessment":"Save incomplete assessment"}</Button></div></div></DialogContent></Dialog>;
}
