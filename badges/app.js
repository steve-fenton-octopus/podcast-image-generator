document.addEventListener('DOMContentLoaded', () => {
    const FONT_LOAD_DELAY_MS = 200;
    const FONT_FAMILY = '"Source Sans 3", "Segoe UI", Arial, sans-serif';

    const METAL_COLORS = {
        gold:   { base: '#D4A017', light: '#F0C84C', dark: '#A07810' },
        silver: { base: '#9BA3AE', light: '#C8CDD4', dark: '#6A7280' },
        bronze: { base: '#B87333', light: '#D4965A', dark: '#8A5520' }
    };

    const canvas = document.getElementById('badge-canvas');
    const ctx = canvas.getContext('2d');

    const badgeNameInput    = document.getElementById('badgeName');
    const badgeYearInput    = document.getElementById('badgeYear');
    const badgeSidesInput   = document.getElementById('badgeSides');
    const highlightColorInput = document.getElementById('highlightColor');
    const metalInputs       = document.querySelectorAll('input[name="badgeMetal"]');
    const generateBtn       = document.getElementById('generate-btn');
    const downloadBtn       = document.getElementById('download-btn');

    let previewFrameScheduled = false;
    function refreshPreview() {
        if (previewFrameScheduled) return;
        previewFrameScheduled = true;
        requestAnimationFrame(() => {
            previewFrameScheduled = false;
            renderCanvas(ctx);
        });
    }

    document.fonts.ready.then(() => setTimeout(refreshPreview, FONT_LOAD_DELAY_MS));

    badgeNameInput.addEventListener('input', refreshPreview);
    badgeYearInput.addEventListener('input', refreshPreview);
    badgeSidesInput.addEventListener('change', refreshPreview);
    highlightColorInput.addEventListener('input', refreshPreview);
    metalInputs.forEach((input) => input.addEventListener('change', refreshPreview));
    generateBtn.addEventListener('click', refreshPreview);

    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `${slugify(badgeNameInput.value || 'badge')}-badge.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    function getSelectedMetal() {
        const checked = document.querySelector('input[name="badgeMetal"]:checked');
        return checked ? checked.value : 'gold';
    }

    function slugify(str) {
        return str.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    }

    // ─── Shape helpers ──────────────────────────────────────────────────────────

    /**
     * Traces a regular polygon with rounded corners, or a circle when sides <= 1.
     * @param {number} cornerRadius  How much to round each vertex.
     */
    function traceBadgeShape(renderCtx, cx, cy, radius, sides, cornerRadius = 0) {
        if (sides <= 1) {
            renderCtx.arc(cx, cy, radius, 0, Math.PI * 2);
            return;
        }

        const step = (Math.PI * 2) / sides;
        const startAngle = -Math.PI / 2;

        const verts = [];
        for (let i = 0; i < sides; i++) {
            const a = startAngle + i * step;
            verts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
        }

        if (cornerRadius <= 0) {
            renderCtx.moveTo(verts[0][0], verts[0][1]);
            for (let i = 1; i < sides; i++) renderCtx.lineTo(verts[i][0], verts[i][1]);
            renderCtx.closePath();
            return;
        }

        for (let i = 0; i < sides; i++) {
            const prev = verts[(i - 1 + sides) % sides];
            const curr = verts[i];
            const next = verts[(i + 1) % sides];

            const dxP = prev[0] - curr[0], dyP = prev[1] - curr[1];
            const dxN = next[0] - curr[0], dyN = next[1] - curr[1];
            const lenP = Math.hypot(dxP, dyP);
            const lenN = Math.hypot(dxN, dyN);
            const r = Math.min(cornerRadius, lenP * 0.45, lenN * 0.45);

            const t1x = curr[0] + (dxP / lenP) * r;
            const t1y = curr[1] + (dyP / lenP) * r;
            const t2x = curr[0] + (dxN / lenN) * r;
            const t2y = curr[1] + (dyN / lenN) * r;

            if (i === 0) renderCtx.moveTo(t1x, t1y);
            else         renderCtx.lineTo(t1x, t1y);
            renderCtx.arcTo(curr[0], curr[1], t2x, t2y, r);
        }
        renderCtx.closePath();
    }

    function fillShape(renderCtx, cx, cy, radius, sides, cornerRadius, fillStyle) {
        renderCtx.save();
        renderCtx.beginPath();
        traceBadgeShape(renderCtx, cx, cy, radius, sides, cornerRadius);
        renderCtx.fillStyle = fillStyle;
        renderCtx.fill();
        renderCtx.restore();
    }

    function strokeShape(renderCtx, cx, cy, radius, sides, cornerRadius, strokeStyle, lineWidth) {
        renderCtx.save();
        renderCtx.beginPath();
        traceBadgeShape(renderCtx, cx, cy, radius, sides, cornerRadius);
        renderCtx.strokeStyle = strokeStyle;
        renderCtx.lineWidth = lineWidth;
        renderCtx.stroke();
        renderCtx.restore();
    }

    function clipToShape(renderCtx, cx, cy, radius, sides, cornerRadius) {
        renderCtx.beginPath();
        traceBadgeShape(renderCtx, cx, cy, radius, sides, cornerRadius);
        renderCtx.clip();
    }

    // ─── Text helpers ────────────────────────────────────────────────────────────

    /** Scales font down until the full text fits on a single line. */
    function fitSingleLine(renderCtx, text, maxWidth, startFontSize, minFontSize, weight) {
        let fontSize = startFontSize;
        while (fontSize >= minFontSize) {
            renderCtx.font = `${weight} ${fontSize}px ${FONT_FAMILY}`;
            if (renderCtx.measureText(text).width <= maxWidth) break;
            fontSize -= 2;
        }
        return fontSize;
    }

    // ─── Ribbon ──────────────────────────────────────────────────────────────────

    /**
     * Draws a horizontal ribbon with swallowtail ends that extend beyond the badge
     * edge. The white ring (drawn on top) covers the ribbon at the border band,
     * making the ribbon look like it wraps through the front of the badge.
     *
     * @param {number} centerY  Vertical centre of the ribbon.
     * @param {number} halfH    Half the ribbon height.
     * @param {number} bodyHW   Half-width of the body (should reach the badge edge).
     * @param {number} tailLen  Extra length beyond bodyHW for each tail.
     * @param {string} color    Solid fill colour.
     */
    function drawRibbon(renderCtx, cx, centerY, halfH, bodyHW, tailLen, color) {
        const y1    = centerY - halfH;
        const y2    = centerY + halfH;
        const notch = halfH * 0.9;

        renderCtx.save();
        renderCtx.beginPath();

        renderCtx.moveTo(cx - bodyHW, y1);
        renderCtx.lineTo(cx + bodyHW, y1);

        renderCtx.lineTo(cx + bodyHW + tailLen,         y1);
        renderCtx.lineTo(cx + bodyHW + tailLen - notch, centerY);
        renderCtx.lineTo(cx + bodyHW + tailLen,         y2);

        renderCtx.lineTo(cx + bodyHW, y2);
        renderCtx.lineTo(cx - bodyHW, y2);

        renderCtx.lineTo(cx - bodyHW - tailLen,         y2);
        renderCtx.lineTo(cx - bodyHW - tailLen + notch, centerY);
        renderCtx.lineTo(cx - bodyHW - tailLen,         y1);

        renderCtx.closePath();

        renderCtx.fillStyle = color;
        renderCtx.fill();

        renderCtx.restore();
    }

    // ─── Render ──────────────────────────────────────────────────────────────────

    function renderCanvas(renderCtx) {
        const size  = renderCtx.canvas.width;
        const cx    = size / 2;
        const cy    = size / 2;

        const sides     = parseInt(badgeSidesInput.value, 10) || 6;
        const metal     = METAL_COLORS[getSelectedMetal()];
        const highlight = highlightColorInput.value;
        const name      = (badgeNameInput.value.trim() || 'Badge').toUpperCase();
        const year      = String(badgeYearInput.value || new Date().getFullYear());

        renderCtx.clearRect(0, 0, size, size);

        const outerRadius  = size * 0.43;
        const cornerRadius = sides <= 1 ? 0 : outerRadius * 0.18;
        const borderWidth  = size * 0.044;
        const innerRadius  = outerRadius - borderWidth;
        const innerCorner  = sides <= 1 ? 0 : innerRadius * 0.18;

        // 1. Drop shadow behind badge
        renderCtx.save();
        renderCtx.shadowColor   = 'rgba(0,0,0,0.30)';
        renderCtx.shadowBlur    = size * 0.06;
        renderCtx.shadowOffsetY = size * 0.022;
        fillShape(renderCtx, cx, cy, outerRadius, sides, cornerRadius, highlight);
        renderCtx.restore();

        // 2. Badge body — flat highlight fill
        fillShape(renderCtx, cx, cy, outerRadius, sides, cornerRadius, highlight);

        // 3. Ribbon with tails — drawn over badge body, NOT clipped.
        //    Tails extend to the canvas edge (outerRadius + tailLen ≈ size/2).
        const ribbonCenterY = cy + innerRadius * 0.1;
        const ribbonHalfH   = innerRadius * 0.21;
        const tailLen = size * 0.04;

        drawRibbon(renderCtx, cx, ribbonCenterY, ribbonHalfH, outerRadius, tailLen, metal.base);

        // 4. White ring — evenodd fill between outer and inner paths.
        //    This covers the ribbon where it passes through the border band,
        //    making the ribbon appear to wrap through the front of the badge.
        renderCtx.save();
        renderCtx.beginPath();
        traceBadgeShape(renderCtx, cx, cy, outerRadius, sides, cornerRadius);  // outer (CW)
        traceBadgeShape(renderCtx, cx, cy, innerRadius, sides, innerCorner);   // inner (CW)
        renderCtx.fillStyle = '#ffffff';
        renderCtx.fill('evenodd');
        renderCtx.restore();

        // 5. Thin metal accent line at inner edge
        strokeShape(renderCtx, cx, cy, innerRadius, sides, innerCorner, metal.base, size * 0.007);

        // 6. Badge name on ribbon — single line, centred on ribbon midpoint
        const textMaxWidth = innerRadius * 1.55;
        const fontSize     = fitSingleLine(renderCtx, name, textMaxWidth, size * 0.1, size * 0.038, '700');

        renderCtx.save();
        renderCtx.textAlign     = 'center';
        renderCtx.textBaseline  = 'middle';
        renderCtx.font          = `700 ${fontSize}px ${FONT_FAMILY}`;
        renderCtx.letterSpacing = '0.04em';
        renderCtx.fillStyle     = '#ffffff';
        renderCtx.fillText(name, cx, ribbonCenterY + fontSize * 0.06);
        renderCtx.letterSpacing = '0';
        renderCtx.restore();

        // 7. Year — below ribbon, on badge background
        const ribbonBottom = ribbonCenterY + ribbonHalfH;
        const bottomSpace  = (cy + innerRadius) - ribbonBottom;
        const yearY        = ribbonBottom + bottomSpace * 0.38;

        renderCtx.save();
        renderCtx.textAlign    = 'center';
        renderCtx.textBaseline = 'middle';
        renderCtx.font         = `700 ${size * 0.075}px ${FONT_FAMILY}`;
        renderCtx.fillStyle    = '#ffffff';
        renderCtx.fillText(year, cx, yearY);
        renderCtx.restore();
    }
});
