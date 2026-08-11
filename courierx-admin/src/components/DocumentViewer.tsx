import { X, ZoomIn, Download } from 'lucide-react';

export const DocumentViewer = ({ url, onClose, title }: { url: string; onClose: () => void; title: string }) => {
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl flex justify-between items-center text-white mb-4">
        <h3 className="font-bold uppercase tracking-widest text-sm">{title}</h3>
        <div className="flex gap-4">
          <a href={url} target="_blank" download className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Download size={20} />
          </a>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
      </div>
      <img src={url} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain animate-in zoom-in duration-300" alt="Identity Document" />
    </div>
  );
};