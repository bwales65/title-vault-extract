
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface DocumentViewerProps {
  file: File;
}

export const DocumentViewer = ({ file }: DocumentViewerProps) => {
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (file) {
      try {
        const url = URL.createObjectURL(file);
        setPdfUrl(url);
        setHasError(false);

        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (error) {
        console.error("Error creating PDF URL:", error);
        setHasError(true);
      }
    }
  }, [file]);

  if (hasError) {
    return (
      <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-red-50 flex items-center justify-center">
        <div className="text-center p-6">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">Unable to display PDF</p>
          <p className="text-red-600 text-sm mt-1">File may be corrupted or invalid</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-gray-50">
      {pdfUrl ? (
        <iframe
          src={pdfUrl}
          className="w-full h-full border-0"
          title="Document Preview"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mx-auto mb-3"></div>
            <p className="text-gray-600">Loading document...</p>
          </div>
        </div>
      )}
    </div>
  );
};
