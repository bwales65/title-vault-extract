
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Settings, RotateCcw } from "lucide-react";
import { TesseractConfig, TESSERACT_PRESETS } from "@/utils/pdfProcessor";

interface TesseractConfigProps {
  config: TesseractConfig;
  onConfigChange: (config: TesseractConfig) => void;
  onReprocess: () => void;
  isProcessing: boolean;
}

export const TesseractConfigComponent = ({ 
  config, 
  onConfigChange, 
  onReprocess,
  isProcessing 
}: TesseractConfigProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handlePresetChange = (presetName: string) => {
    if (presetName in TESSERACT_PRESETS) {
      onConfigChange(TESSERACT_PRESETS[presetName as keyof typeof TESSERACT_PRESETS]);
    }
  };

  const handleConfigChange = (key: keyof TesseractConfig, value: any) => {
    onConfigChange({
      ...config,
      [key]: value
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          OCR Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset Selection */}
        <div className="space-y-2">
          <Label>Document Type Preset</Label>
          <Select onValueChange={handlePresetChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a preset..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contract">
                <div>
                  <div className="font-medium">Contract (Default)</div>
                  <div className="text-xs text-gray-500">Optimized for legal documents</div>
                </div>
              </SelectItem>
              <SelectItem value="form">
                <div>
                  <div className="font-medium">Form</div>
                  <div className="text-xs text-gray-500">Single column, variable text sizes</div>
                </div>
              </SelectItem>
              <SelectItem value="mixed">
                <div>
                  <div className="font-medium">Mixed Layout</div>
                  <div className="text-xs text-gray-500">Automatic page segmentation</div>
                </div>
              </SelectItem>
              <SelectItem value="singleLine">
                <div>
                  <div className="font-medium">Single Line</div>
                  <div className="text-xs text-gray-500">For single line text</div>
                </div>
              </SelectItem>
              <SelectItem value="sparseText">
                <div>
                  <div className="font-medium">Sparse Text</div>
                  <div className="text-xs text-gray-500">For documents with scattered text</div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Basic Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Language</Label>
            <Input
              value={config.language}
              onChange={(e) => handleConfigChange('language', e.target.value)}
              placeholder="eng"
            />
            <p className="text-xs text-gray-500">Use 'eng' for English, 'spa' for Spanish, etc.</p>
          </div>
          
          <div className="space-y-2">
            <Label>Page Segmentation Mode</Label>
            <Select 
              value={config.pageSegMode?.toString() || "6"} 
              onValueChange={(value) => handleConfigChange('pageSegMode', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Fully automatic page segmentation</SelectItem>
                <SelectItem value="4">Single column text of variable sizes</SelectItem>
                <SelectItem value="6">Uniform block of text (Default)</SelectItem>
                <SelectItem value="7">Single text line</SelectItem>
                <SelectItem value="8">Single word</SelectItem>
                <SelectItem value="11">Sparse text</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full"
        >
          {showAdvanced ? "Hide" : "Show"} Advanced Settings
        </Button>

        {showAdvanced && (
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Character Whitelist</Label>
              <Textarea
                value={config.tesseditCharWhitelist || ""}
                onChange={(e) => handleConfigChange('tesseditCharWhitelist', e.target.value)}
                placeholder="Leave empty to allow all characters"
                rows={2}
                className="text-xs"
              />
              <p className="text-xs text-gray-500">Only these characters will be recognized</p>
            </div>

            <div className="space-y-2">
              <Label>Character Blacklist</Label>
              <Input
                value={config.tesseditCharBlacklist || ""}
                onChange={(e) => handleConfigChange('tesseditCharBlacklist', e.target.value)}
                placeholder="Characters to ignore"
              />
              <p className="text-xs text-gray-500">These characters will be ignored</p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="preserveSpaces"
                checked={config.preserveInterwordSpaces || false}
                onChange={(e) => handleConfigChange('preserveInterwordSpaces', e.target.checked)}
              />
              <Label htmlFor="preserveSpaces">Preserve Inter-word Spaces</Label>
            </div>
          </div>
        )}

        {/* Current Config Display */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm font-medium mb-2">Current Configuration:</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Language:</span>
              <Badge variant="secondary">{config.language}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Page Seg Mode:</span>
              <Badge variant="secondary">{config.pageSegMode}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Preserve Spaces:</span>
              <Badge variant="secondary">{config.preserveInterwordSpaces ? "Yes" : "No"}</Badge>
            </div>
          </div>
        </div>

        {/* Reprocess Button */}
        <Button 
          onClick={onReprocess} 
          disabled={isProcessing}
          className="w-full bg-red-700 hover:bg-red-800"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {isProcessing ? "Processing..." : "Reprocess with New Settings"}
        </Button>
      </CardContent>
    </Card>
  );
};
