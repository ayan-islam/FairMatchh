package com.fairmatch.job;
import java.util.List;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

@RestController
class JobController {
  private final JobService jobs;
  private final com.fairmatch.platform.PlatformService platform;
  JobController(JobService jobs,com.fairmatch.platform.PlatformService platform) {this.jobs=jobs;this.platform=platform;}
  @GetMapping("/api/public/jobs") List<JobView> publicJobs(){return jobs.publicJobs();}
  @GetMapping("/api/public/jobs/{id}") JobView publicJob(@PathVariable String id){return jobs.publicJob(id);}
  @GetMapping("/api/employer/jobs") List<JobView> employerJobs(java.security.Principal p){return jobs.employerJobs(platform.organizationId(p.getName()));}
  @PostMapping("/api/employer/jobs") @ResponseStatus(HttpStatus.CREATED) JobView create(@Valid @RequestBody JobRequest request,java.security.Principal p){var org=platform.organizationId(p.getName());if(request.status().equals("Active"))platform.requireVerified(org);return jobs.save(org,null,request);}
  @PutMapping("/api/employer/jobs/{id}") JobView update(@PathVariable String id,@Valid @RequestBody JobRequest request,java.security.Principal p){var org=platform.organizationId(p.getName());if(request.status().equals("Active"))platform.requireVerified(org);return jobs.save(org,id,request);}
}
