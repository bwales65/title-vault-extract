
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

// Enhanced debugging function
const debugCanvas = (canvas: HTMLCanvasElement, pageNum: number) => {
  console.log(`=== CANVAS DEBUG PAGE ${pageNum} ===`);
  console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
  console.log(`Canvas exists:`, !!canvas);
  
  const context = canvas.getContext('2d');
  if (context) {
    const imageData = context.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height));
    console.log(`Canvas has context:`, !!context);
    console.log(`Sample pixel data:`, imageData.data.slice(0, 20));
    console.log(`Canvas is blank:`, imageData.data.every(pixel => pixel === 0));
  }
};

// Test if canvas contains actual content
const isCanvasBlank = (canvas: HTMLCanvasElement): boolean => {
  const context = canvas.getContext('2d');
  if (!context) return true;
  
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return imageData.data.every(pixel => pixel === 0);
};

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
  console.log("=== STARTING PDF PROCESSING WITH ENHANCED DEBUGGING ===");
  console.log("File details:", {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: new Date(file.lastModified)
  });
  
  try {
    // Load PDF
    onProgress?.({ step: 'loading', message: 'Loading PDF document...' });
    const arrayBuffer = await file.arrayBuffer();
    console.log("PDF file read into array buffer, size:", arrayBuffer.byteLength);
    
    // Enhanced PDF loading with more explicit configuration
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      maxImageSize: -1,
      cMapPacked: true
    });
    
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    console.log(`PDF loaded successfully. Total pages: ${totalPages}`);
    console.log(`PDF metadata:`, await pdf.getMetadata().catch(() => "No metadata"));
    
    let allText = '';
    let totalConfidence = 0;
    let processedPages = 0;
    
    // Process each page with enhanced debugging
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        console.log(`\n=== PROCESSING PAGE ${pageNum}/${totalPages} ===`);
        
        onProgress?.({ 
          step: 'converting', 
          pageNumber: pageNum, 
          totalPages,
          message: `Converting page ${pageNum} to image...`
        });
        
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        console.log(`Page ${pageNum} viewport:`, {
          width: viewport.width,
          height: viewport.height,
          rotation: viewport.rotation
        });
        
        // Try multiple scales to find what works
        const scales = [1.5, 2.0, 2.5];
        let ocrResult = null;
        
        for (const scale of scales) {
          try {
            console.log(`Trying scale ${scale} for page ${pageNum}`);
            
            const scaledViewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            if (!context) {
              console.error('Failed to get canvas context');
              continue;
            }
            
            canvas.height = scaledViewport.height;
            canvas.width = scaledViewport.width;
            
            console.log(`Canvas created: ${canvas.width}x${canvas.height} (scale: ${scale})`);
            
            // Clear canvas first
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // Render PDF page to canvas
            await page.render({
              canvasContext: context,
              viewport: scaledViewport,
              intent: 'display'
            }).promise;
            
            console.log(`Page ${pageNum} rendered to canvas successfully`);
            debugCanvas(canvas, pageNum);
            
            // Check if canvas has content
            if (isCanvasBlank(canvas)) {
              console.warn(`Canvas is blank for page ${pageNum} at scale ${scale}`);
              continue;
            }
            
            // Convert canvas to different formats for testing
            const formats = ['image/png', 'image/jpeg'];
            
            for (const format of formats) {
              try {
                console.log(`Converting to ${format} for page ${pageNum}`);
                const imageData = canvas.toDataURL(format, 0.95);
                
                if (!imageData || imageData.length < 100) {
                  console.warn(`Invalid image data for ${format}:`, imageData?.substring(0, 50));
                  continue;
                }
                
                console.log(`Image data created successfully:`, {
                  format,
                  length: imageData.length,
                  prefix: imageData.substring(0, 50) + '...'
                });
                
                // Run OCR
                onProgress?.({ 
                  step: 'ocr', 
                  pageNumber: pageNum, 
                  totalPages,
                  message: `Running OCR on page ${pageNum} (${format}, scale ${scale})...`
                });
                
                console.log(`Starting OCR for page ${pageNum} with ${format} at scale ${scale}`);
                
                const result = await Tesseract.recognize(imageData, 'eng', {
                  logger: (m) => {
                    console.log(`OCR Progress:`, m);
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
                  confidence: result.data.confidence,
                  textLength: result.data.text.length,
                  textPreview: result.data.text.substring(0, 100)
                });
                
                if (result.data.confidence > 0) {
                  ocrResult = result;
                  console.log(`SUCCESS! Found working configuration: ${format} at scale ${scale}`);
                  break;
                }
                
              } catch (formatError) {
                console.error(`Error with format ${format}:`, formatError);
              }
            }
            
            if (ocrResult) break;
            
          } catch (scaleError) {
            console.error(`Error with scale ${scale}:`, scaleError);
          }
        }
        
        if (ocrResult) {
          allText += `\n--- Page ${pageNum} ---\n${ocrResult.data.text}\n`;
          totalConfidence += ocrResult.data.confidence;
          processedPages++;
        } else {
          console.error(`All OCR attempts failed for page ${pageNum}`);
          allText += `\n--- Page ${pageNum} (OCR Failed) ---\n[OCR processing failed for this page]\n`;
          processedPages++;
        }
        
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
    console.log(`Full extracted text:`, allText);
    
    return {
      text: allText,
      confidence: averageConfidence
    };
    
  } catch (error) {
    console.error("=== PDF PROCESSING FAILED COMPLETELY ===", error);
    return await fallbackPDFProcessing(file, onProgress);
  }
};
