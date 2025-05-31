
import Tesseract from 'tesseract.js';
import { fromBuffer } from 'pdf2pic';

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
  console.log("=== STARTING PDF-TO-JPEG PROCESSING ===");
  console.log("File details:", {
    name: file.name,
    size: file.size,
    type: file.type
  });
  
  try {
    // Load PDF
    onProgress?.({ step: 'loading', message: 'Loading PDF document...' });
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log("PDF loaded into buffer, size:", buffer.length);
    
    // Configure PDF to image conversion
    const convert = fromBuffer(buffer, {
      density: 300,           // Higher DPI for better OCR
      saveFilename: "page",
      savePath: "./",
      format: "jpeg",
      width: 2000,           // High resolution
      height: 2600,
      quality: 95            // High quality JPEG
    });
    
    // Get page count first
    const pageCount = await convert.bulk(-1, { responseType: "buffer" });
    const totalPages = pageCount.length;
    
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
          message: `Converting page ${pageNum} to JPEG...`
        });
        
        // Convert single page to JPEG
        const pageResult = await convert(pageNum, { responseType: "buffer" });
        const imageBuffer = pageResult.buffer;
        
        if (!imageBuffer || imageBuffer.length === 0) {
          console.error(`Failed to convert page ${pageNum} to image`);
          continue;
        }
        
        console.log(`Page ${pageNum} converted to JPEG, size: ${imageBuffer.length} bytes`);
        
        // Convert buffer to base64 data URL for Tesseract
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        
        // Run OCR on the JPEG
        onProgress?.({ 
          step: 'ocr', 
          pageNumber: pageNum, 
          totalPages,
          message: `Running OCR on page ${pageNum}...`
        });
        
        console.log(`Starting OCR for page ${pageNum}`);
        
        const ocrResult = await Tesseract.recognize(base64Image, 'eng', {
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
