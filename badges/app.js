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
    const badgeIconInput    = document.getElementById('badgeIcon');
    const badgeIcon2Input   = document.getElementById('badgeIcon2');
    const badgeYearInput    = document.getElementById('badgeYear');
    const ribbonTailsInput  = document.getElementById('ribbonTails');
    const badgeSidesInput   = document.getElementById('badgeSides');
    const highlightColorInput = document.getElementById('highlightColor');
    const metalInputs       = document.querySelectorAll('input[name="badgeMetal"]');
    const metalBorderInput  = document.getElementById('metalBorder');
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
    badgeIconInput.addEventListener('input', refreshPreview);
    badgeIcon2Input.addEventListener('input', refreshPreview);
    badgeYearInput.addEventListener('input', refreshPreview);
    ribbonTailsInput.addEventListener('change', refreshPreview);
    badgeSidesInput.addEventListener('change', refreshPreview);
    highlightColorInput.addEventListener('input', refreshPreview);
    metalInputs.forEach((input) => input.addEventListener('change', refreshPreview));
    metalBorderInput.addEventListener('change', refreshPreview);
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
     * Traces a circular tag — a circle with the top-left quadrant squared off to the
     * bounding-box corner (common digital certification badge format).
     */
    function traceCircularTag(renderCtx, cx, cy, radius) {
        renderCtx.moveTo(cx - radius, cy);
        renderCtx.lineTo(cx - radius, cy - radius);
        renderCtx.lineTo(cx, cy - radius);
        renderCtx.arc(cx, cy, radius, -Math.PI / 2, Math.PI, false);
        renderCtx.closePath();
    }

    function fillCircularTag(renderCtx, cx, cy, radius, fillStyle) {
        renderCtx.save();
        renderCtx.beginPath();
        traceCircularTag(renderCtx, cx, cy, radius);
        renderCtx.fillStyle = fillStyle;
        renderCtx.fill();
        renderCtx.restore();
    }

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

    function mixWithWhite(hex, amount) {
        const n = parseInt(hex.slice(1), 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        const mix = (c) => Math.round(c + (255 - c) * amount);
        return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
    }

    function fillBorderRing(renderCtx, cx, cy, outerRadius, innerRadius, sides, outerCorner, innerCorner, metal, useMetalGradient) {
        renderCtx.save();
        renderCtx.beginPath();
        traceBadgeShape(renderCtx, cx, cy, outerRadius, sides, outerCorner);
        traceBadgeShape(renderCtx, cx, cy, innerRadius, sides, innerCorner);

        if (useMetalGradient) {
            const gradient = renderCtx.createLinearGradient(
                cx - outerRadius, cy - outerRadius,
                cx + outerRadius, cy + outerRadius
            );
            gradient.addColorStop(0, mixWithWhite(metal.light, 0.55));
            gradient.addColorStop(0.35, metal.light);
            gradient.addColorStop(0.65, metal.base);
            gradient.addColorStop(1, metal.dark);
            renderCtx.fillStyle = gradient;
        } else {
            renderCtx.fillStyle = '#ffffff';
        }

        renderCtx.fill('evenodd');
        renderCtx.restore();
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

    /** Width/height of the offscreen canvas used by drawWhiteIcon. */
    function iconCanvasSize(fontSize) {
        const pad = fontSize * 0.2;
        return fontSize * 1.4 + pad * 2;
    }

    /** Relative scale per icon — centre largest, tapering toward the edges. */
    function badgeIconScales(count) {
        const large = 1.28;
        const small = 0.86;
        const smallest = 0.58;

        switch (count) {
            case 1: return [large];
            case 2: return [small, small];
            case 3: return [small, large, small];
            case 4: return [smallest, small, small, smallest];
            case 5: return [smallest, small, large, small, smallest];
            default: return [large];
        }
    }

    function badgeIconRowWidth(layout) {
        const iconsWidth = layout.canvasSizes.reduce((sum, w) => sum + w, 0);
        return iconsWidth + layout.gap * (layout.canvasSizes.length - 1);
    }

    /** Computes final font sizes and pixel dimensions for a badge icon row. */
    function layoutBadgeIconRow(icons, baseFontSize, maxRowWidth) {
        const scales = badgeIconScales(icons.length);
        const gapRatio = 0.02;
        let fontSize = baseFontSize;

        const build = (size) => {
            const gap = size * gapRatio;
            const sizes = scales.map((scale) => size * scale);
            const canvasSizes = sizes.map(iconCanvasSize);
            return { scales, fontSize: size, sizes, canvasSizes, gap, rowHeight: Math.max(...canvasSizes) };
        };

        let layout = build(fontSize);
        const rowWidth = badgeIconRowWidth(layout);
        if (rowWidth > maxRowWidth) {
            fontSize *= maxRowWidth / rowWidth;
            layout = build(fontSize);
        }

        return layout;
    }

    /** Draws up to five badge icons in a centred row with tiered sizes. */
    function drawBadgeIconRow(renderCtx, icons, cx, centerY, layout) {
        const totalWidth = badgeIconRowWidth(layout);
        let x = cx - totalWidth / 2;

        for (let i = 0; i < icons.length; i++) {
            drawWhiteIcon(renderCtx, icons[i], x + layout.canvasSizes[i] / 2, centerY, layout.sizes[i]);
            x += layout.canvasSizes[i] + layout.gap;
        }
    }

    /** Renders a single emoji/glyph in white via offscreen flood-fill. */
    function drawWhiteIcon(renderCtx, icon, centerX, centerY, fontSize) {
        const canvasSize = iconCanvasSize(fontSize);
        const off = document.createElement('canvas');
        off.width  = canvasSize;
        off.height = canvasSize;
        const offCtx = off.getContext('2d');

        offCtx.font         = `${fontSize}px sans-serif`;
        offCtx.textAlign    = 'center';
        offCtx.textBaseline = 'middle';
        offCtx.fillText(icon, off.width / 2, off.height / 2);

        offCtx.globalCompositeOperation = 'source-in';
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, off.width, off.height);

        renderCtx.drawImage(off, centerX - canvasSize / 2, centerY - canvasSize / 2);
    }

    // ─── Ribbon ──────────────────────────────────────────────────────────────────

    /**
     * Draws the full ribbon shape (body + swallowtail ends) as the background layer.
     * The foreground body will be painted on top of the centre, so only the tails
     * remain visible — but having the full shape here makes vertical offsetting easy.
     */
    function drawRibbonBackground(renderCtx, cx, centerY, halfH, bodyHW, tailLen, color) {
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

    /**
     * Draws only the ribbon body — the foreground face that sits in front of the
     * badge ring, clipped to the inner badge area.
     */
    function drawRibbonBody(renderCtx, cx, cy, centerY, halfH, innerRadius, sides, innerCorner, color) {
        const y1 = centerY - halfH;

        renderCtx.save();
        clipToShape(renderCtx, cx, cy, innerRadius, sides, innerCorner);
        renderCtx.fillStyle = color;
        renderCtx.fillRect(0, y1, renderCtx.canvas.width, halfH * 2);
        renderCtx.restore();
    }

    // ─── Render ──────────────────────────────────────────────────────────────────

    function renderCanvas(renderCtx) {
        const size  = renderCtx.canvas.width;
        const cx    = size / 2;
        const cy    = size / 2;

        const shapeValue   = badgeSidesInput.value;
        const isCircularTag = shapeValue === 'tag';
        const sides        = isCircularTag ? 1 : (parseInt(shapeValue, 10) || 6);
        const metal     = METAL_COLORS[getSelectedMetal()];
        const highlight = highlightColorInput.value;
        const name       = (badgeNameInput.value.trim() || 'Badge').toUpperCase();
        const tagIcon     = badgeIconInput.value.trim();
        const badgeIcons  = [...badgeIcon2Input.value.trim()].slice(0, 5);
        const footerText  = badgeYearInput.value.trim();

        renderCtx.clearRect(0, 0, size, size);

        const outerRadius  = size * 0.43;
        const cornerRadius = sides <= 1 ? 0 : outerRadius * 0.18;
        const borderWidth  = size * 0.044;
        const innerRadius  = outerRadius - borderWidth;
        const innerCorner  = sides <= 1 ? 0 : innerRadius * 0.18;
        // Outer tag flange matches the white border ring thickness.
        const tagRadius    = outerRadius + borderWidth;

        const ribbonCenterY = cy + innerRadius * 0.1;
        const ribbonHalfH   = innerRadius * 0.21;
        const tailLen       = size * 0.04;

        // 1. Background ribbon — behind the badge; only the tails remain visible
        if (ribbonTailsInput.checked) {
            const bgHalfH   = ribbonHalfH * 0.9;
            const bgCenterY = ribbonCenterY + (bgHalfH * 0.5);
            drawRibbonBackground(renderCtx, cx, bgCenterY, bgHalfH, outerRadius, tailLen, metal.base);
        }

        // 2. Drop shadow behind badge
        renderCtx.save();
        renderCtx.shadowColor   = 'rgba(0,0,0,0.30)';
        renderCtx.shadowBlur    = size * 0.06;
        renderCtx.shadowOffsetY = size * 0.022;
        if (isCircularTag) {
            fillCircularTag(renderCtx, cx, cy, tagRadius, highlight);
        } else {
            fillShape(renderCtx, cx, cy, outerRadius, sides, cornerRadius, highlight);
        }
        renderCtx.restore();

        // 3. Badge body — flat highlight fill
        if (isCircularTag) {
            fillCircularTag(renderCtx, cx, cy, tagRadius, highlight);
            fillShape(renderCtx, cx, cy, outerRadius, sides, cornerRadius, highlight);
        } else {
            fillShape(renderCtx, cx, cy, outerRadius, sides, cornerRadius, highlight);
        }

        // 4. Border ring — white, or radial metal gradient when enabled
        fillBorderRing(renderCtx, cx, cy, outerRadius, innerRadius, sides, cornerRadius, innerCorner, metal, metalBorderInput.checked);

        // 5. Thin metal accent line at inner edge
        strokeShape(renderCtx, cx, cy, innerRadius, sides, innerCorner, metal.base, size * 0.007);

        // 6. Foreground ribbon body — on top of the white ring, clipped to inner area
        drawRibbonBody(renderCtx, cx, cy, ribbonCenterY, ribbonHalfH, innerRadius, sides, innerCorner, metal.base);

        // 7. Badge icons — up to five in a row above the ribbon, centre largest
        const ribbonTop    = ribbonCenterY - ribbonHalfH;
        const ribbonBottom = ribbonCenterY + ribbonHalfH;
        const bottomSpace  = (cy + innerRadius) - ribbonBottom;
        const gapOffset    = bottomSpace * 0.38;

        if (badgeIcons.length) {
            const aboveTop       = cy - innerRadius;
            const rowBottom      = ribbonTop - gapOffset;
            const availableHeight = rowBottom - aboveTop;
            const maxRowWidth    = innerRadius * 1.45;
            let baseFontSize     = Math.min(availableHeight / 1.8, innerRadius * 0.54);

            let layout = layoutBadgeIconRow(badgeIcons, baseFontSize, maxRowWidth);
            if (layout.rowHeight > availableHeight) {
                baseFontSize *= availableHeight / layout.rowHeight;
                layout = layoutBadgeIconRow(badgeIcons, baseFontSize, maxRowWidth);
            }

            const iconY = rowBottom - layout.rowHeight / 2 + 80;
            drawBadgeIconRow(renderCtx, badgeIcons, cx, iconY, layout);
        }

        // 8. Tag icon — top-left squared corner, outside the white border ring
        if (isCircularTag && tagIcon) {
            const tagFlange    = tagRadius - outerRadius;
            const tagIconSize  = tagFlange * 2.3;
            const tagIconCanvas = iconCanvasSize(tagIconSize);
            const cornerX      = cx - tagRadius + tagFlange + tagIconCanvas / 2;
            const cornerY      = cy - tagRadius + tagFlange + tagIconCanvas / 2;
            drawWhiteIcon(renderCtx, tagIcon, cornerX, cornerY, tagIconSize);
        }

        // 9. Badge name on ribbon — single line, centred on ribbon midpoint
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

        // 10. Footer text — below ribbon, on badge background (optional)
        if (footerText) {
            const footerY = ribbonBottom + gapOffset;
            const footerMaxWidth = innerRadius * 1.35;
            const footerFontSize = fitSingleLine(renderCtx, footerText, footerMaxWidth, size * 0.075, size * 0.04, '700');

            renderCtx.save();
            renderCtx.textAlign    = 'center';
            renderCtx.textBaseline = 'middle';
            renderCtx.font         = `700 ${footerFontSize}px ${FONT_FAMILY}`;
            renderCtx.fillStyle    = '#ffffff';
            renderCtx.fillText(footerText, cx, footerY);
            renderCtx.restore();
        }
    }
});
