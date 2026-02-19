import html2canvas from 'html2canvas';

export async function shareTradeVerdict(elementId = 'trade-verdict-panel') {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, { backgroundColor: null });

  if (navigator.share && navigator.canShare) {
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'allfantasy-trade-analysis.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'AllFantasy Trade Analysis',
            text: 'Check out my trade analysis on AllFantasy!',
            files: [file],
          });
          return;
        }
        downloadFallback(canvas);
      }, 'image/png');
    } catch {
      downloadFallback(canvas);
    }
  } else {
    downloadFallback(canvas);
  }
}

function downloadFallback(canvas: HTMLCanvasElement) {
  const link = document.createElement('a');
  link.download = 'allfantasy-trade-analysis.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
