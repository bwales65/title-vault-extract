
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Eye, AlertTriangle } from "lucide-react";
import { DocumentViewer } from "@/components/DocumentViewer";
import { FieldExtractor } from "@/components/FieldExtractor";
import { toast } from "@/hooks/use-toast";

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

  useEffect(() => {
    if (!state?.file) {
      navigate("/");
      return;
    }
    
    processDocument();
  }, [state, navigate]);

  const processDocument = async () => {
    try {
      setCurrentStep("ocr");
      toast({
        title: "Starting OCR processing...",
        description: "Extracting text from your document",
      });

      // Simulate OCR processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setCurrentStep("extraction");
      toast({
        title: "Running AI extraction...",
        description: "Identifying contract fields using AI",
      });

      // Simulate AI field extraction
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock extracted data
      const mockData: ExtractedField[] = [
        { field: "Property Address", value: "123 Main Street, Oklahoma City, OK 73102", confidence: 95 },
        { field: "Legal Description", value: "Lot 1, Block 2, Smith Addition, Oklahoma County, Oklahoma", confidence: 88 },
        { field: "Buyer Name", value: "John and Jane Doe", confidence: 92 },
        { field: "Seller Name", value: "ABC Properties LLC", confidence: 89 },
        { field: "Purchase Price", value: "$1,250,000.00", confidence: 98 },
        { field: "Earnest Money", value: "$25,000.00", confidence: 85 },
        { field: "Execution Date", value: "03/15/2025", confidence: 82 },
        { field: "Closing Date", value: "04/30/2025", confidence: 79 },
      ];

      setExtractedData(mockData);
      setCurrentStep("review");
      setIsProcessing(false);

      toast({
        title: "Processing complete!",
        description: "Review and edit the extracted data below",
      });
    } catch (error) {
      console.error("Processing error:", error);
      toast({
        title: "Processing failed",
        description: "There was an error processing your document",
        variant: "destructive",
      });
    }
  };

  const handleFieldUpdate = (fieldName: string, newValue: string) => {
    setExtractedData(prev =>
      prev.map(field =>
        field.field === fieldName
          ? { ...field, value: newValue, confidence: 100 } // Manual edits get 100% confidence
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
            <p className="text-gray-600">
              {currentStep === "ocr" && "Converting document to text"}
              {currentStep === "extraction" && "Using AI to identify contract data"}
            </p>
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
