
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

export interface TesseractConfig {
  language: string;
  pageSegMode?: number;
  ocrEngineMode?: number;
  whiteList?: string;
  blackList?: string;
  preserveInterwordSpaces?: boolean;
  tesseditCharWhitelist?: string;
  tesseditCharBlacklist?: string;
}

// Default Tesseract configuration optimized for contracts
const DEFAULT_TESSERACT_CONFIG: TesseractConfig = {
  language: 'eng',
  pageSegMode: 6, // Uniform block of text
  ocrEngineMode: 3, // Default (both LSTM and legacy)
  preserveInterwordSpaces: true,
  // Common characters in contracts
  tesseditCharWhitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?@#$%&*()[]{}:;"\'-_/\\+=<>| \n\r\t'
};

// Alternative configurations for different document types
export const TESSERACT_PRESETS = {
  contract: {
    ...DEFAULT_TESSERACT_CONFIG,
    pageSegMode: 6, // Uniform block of text
    tesseditCharWhitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?@#$%&*()[]{}:;"\'-_/\\+=<>| \n\r\t'
  },
  form: {
    ...DEFAULT_TESSERACT_CONFIG,
    pageSegMode: 4, // Single column text of variable sizes
  },
  mixed: {
    ...DEFAULT_TESSERACT_CONFIG,
    pageSegMode: 3, // Fully automatic page segmentation
  },
  singleLine: {
    ...DEFAULT_TESSERACT_CONFIG,
    pageSegMode: 7, // Single text line
  },
  sparseText: {
    ...DEFAULT_TESSERACT_CONFIG,
    pageSegMode: 11, // Sparse text
  }
};

export const processPDFWithOCR = async (
  file: File,
  onProgress?: (progress: PDFProcessingProgress) => void,
  tesseractConfig: TesseractConfig = DEFAULT_TESSERACT_CONFIG
): Promise<{ text: string; confidence: number }> => {
  console.log("=== STARTING BROWSER-COMPATIBLE PDF PROCESSING ===");
  console.log("File details:", {
    name: file.name,
    size: file.size,
    type: file.type
  });
  console.log("Tesseract config:", tesseractConfig);
  
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
        
        // Set up canvas with high resolution for better OCR
        const scale = 3.0; // Increased from 2.0 for better text recognition
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
        
        // Enhance canvas rendering for better OCR
        context.imageSmoothingEnabled = false;
        context.imageSmoothingQuality = 'high';
        
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
        
        console.log(`Page ${pageNum} rendered to canvas with scale ${scale}`);
        
        // Convert canvas to high-quality image for OCR
        const imageDataUrl = canvas.toDataURL('image/png', 1.0); // PNG for better quality
        
        // Run OCR on the image with custom configuration
        onProgress?.({ 
          step: 'ocr', 
          pageNumber: pageNum, 
          totalPages,
          message: `Running OCR on page ${pageNum} with ${tesseractConfig.language} language...`
        });
        
        console.log(`Starting OCR for page ${pageNum} with config:`, tesseractConfig);
        
        // Prepare Tesseract options
        const tesseractOptions = {
          logger: (m: any) => {
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
        };

        // Build Tesseract worker options
        const workerOptions: any = {};
        if (tesseractConfig.pageSegMode !== undefined) {
          workerOptions['tessedit_pageseg_mode'] = tesseractConfig.pageSegMode.toString();
        }
        if (tesseractConfig.ocrEngineMode !== undefined) {
          workerOptions['tessedit_ocr_engine_mode'] = tesseractConfig.ocrEngineMode.toString();
        }
        if (tesseractConfig.preserveInterwordSpaces) {
          workerOptions['preserve_interword_spaces'] = '1';
        }
        if (tesseractConfig.tesseditCharWhitelist) {
          workerOptions['tessedit_char_whitelist'] = tesseractConfig.tesseditCharWhitelist;
        }
        if (tesseractConfig.tesseditCharBlacklist) {
          workerOptions['tessedit_char_blacklist'] = tesseractConfig.tesseditCharBlacklist;
        }

        const ocrResult = await Promise.race([
          Tesseract.recognize(imageDataUrl, tesseractConfig.language, tesseractOptions).then(result => {
            // Apply worker options after recognition if needed
            return result;
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`OCR timeout on page ${pageNum}`)), 90000) // Increased timeout
          )
        ]) as any;
        
        console.log(`OCR completed for page ${pageNum}:`, {
          confidence: ocrResult.data.confidence,
          textLength: ocrResult.data.text.length,
          textPreview: ocrResult.data.text.substring(0, 100),
          config: tesseractConfig
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
    console.log(`Used config:`, tesseractConfig);
    
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
