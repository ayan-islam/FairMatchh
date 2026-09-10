package com.fairmatch;
import java.time.LocalDate;
import java.util.List;
import com.fairmatch.job.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="fairmatch.seed",havingValue="true")
class DemoSeed implements CommandLineRunner {
  private final JobService jobs;DemoSeed(JobService jobs){this.jobs=jobs;}
  public void run(String...args){if(jobs.employerJobs(JobService.DEMO_ORGANIZATION).isEmpty())jobs.save(JobService.DEMO_ORGANIZATION,null,new JobRequest("Junior Merchandising Executive","Merchandising","Dhaka, Bangladesh","On-site","BDT 28,000 - 38,000 monthly","Support buyer communication, order tracking, costing, production follow-up and export documentation for knitwear products.",List.of("Order tracking experience","Basic spreadsheet ability","Buyer communication"),"Active",LocalDate.now().plusDays(30),true));}
}
