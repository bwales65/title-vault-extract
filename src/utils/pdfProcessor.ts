
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';

export interface PDFProcessingProgress {
  step: 'loading' | 'converting' | 'ocr' | 'fallback';
  pageNumber?: number;
  totalPages?: number;
  ocrProgress?: number;
  message?: string;
  error?: string;
}

export const processPDFWithOCR = async (
  file: File,
  onProgress?: (progress: PDFProcessingProgress) => void
): Promise<{ text: string; confidence: number }> => {
  console.log("=== STARTING BROWSER-COMPATIBLE PDF PROCESSING ===");
  console.log("File details:", {
    name: file.name,
    size: file.size,
    type: file.type
  });
  
  try {
    // Validate file type
    if (file.type !== "application/pdf") {
      throw new Error(`Invalid file type: ${file.type}. Please upload a PDF file.`);
    }

    // Validate file size (limit to 50MB)
    if (file.size > 50 * 1024 * 1024) {
      throw new Error("File too large. Please upload a PDF smaller than 50MB.");
    }

    // Load PDF
    onProgress?.({ step: 'loading', message: 'Loading PDF document...' });
    const arrayBuffer = await file.arrayBuffer();
    
    console.log("PDF loaded into buffer, size:", arrayBuffer.byteLength);
    
    // Load PDF with pdfjs
    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (pdfError) {
      console.error("PDF parsing error:", pdfError);
      throw new Error("Failed to parse PDF. The file may be corrupted or password-protected.");
    }

    const totalPages = pdf.numPages;
    
    if (totalPages === 0) {
      throw new Error("PDF contains no pages.");
    }

    if (totalPages > 20) {
      throw new Error("PDF has too many pages (limit: 20). Please upload a smaller document.");
    }
    
    console.log(`PDF has ${totalPages} pages`);
    
    let allText = '';
    let totalConfidence = 0;
    let processedPages = 0;
    let failedPages = 0;
    
    // Process each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        console.log(`\n=== PROCESSING PAGE ${pageNum}/${totalPages} ===`);
        
        onProgress?.({ 
          step: 'converting', 
          pageNumber: pageNum, 
          totalPages,
          message: `Converting page ${pageNum} to image...`
        });
        
        // Get page with timeout
        const page = await Promise.race([
          pdf.getPage(pageNum),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout loading page ${pageNum}`)), 30000)
          )
        ]) as any;
        
        // Set up canvas with high resolution
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        if (!context) {
          console.error(`Failed to get canvas context for page ${pageNum}`);
          failedPages++;
          continue;
        }
        
        // Render page to canvas with timeout
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await Promise.race([
          page.render(renderContext).promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout rendering page ${pageNum}`)), 30000)
          )
        ]);
        
        console.log(`Page ${pageNum} rendered to canvas`);
        
        // Convert canvas to data URL
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        
        // Run OCR on the image
        onProgress?.({ 
          step: 'ocr', 
          pageNumber: pageNum, 
          totalPages,
          message: `Running OCR on page ${pageNum}...`
        });
        
        console.log(`Starting OCR for page ${pageNum}`);
        
        const ocrResult = await Promise.race([
          Tesseract.recognize(imageDataUrl, 'eng', {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                onProgress?.({ 
                  step: 'ocr', 
                  pageNumber: pageNum, 
                  totalPages,
                  ocrProgress: Math.round(m.progress * 100),
                  message: `OCR progress: ${Math.round(m.progress * 100)}%`
                });
              }
            }
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`OCR timeout on page ${pageNum}`)), 60000)
          )
        ]) as any;
        
        console.log(`OCR completed for page ${pageNum}:`, {
          confidence: ocrResult.data.confidence,
          textLength: ocrResult.data.text.length,
          textPreview: ocrResult.data.text.substring(0, 100)
        });
        
        if (ocrResult.data.text && ocrResult.data.text.trim().length > 0) {
          allText += `\n--- Page ${pageNum} ---\n${ocrResult.data.text}\n`;
          totalConfidence += ocrResult.data.confidence;
          processedPages++;
        } else {
          console.warn(`No text extracted from page ${pageNum}`);
          allText += `\n--- Page ${pageNum} (No text found) ---\n`;
          failedPages++;
        }
        
        // Clean up canvas
        canvas.remove();
        
      } catch (pageError) {
        console.error(`Error processing page ${pageNum}:`, pageError);
        allText += `\n--- Page ${pageNum} (Error: ${pageError.message}) ---\n`;
        failedPages++;
        
        onProgress?.({ 
          step: 'ocr', 
          pageNumber: pageNum, 
          totalPages,
          error: `Failed to process page ${pageNum}: ${pageError.message}`
        });
      }
    }
    
    const averageConfidence = processedPages > 0 ? totalConfidence / processedPages : 0;
    
    console.log("=== PDF PROCESSING COMPLETED ===");
    console.log(`Total text length: ${allText.length}`);
    console.log(`Average confidence: ${averageConfidence}%`);
    console.log(`Processed pages: ${processedPages}/${totalPages}`);
    console.log(`Failed pages: ${failedPages}`);
    
    if (processedPages === 0) {
      throw new Error("Failed to extract text from any pages. The PDF may contain only images or be corrupted.");
    }

    if (failedPages > totalPages / 2) {
      console.warn("More than half the pages failed to process");
    }
    
    return {
      text: allText,
      confidence: averageConfidence
    };
    
  } catch (error) {
    console.error("=== PDF PROCESSING FAILED ===", error);
    
    onProgress?.({ 
      step: 'fallback', 
      message: 'PDF processing failed',
      error: error.message 
    });

    throw error; // Re-throw so the UI can handle it properly
  }
};
