package com.fairmatch.interview;

import java.time.*;
import java.util.*;
import com.fairmatch.application.ApplicationService;
import com.fairmatch.audit.AuditService;
import com.fairmatch.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InterviewService {
    private static final ZoneId DHAKA = ZoneId.of("Asia/Dhaka");
    private final InterviewRepository interviews;
    private final ApplicationService applications;
    private final AuditService audit;

    InterviewService(InterviewRepository interviews, ApplicationService applications, AuditService audit) {
        this.interviews=interviews; this.applications=applications; this.audit=audit;
    }
    public List<InterviewView> list(String organizationId) {
        return interviews.findByOrganizationIdOrderByDateAscTimeAsc(organizationId).stream().map(InterviewDocument::view).toList();
    }
    public List<CandidateInterview> candidateList(String ownerId) {
        var ids=applications.owned(ownerId).stream().map(ApplicationService.CandidateApplication::id).toList();
        return interviews.findByCandidateIdInOrderByDateAscTimeAsc(ids).stream().map(i->new CandidateInterview(i.id(),i.candidateId(),i.jobId(),i.date().toString(),i.time().toString(),i.format(),i.location(),i.status(),i.cancellationReason())).toList();
    }
    public record CandidateInterview(String id,String candidateId,String jobId,String date,String time,String format,String location,String status,String cancellationReason){}
    @org.springframework.context.event.EventListener
    public void applicationFinalized(ApplicationService.FinalDecision event) {
        // Synchronous event handling joins the stage/withdrawal transaction.
        interviews.findByCandidateIdInOrderByDateAscTimeAsc(List.of(event.applicationId())).stream()
            .filter(i->i.organizationId().equals(event.organizationId())&&i.status().equals("Scheduled"))
            .forEach(i->cancel(event.organizationId(),i.id(),new CancellationRequest(event.reason(),i.version()),event.actor()));
    }
    @Transactional
    public InterviewView schedule(String organizationId, String id, InterviewRequest r, String actor) {
        if (!r.date().atTime(r.time()).atZone(DHAKA).toInstant().isAfter(Instant.now()))
            bad("Choose an interview date and time in the future (Asia/Dhaka).");
        if (r.time().getSecond()!=0 || r.time().getNano()!=0) bad("Choose a time in whole minutes.");
        if (r.location().isBlank()) bad("Add the meeting link, address or phone instructions.");
        var previous = id==null ? null : requireScheduled(organizationId, id, r.expectedVersion());
        if (previous!=null && !previous.candidateId().equals(r.candidateId()))
            bad("An interview's candidate cannot be changed. Cancel it and schedule a new interview.");
        var jobId=applications.requireInterviewCandidate(organizationId, r.candidateId());
        var now=Instant.now();
        var saved=interviews.save(new InterviewDocument(id==null ? "INT-"+UUID.randomUUID() : id,
            organizationId,r.candidateId(),jobId,r.date(),r.time(),r.format(),r.location().trim(),"Scheduled",
            List.of(0,0,0,0),"",null,previous==null ? now : previous.createdAt(),now,actor,
            previous==null ? null : previous.version()));
        audit.record(organizationId,previous==null ? "INTERVIEW_SCHEDULED" : "INTERVIEW_RESCHEDULED",saved.id(),
            saved.candidateId()+" | "+saved.date()+" "+saved.time()+" Asia/Dhaka | "+saved.format(),actor);
        applications.notifyCandidate(organizationId,saved.candidateId(),"Interview scheduled",saved.date()+" at "+saved.time()+" Asia/Dhaka. "+saved.location());
        return saved.view();
    }
    @Transactional
    public InterviewView evaluate(String organizationId, String id, EvaluationRequest r, String actor) {
        var previous=requireScheduled(organizationId,id,r.expectedVersion());
        if (previous.date().atTime(previous.time()).atZone(DHAKA).toInstant().isAfter(Instant.now()))
            bad("Evaluation can be saved once the scheduled interview time has arrived.");
        if (r.notes().trim().length()<15) bad("Add at least 15 characters of observed evidence.");
        var saved=interviews.save(new InterviewDocument(id,organizationId,previous.candidateId(),previous.jobId(),
            previous.date(),previous.time(),previous.format(),previous.location(),"Completed",r.scores(),r.notes().trim(),
            null,previous.createdAt(),Instant.now(),actor,previous.version()));
        audit.record(organizationId,"INTERVIEW_EVALUATED",id,previous.candidateId()+" | Evaluation recorded; hiring stage unchanged.",actor);
        return saved.view();
    }
    @Transactional
    public InterviewView cancel(String organizationId, String id, CancellationRequest r, String actor) {
        var previous=requireScheduled(organizationId,id,r.expectedVersion());
        if (r.reason().trim().length()<15) bad("Add a cancellation reason of at least 15 characters.");
        var saved=interviews.save(new InterviewDocument(id,organizationId,previous.candidateId(),previous.jobId(),
            previous.date(),previous.time(),previous.format(),previous.location(),"Cancelled",previous.scores(),previous.notes(),
            r.reason().trim(),previous.createdAt(),Instant.now(),actor,previous.version()));
        audit.record(organizationId,"INTERVIEW_CANCELLED",id,previous.candidateId()+" | "+r.reason().trim(),actor);
        applications.notifyCandidate(organizationId,previous.candidateId(),"Interview cancelled",r.reason().trim());
        return saved.view();
    }
    private InterviewDocument requireScheduled(String organizationId,String id,Long version) {
        var interview=interviews.findByIdAndOrganizationId(id,organizationId)
            .orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Interview not found in this organization."));
        if (!Objects.equals(interview.version(),version))
            throw new ApiException(HttpStatus.CONFLICT,"This interview changed. Refresh data and reopen it before saving.");
        if (!interview.status().equals("Scheduled"))
            throw new ApiException(HttpStatus.CONFLICT,"Completed or cancelled interviews cannot be changed.");
        return interview;
    }
    private void bad(String message) { throw new ApiException(HttpStatus.BAD_REQUEST,message); }
}
