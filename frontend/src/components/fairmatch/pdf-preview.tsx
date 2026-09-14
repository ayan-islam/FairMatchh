"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";

export function PdfPreview({ data, filename, onReady }: {
  data: Uint8Array<ArrayBuffer>;
  filename: string;
  onReady: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = pagesRef.current;
    if (!container) return;
    const measure = () => setWidth(Math.max(1, container.clientWidth - 24));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loading: PDFDocumentLoadingTask | undefined;
    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      if (cancelled) return;
      // This worker is copied from the pinned pdfjs-dist version in public/.
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      loading = pdfjs.getDocument({ data: data.slice() });
      const document = await loading.promise;
      if (cancelled) return;
      setPdf(document);
      setPageNumber(1);
      setError("");
    })().catch(() => {
      if (!cancelled) setError("This PDF could not be previewed. You can still download it.");
    });
    return () => {
      cancelled = true;
      if (loading) void loading.destroy();
    };
  }, [data]);

  useEffect(() => {
    if (!pdf || !width) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    void (async () => {
      setRendering(true);
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / natural.width * zoom });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelLimit = 16_000_000;
      const resolution = Math.min(pixelRatio, Math.sqrt(pixelLimit / (viewport.width * viewport.height)));
      canvas.width = Math.max(1, Math.floor(viewport.width * resolution));
      canvas.height = Math.max(1, Math.floor(viewport.height * resolution));
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      pagesRef.current?.scrollTo({ top: 0, left: 0 });
      task = page.render({ canvas, viewport, transform: [resolution, 0, 0, resolution, 0, 0] });
      await task.promise;
      if (!cancelled) {
        setRendering(false);
        setError("");
        readyRef.current();
      }
    })().catch(() => {
      if (!cancelled) {
        setRendering(false);
        setError("This page could not be displayed. You can still download the PDF.");
      }
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, width, zoom]);

  return <div className="fs-document-preview-reader">
    {error && <p className="fm-error" role="alert">{error}</p>}
    {pdf && <div className="fs-document-preview-controls">
      <Button type="button" variant="outline" disabled={pageNumber <= 1} onClick={() => setPageNumber(page => page - 1)}>Previous page</Button>
      <span aria-live="polite">Page {pageNumber} of {pdf.numPages}</span>
      <Button type="button" variant="outline" disabled={pageNumber >= pdf.numPages} onClick={() => setPageNumber(page => page + 1)}>Next page</Button>
      <Button type="button" variant="outline" disabled={zoom <= 0.75} onClick={() => setZoom(value => Math.max(0.75, value - 0.25))}>Zoom out</Button>
      <span>{Math.round(zoom * 100)}%</span>
      <Button type="button" variant="outline" disabled={zoom >= 1.75} onClick={() => setZoom(value => Math.min(1.75, value + 0.25))}>Zoom in</Button>
    </div>}
    <div className="fs-document-preview-pages" ref={pagesRef}>
      {!pdf && !error && <p role="status">Loading PDF preview…</p>}
      {rendering && <p role="status">Rendering page {pageNumber}…</p>}
      {pdf && <canvas ref={canvasRef} role="img" aria-label={`Page ${pageNumber} of ${filename}`} />}
    </div>
  </div>;
}
