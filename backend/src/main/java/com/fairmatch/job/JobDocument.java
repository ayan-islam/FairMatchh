package com.fairmatch.job;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.CompoundIndex;

@Document("jobs")
@CompoundIndex(name="organization_status",def="{'organizationId':1,'status':1}")
record JobDocument(@Id String id,String organizationId,String title,String department,String location,String workplace,String salary,String description,List<String> requirements,String status,long applications,LocalDate closes,boolean noFeeConfirmed,Instant createdAt) {
  JobView view(String company) { return new JobView(id,title,department,location,workplace,salary,description,requirements,status,applications,closes,noFeeConfirmed,company); }
}
