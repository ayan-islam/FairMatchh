package com.fairmatch;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@org.springframework.scheduling.annotation.EnableScheduling
public class FairMatchApplication {
  public static void main(String[] args) { SpringApplication.run(FairMatchApplication.class, args); }
}
