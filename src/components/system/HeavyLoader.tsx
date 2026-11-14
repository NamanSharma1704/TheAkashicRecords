// Loading Fallback Strategy
export const HeavyLoader = ({ theme }: { theme: any }) => (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center" role="status" aria-label="Loading">
        <div className={`w-16 h-16 border-2 border-dashed ${theme.id === 'LIGHT' ? 'border-violet-400' : 'border-amber-500'} rounded-full animate-spin`} />
    </div>
);
