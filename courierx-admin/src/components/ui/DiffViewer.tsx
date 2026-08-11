import { ArrowRight } from 'lucide-react';

interface DiffViewerProps {
  changes: Record<string, any>;
}

export const DiffViewer = ({ changes }: DiffViewerProps) => {
  if (!changes) return <span className="text-gray-400 italic text-xs">No data snapshot</span>;

  // Expected format: { oldBalance: 10, newBalance: 50, field: 'balance' }
  // Or: { oldStatus: 'pending', newStatus: 'approved' }

  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="space-y-2">
        {Object.entries(changes).map(([key, value]) => {
          // Logic to identify pairs (e.g., oldBalance and newBalance)
          if (key.startsWith('old')) {
            const fieldName = key.replace('old', ''); // e.g., "Balance"
            const newValue = changes[`new${fieldName}`];

            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-500 uppercase">{fieldName}:</span>
                <div className="flex items-center gap-2">
                  <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100 line-through">
                    {typeof value === 'number' ? `$${value.toFixed(2)}` : value}
                  </span>
                  <ArrowRight size={12} className="text-gray-400" />
                  <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100 font-bold">
                    {typeof newValue === 'number' ? `$${newValue.toFixed(2)}` : newValue}
                  </span>
                </div>
              </div>
            );
          }
          // Skip the "new" keys because they are handled by the "old" logic
          if (key.startsWith('new')) return null;

          // Handle generic key-value pairs that aren't old/new pairs
          return (
            <div key={key} className="flex justify-between text-[10px] text-gray-400 italic">
              <span>{key}:</span>
              <span>{JSON.stringify(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};