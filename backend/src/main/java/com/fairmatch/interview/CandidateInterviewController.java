package com.fairmatch.interview;
import com.fairmatch.platform.PlatformService;
import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.*;
@RestController
class CandidateInterviewController {
    private final InterviewService interviews;private final PlatformService platform;
    CandidateInterviewController(InterviewService interviews,PlatformService platform){this.interviews=interviews;this.platform=platform;}
    @GetMapping("/api/candidate/interviews") List<InterviewService.CandidateInterview> list(Principal p){return interviews.candidateList(platform.account(p.getName()).id());}
}
