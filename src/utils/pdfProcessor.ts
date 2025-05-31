
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Alternative worker setup - use inline worker or disable worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// Create a simple inline worker as fallback
const createWorkerBlob = () => {
  const workerCode = `
    // Minimal PDF.js worker implementation
    self.addEventListener('message', function(e) {
      // Simple echo for now - PDF.js will handle this internally
      self.postMessage(e.data);
    });
  `;
  return URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));
};

// Set up worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = createWorkerBlob();
} catch (error) {
  console.warn('Worker setup failed, PDF.js will run in main thread:', error);
}

export const processPDFWithOCR = async (
  file: File,
  onProgress?: (progress: PDFProcessingProgress) => void
): Promise<{ text: string; confidence: number }> => {
  console.log("Starting PDF processing...");
  
  try {
    // Load PDF
    onProgress?.({ step: 'loading' });
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    
    console.log(`PDF loaded successfully. Total pages: ${totalPages}`);
    
    let allText = '';
    let totalConfidence = 0;
    let processedPages = 0;
    
    // Process each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      console.log(`Processing page ${pageNum}/${totalPages}`);
      
      onProgress?.({ 
        step: 'converting', 
        pageNumber: pageNum, 
        totalPages 
      });
      
      const page = await pdf.getPage(pageNum);
      
      // Set up canvas for rendering
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
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
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/png');
      });
      
      // Run OCR on the page image
      onProgress?.({ 
        step: 'ocr', 
        pageNumber: pageNum, 
        totalPages 
      });
      
      const ocrResult = await Tesseract.recognize(blob, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress?.({ 
              step: 'ocr', 
              pageNumber: pageNum, 
              totalPages,
              ocrProgress: Math.round(m.progress * 100)
            });
          }
        }
      });
      
      console.log(`Page ${pageNum} OCR completed. Confidence: ${ocrResult.data.confidence}%`);
      console.log(`Page ${pageNum} text length: ${ocrResult.data.text.length}`);
      
      allText += `\n--- Page ${pageNum} ---\n${ocrResult.data.text}\n`;
      totalConfidence += ocrResult.data.confidence;
      processedPages++;
    }
    
    const averageConfidence = totalConfidence / processedPages;
    
    console.log("PDF processing completed successfully");
    console.log(`Total text length: ${allText.length}`);
    console.log(`Average confidence: ${averageConfidence}%`);
    
    return {
      text: allText,
      confidence: averageConfidence
    };
    
  } catch (error) {
    console.error("PDF processing failed:", error);
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
