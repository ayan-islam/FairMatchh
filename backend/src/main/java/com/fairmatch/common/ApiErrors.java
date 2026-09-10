package com.fairmatch.common;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.DuplicateKeyException;

@RestControllerAdvice
class ApiErrors {
  @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class) ResponseEntity<?> oversized() { return ResponseEntity.status(413).body(Map.of("message","Upload a PDF no larger than 8 MB.")); }
  @ExceptionHandler(ApiException.class) ResponseEntity<?> business(ApiException e) { return ResponseEntity.status(e.status).body(Map.of("message",e.getMessage())); }
  @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> validation(MethodArgumentNotValidException e) {
    var fields=new java.util.LinkedHashMap<String,String>();
    e.getBindingResult().getFieldErrors().forEach(f -> fields.putIfAbsent(f.getField(),f.getDefaultMessage()));
    return ResponseEntity.badRequest().body(Map.of("message","Please correct the highlighted information.","fields",fields));
  }
  @ExceptionHandler(HttpMessageNotReadableException.class) ResponseEntity<?> malformed() { return ResponseEntity.badRequest().body(Map.of("message","The request contains invalid or unsupported fields.")); }
  @ExceptionHandler(DuplicateKeyException.class) ResponseEntity<?> duplicate() { return ResponseEntity.status(409).body(Map.of("message","This record already exists. Check for an existing application or interview at the same time.")); }
  @ExceptionHandler({org.springframework.dao.DataAccessException.class,org.springframework.transaction.TransactionException.class}) ResponseEntity<?> database(RuntimeException e) {
    for(Throwable cause=e;cause!=null;cause=cause.getCause()) {
      if(cause instanceof com.mongodb.MongoException m && (m.getCode()==112||m.hasErrorLabel("TransientTransactionError")))
        return ResponseEntity.status(409).body(Map.of("message","A related record changed while saving. Reload and review the current data before saving again."));
    }
    return ResponseEntity.status(503).body(Map.of("message","Could not confirm the database operation. Refresh saved records before trying again."));
  }
  @ExceptionHandler(org.springframework.dao.OptimisticLockingFailureException.class) ResponseEntity<?> stale() {
    return ResponseEntity.status(409).body(Map.of("message","This record changed. Refresh data and reopen it before saving."));
  }
}
