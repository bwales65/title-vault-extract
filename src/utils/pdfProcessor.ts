
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
    // Load PDF
    onProgress?.({ step: 'loading', message: 'Loading PDF document...' });
    const arrayBuffer = await file.arrayBuffer();
    
    console.log("PDF loaded into buffer, size:", arrayBuffer.byteLength);
    
    // Load PDF with pdfjs
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    
    console.log(`PDF has ${totalPages} pages`);
    
    let allText = '';
    let totalConfidence = 0;
    let processedPages = 0;
    
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
        
        // Get page
        const page = await pdf.getPage(pageNum);
        
        // Set up canvas with high resolution
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        if (!context) {
          console.error(`Failed to get canvas context for page ${pageNum}`);
          continue;
        }
        
        // Render page to canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
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
        
        const ocrResult = await Tesseract.recognize(imageDataUrl, 'eng', {
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
        });
        
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
          processedPages++;
        }
        
        // Clean up canvas
        canvas.remove();
        
      } catch (pageError) {
        console.error(`Error processing page ${pageNum}:`, pageError);
        allText += `\n--- Page ${pageNum} (Error) ---\n[Page processing failed: ${pageError.message}]\n`;
        processedPages++;
      }
    }
    
    const averageConfidence = processedPages > 0 ? totalConfidence / processedPages : 0;
    
    console.log("=== PDF PROCESSING COMPLETED ===");
    console.log(`Total text length: ${allText.length}`);
    console.log(`Average confidence: ${averageConfidence}%`);
    console.log(`Processed pages: ${processedPages}/${totalPages}`);
    
    return {
      text: allText,
      confidence: averageConfidence
    };
    
  } catch (error) {
    console.error("=== PDF PROCESSING FAILED ===", error);
    
    onProgress?.({ 
      step: 'fallback', 
      message: 'PDF processing failed - manual review required' 
    });

    return {
      text: `[PDF processing failed - manual review required for file: ${file.name}]\nError: ${error.message}`,
      confidence: 0
    };
  }
};
