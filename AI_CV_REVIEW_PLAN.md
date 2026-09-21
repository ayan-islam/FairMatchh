# FairMatch AI CV Review Plan

## Goal

Use an LLM to turn already extracted CV text into a structured, evidence-linked review. The AI must assist a recruiter; it must not make the final hiring decision or use identity, gender, religion, age, photos, or prestige as scoring factors.

## Recommended flow

1. The candidate uploads a PDF to FairMatch's private MinIO storage.
2. The document worker extracts text page by page with PyPDF. Scanned pages use Tesseract OCR.
3. Before an external AI request, FairMatch removes obvious identity and contact fields. A local model can receive the original extracted text because it stays on the laptop.
4. The LLM returns JSON that follows a fixed schema: summary, skills, courses, projects, work evidence, source page, exact supporting passage, confidence, and warnings.
5. FairMatch validates the JSON and rejects unsupported or malformed output.
6. The candidate reviews and confirms the extracted facts.
7. The existing explainable ranking engine compares confirmed evidence with the job's requirements and weights. The recruiter sees each matched requirement and its source passage.
8. FairMatch stores the provider, model, prompt version, extraction version, time, and review state for auditability.

The LLM should normalize language and find evidence. A deterministic FairMatch service should calculate the score. This keeps the ranking reproducible and makes every score explainable.

## Provider choices

### Recommended for the classroom: local Ollama

- Runs a downloaded open model locally through `http://localhost:11434/api`.
- No API key is needed for local requests.
- Supports JSON-schema structured outputs.
- CV text stays on the laptop.
- Requires enough RAM and several gigabytes of disk space for a useful model.

Official documentation: <https://docs.ollama.com/api/introduction> and <https://docs.ollama.com/capabilities/structured-outputs>

### Easy cloud prototype: Gemini Developer API

- Has free-tier access for selected models and supports structured JSON output.
- Requires a Google AI Studio API key and internet access.
- The free service is inappropriate for real CV personal data: Google's terms say unpaid inputs and outputs may be used to improve products and reviewed by humans, and advise users not to submit personal or confidential information.
- It is acceptable for synthetic classroom CVs. Real CVs should use a suitable paid data-processing arrangement or local inference.

Official documentation: <https://ai.google.dev/gemini-api/docs/pricing>, <https://ai.google.dev/gemini-api/docs/structured-output>, and <https://ai.google.dev/gemini-api/terms>

### Hugging Face Inference Providers

- Provides one API for many open models.
- A free account currently receives only a small monthly credit, so it is useful for experiments but not a dependable production-free service.

Official documentation: <https://huggingface.co/docs/inference-providers/pricing>

## Installed configuration

Secrets must be environment variables and must never be committed to GitHub.

```text
FAIRMATCH_AI_PROVIDER=ollama
FAIRMATCH_AI_BASE_URL=http://localhost:11434
FAIRMATCH_AI_MODEL=qwen3:4b-instruct
```

On this laptop, both the Ollama application and model data live under `D:\FairMatch\Ollama`. `OLLAMA_NO_CLOUD=1` keeps the server in local-only mode. `START_FAIRMATCH.cmd` starts the local API and enables the Spring integration; no API key is used.

The implemented Java service sends extracted page text to `/api/chat` with a JSON schema, temperature zero and an 8K working context. It accepts an AI item only when the claimed page exists and the supporting quotation can be found in that page after whitespace normalization. Invalid or unsupported suggestions are omitted. The displayed compact summary is rebuilt only from those accepted evidence items, so an unsupported free-form model summary is never trusted. Candidates see the model, page, quotation and extraction confidence and must explicitly copy and confirm facts before employers can receive compact highlights.

## Output schema

```json
{
  "summary": "Short work-focused summary",
  "skills": [
    {
      "name": "Java",
      "sourcePage": 2,
      "evidence": "Built REST APIs using Java and Spring Boot",
      "confidence": 0.94
    }
  ],
  "courses": [],
  "projects": [],
  "experience": [],
  "warnings": []
}
```

Every claimed fact must have a page and supporting passage. Missing evidence should produce `Not demonstrated`, not an invented match.

## Teacher explanation

“PyPDF and Tesseract convert the CV into page-linked text. An LLM then converts that unstructured text into validated structured evidence. The candidate confirms it. Our deterministic ranking service compares only confirmed, job-related evidence against a recruiter-defined rubric and shows the exact source for every match. The AI assists extraction and semantic normalization, while humans retain the hiring decision.”
