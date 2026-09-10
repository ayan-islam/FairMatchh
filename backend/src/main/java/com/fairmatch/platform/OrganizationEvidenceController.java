package com.fairmatch.platform;

import java.security.Principal;
import java.util.Map;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
class OrganizationEvidenceController {
    private final PlatformService platform;private final OrganizationEvidenceService evidence;
    OrganizationEvidenceController(PlatformService platform,OrganizationEvidenceService evidence){this.platform=platform;this.evidence=evidence;}
    record Removal(@Min(0) long expectedVersion){}
    @GetMapping("/api/employer/organization/evidence") OrganizationEvidenceService.Bundle own(Principal p){return evidence.bundle(platform.organizationId(p.getName()));}
    @GetMapping("/api/admin/organizations/{org}/evidence") OrganizationEvidenceService.Bundle admin(@PathVariable String org){return evidence.bundle(org);}
    @PostMapping(value="/api/employer/organization/evidence",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    OrganizationEvidenceService.Evidence upload(@RequestParam MultipartFile file,@RequestParam String type,@RequestParam String description,@RequestParam long expectedVersion,Principal p)throws java.io.IOException {
        return evidence.upload(platform.organizationId(p.getName()),type,description,file.getOriginalFilename(),file.getBytes(),expectedVersion,p.getName());
    }
    @DeleteMapping("/api/employer/organization/evidence/{id}") Map<String,Boolean> remove(@PathVariable String id,@Valid @RequestBody Removal input,Principal p){evidence.remove(platform.organizationId(p.getName()),id,input.expectedVersion(),p.getName());return Map.of("removed",true);}
    @GetMapping("/api/employer/organization/evidence/{id}/file") ResponseEntity<byte[]> ownFile(@PathVariable String id,Principal p){return download(platform.organizationId(p.getName()),id,p.getName());}
    @GetMapping("/api/admin/organizations/{org}/evidence/{id}/file") ResponseEntity<byte[]> adminFile(@PathVariable String org,@PathVariable String id,Principal p){return download(org,id,p.getName());}
    ResponseEntity<byte[]> download(String org,String id,String actor){var item=evidence.owned(org,id);return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).header(HttpHeaders.CACHE_CONTROL,"no-store, private").header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(item.filename(),java.nio.charset.StandardCharsets.UTF_8).build().toString()).body(evidence.download(org,id,actor));}
}
