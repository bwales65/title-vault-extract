
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface DocumentViewerProps {
  file: File;
}

export const DocumentViewer = ({ file }: DocumentViewerProps) => {
  const [pdfUrl, setPdfUrl] = useState<string>("");

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file]);

  return (
    <div className="w-full h-96 border rounded-lg overflow-hidden">
      {pdfUrl ? (
        <iframe
          src={pdfUrl}
          className="w-full h-full"
          title="Document Preview"
        />
      ) : (
        <div className="flex items-center justify-center h-full bg-gray-100">
          <p className="text-gray-500">Loading document...</p>
        </div>
      )}
    </div>
  );
};
