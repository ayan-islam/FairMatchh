package com.fairmatch.interview;
import java.security.Principal;
import java.util.List;
import com.fairmatch.job.JobService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/employer/interviews")
class InterviewController {
    private final InterviewService interviews;
    private final com.fairmatch.platform.PlatformService platform;
    InterviewController(InterviewService interviews,com.fairmatch.platform.PlatformService platform) { this.interviews=interviews;this.platform=platform; }
    @GetMapping List<InterviewView> list(Principal p) { return interviews.list(platform.organizationId(p.getName())); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    InterviewView schedule(@Valid @RequestBody InterviewRequest r, Principal p) {
        return interviews.schedule(platform.organizationId(p.getName()),null,r,p.getName());
    }
    @PutMapping("/{id}") InterviewView reschedule(@PathVariable String id,@Valid @RequestBody InterviewRequest r,Principal p) {
        return interviews.schedule(platform.organizationId(p.getName()),id,r,p.getName());
    }
    @PostMapping("/{id}/evaluation") InterviewView evaluate(@PathVariable String id,@Valid @RequestBody EvaluationRequest r,Principal p) {
        return interviews.evaluate(platform.organizationId(p.getName()),id,r,p.getName());
    }
    @PostMapping("/{id}/cancellation") InterviewView cancel(@PathVariable String id,@Valid @RequestBody CancellationRequest r,Principal p) {
        return interviews.cancel(platform.organizationId(p.getName()),id,r,p.getName());
    }
}
