import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Eye, AlertTriangle, RefreshCw } from "lucide-react";
import { DocumentViewer } from "@/components/DocumentViewer";
import { FieldExtractor } from "@/components/FieldExtractor";
import { ExtractedTextViewer } from "@/components/ExtractedTextViewer";
import { toast } from "@/hooks/use-toast";
import { processPDFWithOCR, PDFProcessingProgress, TesseractConfig, TESSERACT_PRESETS } from "@/utils/pdfProcessor";
import { TesseractConfigComponent } from "@/components/TesseractConfig";

interface ProcessState {
  file: File;
  fileId: string;
  confidenceThreshold: number;
}

interface ExtractedField {
  field: string;
  value: string;
  confidence: number;
  originalText?: string;
}

const ProcessContract = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ProcessState;

  const [extractedData, setExtractedData] = useState<ExtractedField[]>([]);
  const [extractedText, setExtractedText] = useState<string>("");
  const [ocrConfidence, setOcrConfidence] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(true);
  const [documentNotes, setDocumentNotes] = useState("");
  const [currentStep, setCurrentStep] = useState<"loading" | "converting" | "ocr" | "extraction" | "review" | "fallback">("loading");
  const [processingProgress, setProcessingProgress] = useState<{
    pageNumber?: number;
    totalPages?: number;
    ocrProgress?: number;
    message?: string;
    error?: string;
  }>({});
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [tesseractConfig, setTesseractConfig] = useState<TesseractConfig>(TESSERACT_PRESETS.contract);

  useEffect(() => {
    if (!state?.file) {
      navigate("/");
      return;
    }
    
    processDocument();
  }, [state, navigate]);

  const extractFieldsFromText = (text: string): ExtractedField[] => {
    console.log("Starting field extraction from text:", text.substring(0, 200) + "...");
    const fields: ExtractedField[] = [];
    
    // Property Address extraction
    const addressPatterns = [
      /(?:property|subject property|premises|located at|address)[:\s]+([^\n\r]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd|boulevard)[^\n\r]*)/gi,
      /(\d+\s+[^\n\r]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd|boulevard)[^\n\r]*)/gi
    ];
    
    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match) {
        const address = match[0].replace(/^(property|subject property|premises|located at|address)[:\s]+/gi, '').trim();
        console.log("Found address:", address);
        fields.push({
          field: "Property Address",
          value: address,
          confidence: 85
        });
        break;
      }
    }

    // Purchase Price extraction
    const pricePatterns = [
      /(?:purchase price|sale price|total price)[:\s]*\$?([\d,]+(?:\.\d{2})?)/gi,
      /\$\s*([\d,]+(?:\.\d{2})?)/g
    ];
    
    for (const pattern of pricePatterns) {
      const match = text.match(pattern);
      if (match) {
        const price = match[0].match(/\$?([\d,]+(?:\.\d{2})?)/);
        if (price) {
          console.log("Found price:", price[1]);
          fields.push({
            field: "Purchase Price",
            value: `$${price[1]}`,
            confidence: 90
          });
          break;
        }
      }
    }

    // Buyer and Seller extraction
    const buyerMatch = text.match(/(?:buyer|purchaser)[:\s]+([^\n\r]+)/gi);
    if (buyerMatch) {
      const buyer = buyerMatch[0].replace(/(?:buyer|purchaser)[:\s]+/gi, '').trim();
      console.log("Found buyer:", buyer);
      fields.push({
        field: "Buyer Name",
        value: buyer,
        confidence: 80
      });
    }

    const sellerMatch = text.match(/(?:seller|vendor)[:\s]+([^\n\r]+)/gi);
    if (sellerMatch) {
      const seller = sellerMatch[0].replace(/(?:seller|vendor)[:\s]+/gi, '').trim();
      console.log("Found seller:", seller);
      fields.push({
        field: "Seller Name",
        value: seller,
        confidence: 80
      });
    }

    // Date extraction
    const datePatterns = [
      /(?:closing date|settlement date)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/gi,
      /(?:execution date|signed)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/gi
    ];

    datePatterns.forEach((pattern, index) => {
      const match = text.match(pattern);
      if (match) {
        const fieldName = index === 0 ? "Closing Date" : "Execution Date";
        const dateMatch = match[0].match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (dateMatch) {
          console.log(`Found ${fieldName}:`, dateMatch[1]);
          fields.push({
            field: fieldName,
            value: dateMatch[1],
            confidence: 75
          });
        }
      }
    });

    // Earnest Money extraction
    const earnestMatch = text.match(/(?:earnest money|deposit)[:\s]*\$?([\d,]+(?:\.\d{2})?)/gi);
    if (earnestMatch) {
      const amount = earnestMatch[0].match(/\$?([\d,]+(?:\.\d{2})?)/);
      if (amount) {
        console.log("Found earnest money:", amount[1]);
        fields.push({
          field: "Earnest Money",
          value: `$${amount[1]}`,
          confidence: 85
        });
      }
    }

    // Legal Description extraction
    const legalMatch = text.match(/(?:legal description|lot|block)[:\s]+([^\n\r]{20,})/gi);
    if (legalMatch) {
      const legal = legalMatch[0].replace(/(?:legal description)[:\s]+/gi, '').trim();
      console.log("Found legal description:", legal);
      fields.push({
        field: "Legal Description",
        value: legal,
        confidence: 70
      });
    }

    console.log("Total fields extracted:", fields.length);
    return fields;
  };

  const reprocessFields = () => {
    console.log("Reprocessing fields from updated text...");
    const newFields = extractFieldsFromText(extractedText);
    
    const requiredFields = [
      "Property Address",
      "Legal Description", 
      "Buyer Name",
      "Seller Name",
      "Purchase Price",
      "Earnest Money",
      "Execution Date",
      "Closing Date"
    ];

    const finalFields = [...newFields];
    
    requiredFields.forEach(fieldName => {
      if (!finalFields.find(f => f.field === fieldName)) {
        finalFields.push({
          field: fieldName,
          value: "",
          confidence: 0
        });
      }
    });

    setExtractedData(finalFields);
    
    toast({
      title: "Fields updated",
      description: `Re-extracted ${newFields.length} fields from corrected text`,
    });
  };

  const processDocument = async (customConfig?: TesseractConfig) => {
    try {
      console.log("Starting document processing...");
      setProcessingError(null);
      setIsProcessing(true);
      setCurrentStep("loading");

      const configToUse = customConfig || tesseractConfig;

      toast({
        title: "Starting PDF processing...",
        description: `Using ${configToUse.language} language with page segmentation mode ${configToUse.pageSegMode}`,
      });

      // Process PDF with our improved utility and custom config
      const ocrResult = await processPDFWithOCR(state.file, (progress: PDFProcessingProgress) => {
        setCurrentStep(progress.step);
        setProcessingProgress({
          pageNumber: progress.pageNumber,
          totalPages: progress.totalPages,
          ocrProgress: progress.ocrProgress,
          message: progress.message,
          error: progress.error
        });

        if (progress.error) {
          console.warn("Page processing error:", progress.error);
        }
      }, configToUse);

      console.log("PDF processing completed");
      
      // Store the extracted text and confidence
      setExtractedText(ocrResult.text);
      setOcrConfidence(ocrResult.confidence);
      
      setCurrentStep("extraction");
      toast({
        title: "Running field extraction...",
        description: "Identifying contract fields using pattern matching",
      });

      // Extract fields from OCR text
      const extractedFields = extractFieldsFromText(ocrResult.text);
      
      // Add default fields if not found
      const requiredFields = [
        "Property Address",
        "Legal Description", 
        "Buyer Name",
        "Seller Name",
        "Purchase Price",
        "Earnest Money",
        "Execution Date",
        "Closing Date"
      ];

      const finalFields = [...extractedFields];
      
      requiredFields.forEach(fieldName => {
        if (!finalFields.find(f => f.field === fieldName)) {
          finalFields.push({
            field: fieldName,
            value: "",
            confidence: 0
          });
        }
      });

      setExtractedData(finalFields);
      setCurrentStep("review");
      setIsProcessing(false);

      const successMessage = ocrResult.confidence > 70 
        ? `Successfully extracted ${extractedFields.length} fields with ${Math.round(ocrResult.confidence)}% confidence`
        : `Extracted ${extractedFields.length} fields but with low confidence (${Math.round(ocrResult.confidence)}%). Please review carefully.`;

      toast({
        title: "Processing complete!",
        description: successMessage,
        variant: ocrResult.confidence > 70 ? "default" : "destructive"
      });

    } catch (error) {
      console.error("Processing error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setProcessingError(errorMessage);
      
      toast({
        title: "Processing failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsProcessing(false);
      setCurrentStep("fallback");
    }
  };

  const handleTesseractConfigChange = (newConfig: TesseractConfig) => {
    setTesseractConfig(newConfig);
  };

  const handleReprocessWithNewConfig = () => {
    processDocument(tesseractConfig);
  };

  const handleFieldUpdate = (fieldName: string, newValue: string) => {
    setExtractedData(prev =>
      prev.map(field =>
        field.field === fieldName
          ? { ...field, value: newValue, confidence: 100 }
          : field
      )
    );
  };

  const exportToCSV = () => {
    const headers = [
      "Filename",
      "Property Address",
      "Legal Description", 
      "Buyer",
      "Seller",
      "Purchase Price",
      "Earnest Money",
      "Execution Date",
      "Closing Date",
      "Notes"
    ];

    const values = [
      state.fileId,
      ...extractedData.map(field => field.value),
      documentNotes
    ];

    const csvContent = [headers, values]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.fileId}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV exported successfully",
      description: `Downloaded ${state.fileId}.csv`,
    });
  };

  if (!state?.file) {
    return null;
  }

  const lowConfidenceCount = extractedData.filter(
    field => field.confidence < state.confidenceThreshold
  ).length;

  const getProgressMessage = () => {
    if (processingProgress.error) {
      return `Error: ${processingProgress.error}`;
    }
    
    if (processingProgress.message) {
      return processingProgress.message;
    }
    
    switch (currentStep) {
      case "loading":
        return "Loading PDF document...";
      case "converting":
        return `Converting page ${processingProgress.pageNumber}/${processingProgress.totalPages} to image...`;
      case "ocr":
        return `Running OCR on page ${processingProgress.pageNumber}/${processingProgress.totalPages}...`;
      case "extraction":
        return "Extracting contract fields...";
      case "fallback":
        return "Processing failed - please check the error details below";
      default:
        return "Processing...";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                onClick={() => navigate("/")}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-bold text-red-800">Processing: {state.fileId}</h1>
                <p className="text-sm text-gray-600">{state.file.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {currentStep === "review" && (
                <>
                  {lowConfidenceCount > 0 && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {lowConfidenceCount} Low Confidence
                    </Badge>
                  )}
                  <Button onClick={exportToCSV} className="bg-red-700 hover:bg-red-800">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {isProcessing ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {getProgressMessage()}
            </h3>
            
            {processingProgress.totalPages && (
              <p className="text-gray-600 mb-4">
                Processing {processingProgress.totalPages} page{processingProgress.totalPages > 1 ? 's' : ''}
              </p>
            )}
            
            {currentStep === "ocr" && processingProgress.ocrProgress && (
              <div className="w-64 mx-auto bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-red-700 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${processingProgress.ocrProgress}%` }}
                ></div>
                <p className="text-sm text-gray-500 mt-2">{processingProgress.ocrProgress}% complete</p>
              </div>
            )}

            {processingProgress.error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
                <p className="text-red-800 text-sm">{processingProgress.error}</p>
              </div>
            )}
          </div>
        ) : processingError ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Failed</h3>
            <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{processingError}</p>
            </div>
            <div className="space-y-2 text-sm text-gray-600 max-w-md mx-auto">
              <p><strong>Common solutions:</strong></p>
              <ul className="text-left space-y-1">
                <li>• Ensure the PDF is not password-protected</li>
                <li>• Try a smaller file (under 50MB, max 20 pages)</li>
                <li>• Make sure the PDF contains readable text</li>
                <li>• Check that the file is not corrupted</li>
              </ul>
            </div>
            <Button 
              onClick={() => navigate("/")} 
              className="mt-6 bg-red-700 hover:bg-red-800"
            >
              Try Another Document
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Document Viewer - Full Width */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="h-5 w-5 mr-2" />
                  Document View
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentViewer file={state.file} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Extracted Text Viewer */}
              <div className="space-y-4">
                <ExtractedTextViewer
                  extractedText={extractedText}
                  confidence={ocrConfidence}
                  onTextUpdate={setExtractedText}
                />
                <Button 
                  onClick={reprocessFields} 
                  className="w-full bg-red-700 hover:bg-red-800"
                  disabled={!extractedText.trim()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-extract Fields from Updated Text
                </Button>
              </div>

              {/* Middle Column: Tesseract Configuration */}
              <div>
                <TesseractConfigComponent
                  config={tesseractConfig}
                  onConfigChange={handleTesseractConfigChange}
                  onReprocess={handleReprocessWithNewConfig}
                  isProcessing={isProcessing}
                />
              </div>

              {/* Right Column: Field Extractor */}
              <Card>
                <CardHeader>
                  <CardTitle>Extracted Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <FieldExtractor
                    extractedData={extractedData}
                    confidenceThreshold={state.confidenceThreshold}
                    onFieldUpdate={handleFieldUpdate}
                    documentNotes={documentNotes}
                    onNotesChange={setDocumentNotes}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProcessContract;
