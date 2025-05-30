
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check } from "lucide-react";

interface ExtractedField {
  field: string;
  value: string;
  confidence: number;
  originalText?: string;
}

interface FieldExtractorProps {
  extractedData: ExtractedField[];
  confidenceThreshold: number;
  onFieldUpdate: (fieldName: string, newValue: string) => void;
  documentNotes: string;
  onNotesChange: (notes: string) => void;
}

export const FieldExtractor = ({
  extractedData,
  confidenceThreshold,
  onFieldUpdate,
  documentNotes,
  onNotesChange,
}: FieldExtractorProps) => {
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  const handleFieldChange = (fieldName: string, newValue: string) => {
    onFieldUpdate(fieldName, newValue);
    setEditedFields(prev => new Set(prev).add(fieldName));
  };

  const getFieldDisplayName = (field: string) => {
    const displayNames: Record<string, string> = {
      "Property Address": "Property Address",
      "Legal Description": "Legal Description",
      "Buyer Name": "Buyer Name",
      "Seller Name": "Seller Name",
      "Purchase Price": "Purchase Price",
      "Earnest Money": "Earnest Money",
      "Execution Date": "Execution Date",
      "Closing Date": "Closing Date",
    };
    return displayNames[field] || field;
  };

  const getInputType = (field: string) => {
    if (field.includes("Date")) return "date";
    return "text";
  };

  const formatDateValue = (field: string, value: string) => {
    if (field.includes("Date") && value) {
      // Convert MM/DD/YYYY to YYYY-MM-DD for date input
      const parts = value.split("/");
      if (parts.length === 3) {
        const [month, day, year] = parts;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }
    return value;
  };

  const handleDateChange = (field: string, dateValue: string) => {
    // Convert YYYY-MM-DD back to MM/DD/YYYY
    if (dateValue) {
      const parts = dateValue.split("-");
      if (parts.length === 3) {
        const [year, month, day] = parts;
        const formattedDate = `${month}/${day}/${year}`;
        handleFieldChange(field, formattedDate);
        return;
      }
    }
    handleFieldChange(field, dateValue);
  };

  return (
    <div className="space-y-6">
      {/* Extracted Fields */}
      <div className="space-y-4">
        {extractedData.map((field) => {
          const isLowConfidence = field.confidence < confidenceThreshold;
          const isEdited = editedFields.has(field.field);
          const inputType = getInputType(field.field);
          const displayValue = inputType === "date" 
            ? formatDateValue(field.field, field.value)
            : field.value;

          return (
            <Card key={field.field} className={isLowConfidence ? "border-red-200 bg-red-50" : ""}>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={field.field} className="text-sm font-medium">
                      {getFieldDisplayName(field.field)}
                    </Label>
                    <div className="flex items-center space-x-2">
                      {isEdited && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Edited
                        </Badge>
                      )}
                      <Badge
                        variant={isLowConfidence ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {isLowConfidence && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {field.confidence}% confidence
                      </Badge>
                    </div>
                  </div>
                  
                  {field.field === "Legal Description" ? (
                    <Textarea
                      id={field.field}
                      value={field.value}
                      onChange={(e) => handleFieldChange(field.field, e.target.value)}
                      className={isLowConfidence ? "border-red-300 focus:border-red-500" : ""}
                      rows={3}
                    />
                  ) : (
                    <Input
                      id={field.field}
                      type={inputType}
                      value={displayValue}
                      onChange={(e) => {
                        if (inputType === "date") {
                          handleDateChange(field.field, e.target.value);
                        } else {
                          handleFieldChange(field.field, e.target.value);
                        }
                      }}
                      className={isLowConfidence ? "border-red-300 focus:border-red-500" : ""}
                    />
                  )}
                  
                  {isLowConfidence && (
                    <p className="text-xs text-red-600">
                      Low confidence - please verify this field
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Document Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Document Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={documentNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add any additional notes about this document..."
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
};
