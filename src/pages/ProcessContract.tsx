import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Eye, AlertTriangle } from "lucide-react";
import { DocumentViewer } from "@/components/DocumentViewer";
import { FieldExtractor } from "@/components/FieldExtractor";
import { toast } from "@/hooks/use-toast";
import Tesseract from 'tesseract.js';

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
  const [isProcessing, setIsProcessing] = useState(true);
  const [documentNotes, setDocumentNotes] = useState("");
  const [currentStep, setCurrentStep] = useState<"ocr" | "extraction" | "review">("ocr");
  const [ocrProgress, setOcrProgress] = useState(0);

  useEffect(() => {
    if (!state?.file) {
      navigate("/");
      return;
    }
    
    processDocument();
  }, [state, navigate]);

  const extractFieldsFromText = (text: string): ExtractedField[] => {
    const fields: ExtractedField[] = [];
    
    // Property Address extraction
    const addressPatterns = [
      /(?:property|subject property|premises|located at|address)[:\s]+([^\n\r]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd|boulevard)[^\n\r]*)/gi,
      /(\d+\s+[^\n\r]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd|boulevard)[^\n\r]*)/gi
    ];
    
    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match) {
        fields.push({
          field: "Property Address",
          value: match[0].replace(/^(property|subject property|premises|located at|address)[:\s]+/gi, '').trim(),
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
      fields.push({
        field: "Buyer Name",
        value: buyerMatch[0].replace(/(?:buyer|purchaser)[:\s]+/gi, '').trim(),
        confidence: 80
      });
    }

    const sellerMatch = text.match(/(?:seller|vendor)[:\s]+([^\n\r]+)/gi);
    if (sellerMatch) {
      fields.push({
        field: "Seller Name",
        value: sellerMatch[0].replace(/(?:seller|vendor)[:\s]+/gi, '').trim(),
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
      fields.push({
        field: "Legal Description",
        value: legalMatch[0].replace(/(?:legal description)[:\s]+/gi, '').trim(),
        confidence: 70
      });
    }

    return fields;
  };

  const processDocument = async () => {
    try {
      setCurrentStep("ocr");
      toast({
        title: "Starting OCR processing...",
        description: "Extracting text from your document",
      });

      // Convert PDF to images and run OCR
      const text = await Tesseract.recognize(state.file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      console.log("OCR completed, extracted text:", text.data.text);
      
      setCurrentStep("extraction");
      toast({
        title: "Running AI extraction...",
        description: "Identifying contract fields using pattern matching",
      });

      // Extract fields from OCR text
      const extractedFields = extractFieldsFromText(text.data.text);
      
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

      toast({
        title: "Processing complete!",
        description: `Extracted ${extractedFields.length} fields from document`,
      });
    } catch (error) {
      console.error("Processing error:", error);
      toast({
        title: "Processing failed",
        description: "There was an error processing your document",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
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
              {currentStep === "ocr" && "Running OCR..."}
              {currentStep === "extraction" && "Extracting Fields..."}
            </h3>
            <p className="text-gray-600 mb-4">
              {currentStep === "ocr" && "Converting document to text"}
              {currentStep === "extraction" && "Using pattern matching to identify contract data"}
            </p>
            {currentStep === "ocr" && ocrProgress > 0 && (
              <div className="w-64 mx-auto bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-700 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${ocrProgress}%` }}
                ></div>
                <p className="text-sm text-gray-500 mt-2">{ocrProgress}% complete</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Document Viewer */}
            <Card className="h-fit">
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

            {/* Field Extractor */}
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
        )}
      </main>
    </div>
  );
};

export default ProcessContract;
