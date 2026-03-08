interface TooltipData {
  show: boolean;
  x: number;
  y: number;
  content: string;
}

export default function MapTooltip({ tooltipData }: { tooltipData: TooltipData }) {
  return (
    <>
      {tooltipData.show && (
        <div
          className='absolute bg-black/80 text-white px-3 py-2 rounded text-xs font-sans pointer-events-none z-[1000] whitespace-pre-line max-w-[200px] shadow-lg'
          style={{
            left: tooltipData.x + 10,
            top: tooltipData.y - 10,
          }}
        >
          {tooltipData.content}
        </div>
      )}
    </>
  );
}
