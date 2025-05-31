import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Settings, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileNumber, setFileNumber] = useState("0001");
  const [closerInitials, setCloserInitials] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const navigate = useNavigate();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      console.log("File selected:", file.name);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFile = () => {
    console.log("Remove button clicked");
    setSelectedFile(null);
    // Clear the file input
    const fileInput = document.getElementById("file-upload") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
      console.log("File input cleared");
    }
    toast({
      title: "File removed",
      description: "The selected file has been removed.",
    });
  };

  const generateFileId = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    return `${year}-${fileNumber}-${closerInitials}`;
  };

  const handleUpload = () => {
    if (!selectedFile || !closerInitials) {
      toast({
        title: "Missing information",
        description: "Please select a file and enter closer initials.",
        variant: "destructive",
      });
      return;
    }

    const fileId = generateFileId();
    console.log("Processing file:", selectedFile.name, "with ID:", fileId);
    
    // Navigate to processing page with file data
    navigate("/process", {
      state: {
        file: selectedFile,
        fileId,
        confidenceThreshold,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-red-800">Commercial Title</h1>
              </div>
              <div className="ml-4">
                <h2 className="text-lg text-gray-600">Contract Extractor</h2>
              </div>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            Upload Commercial Contract
          </h3>
          <p className="text-lg text-gray-600">
            Upload a PDF contract to extract structured data using AI-powered OCR and NLP
          </p>
        </div>

        {/* Upload Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="h-5 w-5 mr-2 text-red-600" />
              Document Upload
            </CardTitle>
            <CardDescription>
              Select a PDF contract file for processing. Only one file can be processed at a time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file-upload">Contract File (PDF)</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {selectedFile && (
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center text-sm text-gray-600">
                    <FileText className="h-4 w-4 mr-2" />
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              )}
            </div>

            {/* File Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="file-number">File Number</Label>
                <Input
                  id="file-number"
                  value={fileNumber}
                  onChange={(e) => setFileNumber(e.target.value)}
                  placeholder="0001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closer-initials">Closer Initials</Label>
                <Input
                  id="closer-initials"
                  value={closerInitials}
                  onChange={(e) => setCloserInitials(e.target.value.toUpperCase())}
                  placeholder="BW"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confidence">Confidence Threshold (%)</Label>
                <Input
                  id="confidence"
                  type="number"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  min="0"
                  max="100"
                />
              </div>
            </div>

            {/* Generated File ID Preview */}
            {closerInitials && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <Label className="text-sm font-medium text-gray-700">Generated File ID:</Label>
                <p className="text-lg font-mono text-red-700">{generateFileId()}</p>
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !closerInitials}
              className="w-full bg-red-700 hover:bg-red-800 text-white"
              size="lg"
            >
              <Upload className="h-5 w-5 mr-2" />
              Process Contract
            </Button>
          </CardContent>
        </Card>

        {/* Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What We Extract</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>• Property Address</li>
                <li>• Legal Description</li>
                <li>• Buyer & Seller Names</li>
                <li>• Purchase Price</li>
                <li>• Earnest Money</li>
                <li>• Execution & Closing Dates</li>
              </ul>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Processing Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>• OCR text extraction</li>
                <li>• AI-powered field identification</li>
                <li>• Confidence scoring</li>
                <li>• Manual review & editing</li>
                <li>• CSV export</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;
