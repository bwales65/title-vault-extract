
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Use CDN worker URL as recommended by Claude
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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

  return {
    text: `[PDF processing failed - manual review required for file: ${file.name}]`,
    confidence: 0
  };
};

export const processPDFWithOCR = async (
  file: File,
  onProgress?: (progress: PDFProcessingProgress) => void
): Promise<{ text: string; confidence: number }> => {
  console.log("Starting PDF processing with Claude's recommended approach...");
  
  try {
    // Load PDF
    onProgress?.({ step: 'loading', message: 'Loading PDF document...' });
    const arrayBuffer = await file.arrayBuffer();
    console.log("PDF file read into array buffer, size:", arrayBuffer.byteLength);
    
    // Simplified PDF loading with basic configuration
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false
    });
    
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    console.log(`PDF loaded successfully. Total pages: ${totalPages}`);
    
    let allText = '';
    let totalConfidence = 0;
    let processedPages = 0;
    
    // Process each page using Claude's recommended approach
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
        console.log(`Page ${pageNum} loaded, dimensions:`, page.getViewport({ scale: 1 }));
        
        // Use Claude's recommended scale of 2.0
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error('Failed to get canvas context');
        }
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        console.log(`Canvas created for page ${pageNum}: ${canvas.width}x${canvas.height}`);
        
        // Render PDF page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        console.log(`Page ${pageNum} rendered to canvas successfully`);
        
        // Convert canvas to Data URL (Claude's recommended approach)
        const imageData = canvas.toDataURL('image/png');
        console.log(`Canvas converted to Data URL for page ${pageNum}, length:`, imageData.length);
        console.log(`Data URL preview:`, imageData.substring(0, 100) + '...');
        
        // Run OCR with simplified configuration
        onProgress?.({ 
          step: 'ocr', 
          pageNumber: pageNum, 
          totalPages,
          message: `Running OCR on page ${pageNum}...`
        });
        
        console.log(`Starting OCR for page ${pageNum} with Data URL method...`);
        
        const ocrResult = await Tesseract.recognize(imageData, 'eng', {
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
        
        console.log(`Page ${pageNum} OCR completed.`);
        console.log(`- Confidence: ${ocrResult.data.confidence}%`);
        console.log(`- Text length: ${ocrResult.data.text.length}`);
        console.log(`- Text preview:`, ocrResult.data.text.substring(0, 200));
        
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
    console.log(`Full extracted text:`, allText);
    
    return {
      text: allText,
      confidence: averageConfidence
    };
    
  } catch (error) {
    console.error("PDF processing failed completely:", error);
    return await fallbackPDFProcessing(file, onProgress);
  }
};
