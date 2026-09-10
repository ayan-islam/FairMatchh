package com.fairmatch.platform;

import com.fairmatch.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;

/** Real SMTP delivery. No local mailbox, fixed OTP or success simulation exists in the application. */
@Service
public class MailDelivery {
    private final JavaMailSenderImpl sender;
    private final String from;
    private final boolean configured;
    public MailDelivery(@Value("${fairmatch.mail.host:}") String host,@Value("${fairmatch.mail.port:587}") int port,
        @Value("${fairmatch.mail.username:}") String username,@Value("${fairmatch.mail.password:}") String password,
        @Value("${fairmatch.mail.from:}") String from,@Value("${fairmatch.mail.ssl:false}") boolean ssl) {
        this.from=from;configured=!host.isBlank()&&!from.isBlank()&&!username.isBlank()&&!password.isBlank();
        sender=new JavaMailSenderImpl();sender.setHost(host);sender.setPort(port);sender.setUsername(username);sender.setPassword(password);sender.setDefaultEncoding("UTF-8");
        var properties=sender.getJavaMailProperties();properties.put("mail.smtp.auth","true");properties.put("mail.smtp.ssl.enable",Boolean.toString(ssl));
        properties.put("mail.smtp.starttls.enable",Boolean.toString(!ssl));properties.put("mail.smtp.starttls.required",Boolean.toString(!ssl));properties.put("mail.smtp.ssl.checkserveridentity","true");
        properties.put("mail.smtp.connectiontimeout","5000");properties.put("mail.smtp.timeout","5000");properties.put("mail.smtp.writetimeout","5000");
    }
    public boolean configured(){return configured;}
    public void requireConfigured(){if(!configured)throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"Email delivery is not configured. The owner must add real SMTP credentials before using verification or recovery.");}
    public void send(String to,String subject,String body){requireConfigured();var message=new SimpleMailMessage();message.setFrom(from);message.setTo(to);message.setSubject(subject);message.setText(body);sender.send(message);}
}
