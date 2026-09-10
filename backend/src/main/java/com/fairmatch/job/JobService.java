package com.fairmatch.job;

import java.time.*;
import java.util.*;
import java.util.regex.Pattern;
import com.fairmatch.audit.AuditService;
import com.fairmatch.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;

@Service
public class JobService {
  public static final String DEMO_ORGANIZATION="apex-textiles";
  private static final Pattern EXCLUSIONARY=Pattern.compile("\\b(male|female|unmarried|married|religion|young|under \\d|age \\d)\\b",Pattern.CASE_INSENSITIVE);
  private final JobRepository jobs;
  private final AuditService audit;
  private final MongoTemplate mongo;
  private final com.fairmatch.platform.PlatformService platform;
  private final org.springframework.context.ApplicationEventPublisher events;
  public JobService(JobRepository jobs,AuditService audit,MongoTemplate mongo,com.fairmatch.platform.PlatformService platform,org.springframework.context.ApplicationEventPublisher events) { this.jobs=jobs;this.audit=audit;this.mongo=mongo;this.platform=platform;this.events=events; }
  public record CriteriaChanged(String organizationId,String jobId) {}
  private JobView view(JobDocument job) { return job.view(platform.organization(job.organizationId()).name()); }
  private boolean visible(JobDocument job) { return platform.organization(job.organizationId()).status().equals("Verified"); }
  public String applicationJobTitle(String org,String id) { return jobs.findByIdAndOrganizationId(id,org).map(JobDocument::title).orElse("Job no longer available"); }
  public List<JobView> employerJobs(String organizationId) { return jobs.findByOrganizationIdOrderByCreatedAtDesc(organizationId).stream().map(this::view).toList(); }
  public List<JobView> publicJobs() { return jobs.findByStatusOrderByCreatedAtDesc("Active").stream().filter(this::visible).filter(j->!j.closes().isBefore(LocalDate.now(ZoneId.of("Asia/Dhaka")))).map(this::view).toList(); }
  public JobView publicJob(String id) { var j=jobs.findById(id).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Job not found.")); if(!j.status().equals("Active")||!visible(j)) throw new ApiException(HttpStatus.NOT_FOUND,"Job not published."); return view(j); }
  public JobView requireOpen(String id) { var j=publicJob(id);if(j.closes().isBefore(LocalDate.now(ZoneId.of("Asia/Dhaka"))))throw new ApiException(HttpStatus.CONFLICT,"This job is no longer accepting applications.");return j; }
  public String organizationForOpenJob(String id) { requireOpen(id);return jobs.findById(id).orElseThrow().organizationId(); }
  public void countApplication(String id) { mongo.updateFirst(Query.query(Criteria.where("_id").is(id)),new Update().inc("applications",1),JobDocument.class); }
  @Transactional
  public JobView save(String organizationId,String id,JobRequest request) {
    if(request.status().equals("Active")) {
      if(request.department().isBlank())bad("Select an academic department before publishing.");
      if(!request.noFeeConfirmed())bad("Confirm the no-applicant-fee policy before publishing.");
      if(request.salary().isBlank()||request.location().isBlank()||request.description().trim().length()<25||request.requirements().isEmpty())bad("Published jobs need salary, location, a description of at least 25 characters and job-related requirements.");
      if(request.closes().isBefore(LocalDate.now(ZoneId.of("Asia/Dhaka"))))bad("The application deadline cannot be in the past.");
      if(request.requirements().stream().anyMatch(r->EXCLUSIONARY.matcher(r).find()))bad("Remove exclusionary wording from the requirements.");
    }
    JobDocument previous=id==null?null:jobs.findByIdAndOrganizationId(id,organizationId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Job not found in this organization."));
    var result=jobs.save(new JobDocument(previous==null?"REF-"+UUID.randomUUID():id,organizationId,request.title().trim(),request.department().trim(),request.location().trim(),request.workplace(),request.salary().trim(),request.description().trim(),request.requirements().stream().map(String::trim).toList(),request.status(),previous==null?0:previous.applications(),request.closes(),request.noFeeConfirmed(),previous==null?Instant.now():previous.createdAt()));
    if(previous!=null&&(!previous.requirements().equals(result.requirements())||!previous.title().equals(result.title())||!previous.department().equals(result.department())||!previous.description().equals(result.description())))events.publishEvent(new CriteriaChanged(organizationId,result.id()));
    audit.record(organizationId,request.status().equals("Active")?"JOB_PUBLISHED":request.status().equals("Closed")?"JOB_CLOSED":"JOB_DRAFT_SAVED",result.id());return view(result);
  }
  private void bad(String message) { throw new ApiException(HttpStatus.BAD_REQUEST,message); }
}
