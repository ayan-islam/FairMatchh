package com.fairmatch.job;
import java.time.LocalDate;
import java.util.List;

public record JobView(String id,String title,String department,String location,String workplace,String salary,String description,List<String> requirements,String status,long applications,LocalDate closes,boolean noFeeConfirmed,String company) {}
