document.addEventListener('DOMContentLoaded', () => {
    const FONT_LOAD_DELAY_MS = 200;

    const canvas = document.getElementById('thumbnail-canvas');
    const ctx = canvas.getContext('2d');

    let previewFrameScheduled = false;
    function refreshPreview() {
        if (previewFrameScheduled) return;
        previewFrameScheduled = true;
        requestAnimationFrame(() => {
            previewFrameScheduled = false;
            renderCanvas(ctx);
        });
    }

    document.fonts.ready.then(() => {
        setTimeout(refreshPreview, FONT_LOAD_DELAY_MS);
    });

    // Inputs
    const quoteTextInput = document.getElementById('quoteText');
    const citationTextInput = document.getElementById('citationText');
    const themeColorInput = document.getElementById('themeColor');

    // Buttons
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');

    quoteTextInput.addEventListener('input', refreshPreview);
    citationTextInput.addEventListener('input', refreshPreview);
    themeColorInput.addEventListener('input', refreshPreview);

    // Render Canvas
    generateBtn.addEventListener('click', () => {
        refreshPreview();
    });

    function slugifyEpisodeFilename(title) {
        return title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    }

    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        const episodeFileName = slugifyEpisodeFilename(citationTextInput.value || 'quote');
        link.download = `${episodeFileName}-quote.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    // ----------------------------------------------------
    // Canvas drawing
    // ----------------------------------------------------
    function renderCanvas(renderCtx) {
        const width = renderCtx.canvas.width;
        const height = renderCtx.canvas.height;
        const themeColor = themeColorInput.value;

        // Background
        renderCtx.fillStyle = '#111111';
        renderCtx.fillRect(0, 0, width, height);

        // Subtle gradient background
        const gradient = renderCtx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, lightenColor(themeColor, -20));
        gradient.addColorStop(1, '#111111');
        renderCtx.fillStyle = gradient;
        renderCtx.fillRect(0, 0, width, height);

        // Draw halftone pattern
        drawHalftone(renderCtx, width, height);

        // Add quote marks graphic
        renderCtx.save();
        renderCtx.fillStyle = themeColor;
        renderCtx.globalAlpha = 0.2;
        renderCtx.font = '800px "Bangers", impact, sans-serif';
        renderCtx.textAlign = 'left';
        renderCtx.textBaseline = 'top';
        renderCtx.fillText('"', 150, -50);
        renderCtx.restore();

        const quote = quoteTextInput.value.trim();
        const citation = citationTextInput.value.trim();

        // Dynamic font sizing
        const lineSpacing = 1.3;
        const maxWidth = width - 600; // padding
        const maxHeight = height - 400; // room for top/bottom padding and citation
        
        let quoteFontSize = 280;
        const minFontSize = 60;
        let lines = [];
        
        const words = quote.split(' ');
        
        while (quoteFontSize >= minFontSize) {
            renderCtx.font = `italic 600 ${quoteFontSize}px "Playfair Display", serif`;
            
            let wordTooLong = false;
            for (const word of words) {
                if (renderCtx.measureText(word).width > maxWidth) {
                    wordTooLong = true;
                    break;
                }
            }
            
            if (wordTooLong) {
                quoteFontSize -= 10;
                continue;
            }
            
            lines = [];
            let currentLine = words[0] || '';
            
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const lineWidth = renderCtx.measureText(currentLine + ' ' + word).width;
                if (lineWidth < maxWidth) {
                    currentLine += ' ' + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) {
                lines.push(currentLine);
            }
            
            const textHeight = lines.length * quoteFontSize * lineSpacing;
            if (textHeight <= maxHeight) {
                break;
            }
            quoteFontSize -= 10;
        }

        renderCtx.font = `italic 600 ${quoteFontSize}px "Playfair Display", serif`;
        renderCtx.fillStyle = '#ffffff';
        renderCtx.textAlign = 'left';
        renderCtx.textBaseline = 'middle';

        const totalTextHeight = lines.length * quoteFontSize * lineSpacing;
        let startY = (height - totalTextHeight) / 2 + 50; // Brought down from the top edge

        lines.forEach((line, index) => {
            renderCtx.fillText(line, 300, startY + (index * quoteFontSize * lineSpacing));
        });

        // Draw Citation
        if (citation) {
            renderCtx.font = `600 80px "Playfair Display", serif`; // Non-italic, same font
            renderCtx.fillStyle = themeColor;
            renderCtx.textAlign = 'right'; // Right align
            const citationY = startY + (lines.length * quoteFontSize * lineSpacing) + 60;
            renderCtx.fillText(`— ${citation}`, width - 300, citationY);
        }
    }

    function drawHalftone(ctx, width, height) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#ffffff';

        const spacing = 20;
        const dotRadius = 5;
        for (let y = 0; y < height; y += spacing) {
            for (let x = 0; x < width; x += spacing) {
                const shiftX = (y / spacing) % 2 === 0 ? 0 : spacing / 2;
                ctx.beginPath();
                ctx.arc(x + shiftX, y, dotRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    function clampByte(value) {
        if (value < 1) return 0;
        if (value > 255) return 255;
        return value;
    }

    function lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = clampByte(((num >> 16) & 0xff) + amt);
        const G = clampByte(((num >> 8) & 0xff) + amt);
        const B = clampByte((num & 0xff) + amt);
        return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }
});
