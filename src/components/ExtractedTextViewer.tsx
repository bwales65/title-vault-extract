
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileText } from "lucide-react";

interface ExtractedTextViewerProps {
  extractedText: string;
  confidence: number;
  onTextUpdate: (newText: string) => void;
}

export const ExtractedTextViewer = ({ 
  extractedText, 
  confidence, 
  onTextUpdate 
}: ExtractedTextViewerProps) => {
  const isLowConfidence = confidence < 70;

  return (
    <Card className={isLowConfidence ? "border-red-200 bg-red-50" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Extracted Text (OCR Output)
          </CardTitle>
          <Badge variant={isLowConfidence ? "destructive" : "secondary"}>
            {isLowConfidence && <AlertTriangle className="h-3 w-3 mr-1" />}
            {Math.round(confidence)}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            This is the raw text extracted from your document. You can edit it to correct any OCR errors before field extraction.
          </p>
          {isLowConfidence && (
            <p className="text-sm text-red-600 bg-red-100 p-2 rounded">
              Low confidence detected - please review and correct the text below
            </p>
          )}
          <Textarea
            value={extractedText}
            onChange={(e) => onTextUpdate(e.target.value)}
            className={`min-h-[300px] font-mono text-sm ${isLowConfidence ? "border-red-300 focus:border-red-500" : ""}`}
            placeholder="Extracted text will appear here..."
          />
        </div>
      </CardContent>
    </Card>
  );
};
