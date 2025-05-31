
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Configure PDF.js to use the proper worker from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

export interface PDFProcessingProgress {
  step: 'loading' | 'converting' | 'ocr' | 'fallback';
  pageNumber?: number;
  totalPages?: number;
  ocrProgress?: number;
  message?: string;
}

// Fallback function for when PDF.js fails completely
const fallbackPDFProcessing = async (
  file: File,
  onProgress?: (progress: PDFProcessingProgress) => void
): Promise<{ text: string; confidence: number }> => {
  console.log("Using fallback PDF processing method...");
  
  onProgress?.({ 
    step: 'fallback', 
    message: 'PDF.js failed, using alternative method...' 
  });

  // Create a simple file reader approach as last resort
  return {
    text: `[PDF processing failed - manual review required for file: ${file.name}]`,
    confidence: 0
  };
};

export const processPDFWithOCR = async (
  file: File,
  onProgress?: (progress: PDFProcessingProgress) => void
): Promise<{ text: string; confidence: number }> => {
  console.log("Starting PDF processing with improved worker setup...");
  
  try {
    // Load PDF with comprehensive error handling
    onProgress?.({ step: 'loading', message: 'Loading PDF document...' });
    const arrayBuffer = await file.arrayBuffer();
    
    // Try to load the PDF with multiple fallback configurations
    let pdf;
    
    try {
      // Primary attempt: Use standard configuration
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        standardFontDataUrl: ""
      });
      
      pdf = await loadingTask.promise;
      console.log("PDF loaded successfully with standard config");
      
    } catch (workerError) {
      console.warn("Standard PDF loading failed, trying compatibility mode:", workerError);
      
      // Fallback attempt: Disable features that might cause worker issues
      try {
        const fallbackLoadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          disableFontFace: true,
          disableRange: true,
          disableStream: true,
          useWorkerFetch: false,
          isEvalSupported: false
        });
        
        pdf = await fallbackLoadingTask.promise;
        console.log("PDF loaded successfully with compatibility mode");
        
      } catch (compatibilityError) {
        console.error("Both PDF loading methods failed:", compatibilityError);
        return await fallbackPDFProcessing(file, onProgress);
      }
    }
    
    const totalPages = pdf.numPages;
    console.log(`PDF loaded successfully. Total pages: ${totalPages}`);
    
    let allText = '';
    let totalConfidence = 0;
    let processedPages = 0;
    
    // Process each page with enhanced error handling
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        console.log(`Processing page ${pageNum}/${totalPages}`);
        
        onProgress?.({ 
          step: 'converting', 
          pageNumber: pageNum, 
          totalPages,
          message: `Converting page ${pageNum} to image...`
        });
        
        const page = await pdf.getPage(pageNum);
        
        // Set up canvas for rendering with higher resolution for better OCR
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error('Failed to get canvas context');
        }
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Render PDF page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        // Convert canvas to blob for Tesseract
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to convert canvas to blob'));
            }
          }, 'image/png');
        });
        
        // Run OCR on the page image
        onProgress?.({ 
          step: 'ocr', 
          pageNumber: pageNum, 
          totalPages,
          message: `Running OCR on page ${pageNum}...`
        });
        
        const ocrResult = await Tesseract.recognize(blob, 'eng', {
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
        
        console.log(`Page ${pageNum} OCR completed. Confidence: ${ocrResult.data.confidence}%`);
        
        allText += `\n--- Page ${pageNum} ---\n${ocrResult.data.text}\n`;
        totalConfidence += ocrResult.data.confidence;
        processedPages++;
        
      } catch (pageError) {
        console.error(`Error processing page ${pageNum}:`, pageError);
        allText += `\n--- Page ${pageNum} (Error) ---\n[Page processing failed]\n`;
        processedPages++;
      }
    }
    
    const averageConfidence = processedPages > 0 ? totalConfidence / processedPages : 0;
    
    console.log("PDF processing completed successfully");
    console.log(`Total text length: ${allText.length}`);
    console.log(`Average confidence: ${averageConfidence}%`);
    
    return {
      text: allText,
      confidence: averageConfidence
    };
    
  } catch (error) {
    console.error("PDF processing failed completely:", error);
    
    // If everything fails, use the fallback method
    console.log("Attempting fallback processing...");
    return await fallbackPDFProcessing(file, onProgress);
  }
};
