import { Upload, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { importService } from '../../api/import.service';
import { toast } from 'sonner';

export const ManifestUploader = () => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await importService.uploadManifest(file);
      toast.success('Manifest Processed', { 
        description: `Created ${result.count} new shipments from manifest.` 
      });
    } catch (err) {
      toast.error('Manifest Error', { description: 'File format invalid or duplicate entries found.' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative group">
      <input 
        type="file" 
        className="absolute inset-0 opacity-0 cursor-pointer z-10" 
        onChange={handleFile}
        disabled={isUploading}
      />
      <div className="bg-brand/5 border border-dashed border-brand/20 p-8 rounded-3xl text-center group-hover:bg-brand/10 transition-all">
        {isUploading ? (
          <Loader2 className="animate-spin mx-auto text-brand mb-2" />
        ) : (
          <Upload className="mx-auto text-brand mb-2" />
        )}
        <p className="text-sm font-bold text-brand italic font-mono">Process Container Manifest (.csv / .xlsx)</p>
        <p className="text-[10px] text-gray-400 mt-1">Batch create up to 500 shipments per file</p>
      </div>
    </div>
  );
};