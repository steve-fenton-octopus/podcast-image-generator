document.addEventListener('DOMContentLoaded', () => {
    const FONT_LOAD_DELAY_MS = 200;
    const COVER_CANVAS_SIZE = 1440;

    const SERIES_TITLE_Y = 250;
    const SERIES_TITLE_SIZE = 160;
    const EPISODE_TITLE_SIZE = 200;
    const SUNBURST_RAY_COUNT = 24;
    const SUNBURST_RADIUS_PADDING = 100;
    /** Opacity for alternating “in-between” rays (lighter wedges); primary rays stay opaque. */
    const SUNBURST_ALT_RAY_ALPHA = 0.55;
    const DEFAULT_BACKGROUND_SLIDE = 'defaults/Conference-Slide.png';

    const STATE = {
        participants: [], // stores { id, name, imgObj, imgSrc }
        backgroundSlide: null
    };

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
    const seriesTitleInput = document.getElementById('seriesTitle');
    const episodeTitleInput = document.getElementById('episodeTitle');
    const themeColorInput = document.getElementById('themeColor');

    // Buttons
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const downloadCoverBtn = document.getElementById('download-cover-btn');
    const addParticipantBtn = document.getElementById('add-participant');

    // Form elements
    const participantsList = document.getElementById('participants-list');
    const participantTemplate = document.getElementById('participant-template');
    const backgroundSlideInput = document.getElementById('backgroundSlide');
    const backgroundSlideFilename = document.getElementById('background-slide-filename');

    function slugifyEpisodeFilename(title) {
        return title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    }

    function hslFromRgb(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        let h = 0;
        let s = 0;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max - min);
            switch (max) {
                case r:
                    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                    break;
                case g:
                    h = ((b - r) / d + 2) / 6;
                    break;
                default:
                    h = ((r - g) / d + 4) / 6;
            }
        }
        return { h, s, l };
    }

    function hslToRgb(h, s, l) {
        h = ((h % 1) + 1) % 1;
        if (s <= 0) {
            const v = Math.round(l * 255);
            return { r: v, g: v, b: v };
        }
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = hue2rgb(p, q, h + 1 / 3);
        const g = hue2rgb(p, q, h);
        const b = hue2rgb(p, q, h - 1 / 3);
        return {
            r: Math.round(Math.min(255, Math.max(0, r * 255))),
            g: Math.round(Math.min(255, Math.max(0, g * 255))),
            b: Math.round(Math.min(255, Math.max(0, b * 255)))
        };
    }

    /**
     * Push averaged slide color toward comic-book saturation/lightness while keeping hue from the image.
     */
    function comicVividThemeRgb(tr, tg, tb, peakS, peakH) {
        const avg = hslFromRgb(tr, tg, tb);
        const hue = avg.s < 0.14 && peakS > 0.07 ? peakH : avg.h;
        const vividS = Math.min(0.98, Math.max(0.84, avg.s * 0.32 + 0.66));
        const vividL = Math.min(0.6, Math.max(0.5, 0.34 + avg.l * 0.26 + 0.12));
        return hslToRgb(hue, vividS, vividL);
    }

    function deriveThemeColorFromImage(img) {
        const sample = 48;
        const c = document.createElement('canvas');
        c.width = sample;
        c.height = sample;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0, sample, sample);
        const data = cx.getImageData(0, 0, sample, sample).data;

        let tw = 0;
        let tr = 0;
        let tg = 0;
        let tb = 0;
        let peakS = 0;
        let peakH = 0;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 35) continue;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const { h, s, l } = hslFromRgb(r, g, b);
            if (l >= 0.06 && l <= 0.97 && s > peakS) {
                peakS = s;
                peakH = h;
            }
            if (l < 0.06 || l > 0.97) continue;
            const lightPreference = 0.12 + 0.88 * l * l;
            const weight = s * s * lightPreference;
            tr += r * weight;
            tg += g * weight;
            tb += b * weight;
            tw += weight;
        }

        if (tw < 1e-6) {
            tr = tg = tb = 0;
            let fw = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 35) continue;
                const r0 = data[i];
                const g0 = data[i + 1];
                const b0 = data[i + 2];
                const { l: lum } = hslFromRgb(r0, g0, b0);
                if (lum < 0.06 || lum > 0.98) continue;
                const w = 0.12 + 0.88 * lum * lum;
                tr += r0 * w;
                tg += g0 * w;
                tb += b0 * w;
                fw += w;
            }
            if (fw < 1e-6) return '#e62e2e';
            tr /= fw;
            tg /= fw;
            tb /= fw;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 35) continue;
                const { h: hh, s: ss, l: ll } = hslFromRgb(data[i], data[i + 1], data[i + 2]);
                if (ll >= 0.06 && ll <= 0.98 && ss > peakS) {
                    peakS = ss;
                    peakH = hh;
                }
            }
        } else {
            tr /= tw;
            tg /= tw;
            tb /= tw;
        }

        const vivid = comicVividThemeRgb(tr, tg, tb, peakS, peakH);
        const clampCh = (x) => Math.max(16, Math.min(255, Math.round(x)));
        return `#${[vivid.r, vivid.g, vivid.b].map((x) => clampCh(x).toString(16).padStart(2, '0')).join('')}`;
    }

    function applyThemeColorFromBackground(img) {
        if (!img || !img.complete || !img.naturalWidth) return;
        themeColorInput.value = deriveThemeColorFromImage(img);
    }

    function createParticipantRow(initialName = '', initialImageUrl = null) {
        const id = Date.now().toString() + Math.random().toString();
        const clone = participantTemplate.content.cloneNode(true);
        const row = clone.querySelector('.participant-item');
        row.dataset.id = id;

        const nameInput = clone.querySelector('.participant-name');
        const fileInput = clone.querySelector('.participant-image-input');
        const fileNameDisplay = clone.querySelector('.file-name');
        const removeBtn = clone.querySelector('.btn-remove-participant');

        const participantObj = { id, name: initialName || 'Guest', imgObj: null, imgSrc: '' };
        STATE.participants.push(participantObj);

        if (initialName) {
            nameInput.value = initialName;
        }

        if (initialImageUrl) {
            const fileName = initialImageUrl.split('/').pop();
            fileNameDisplay.textContent = fileName;
            const img = new Image();
            img.onload = function () {
                participantObj.imgObj = img;
                participantObj.imgSrc = initialImageUrl;
                refreshPreview();
            };
            img.src = initialImageUrl;
        }

        nameInput.addEventListener('input', (e) => {
            participantObj.name = e.target.value;
            refreshPreview();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                fileNameDisplay.textContent = file.name;

                const reader = new FileReader();
                reader.onload = function (event) {
                    const img = new Image();
                    img.onload = function () {
                        participantObj.imgObj = img;
                        participantObj.imgSrc = event.target.result;
                        refreshPreview();
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        removeBtn.addEventListener('click', () => {
            STATE.participants = STATE.participants.filter(p => p.id !== id);
            row.remove();
            refreshPreview();
        });

        participantsList.appendChild(clone);
    }

    // Add initial participant rows from defaults
    const defaultParticipants = ['Steve-Fenton.jpg'];

    defaultParticipants.forEach(filename => {
        // Extract name and remove extension, replace hyphens with spaces
        const name = filename.replace(/\.[^/.]+$/, "").replace(/-/g, " ");
        createParticipantRow(name, `defaults/Participants/${filename}`);
    });

    function loadBackgroundSlideFromUrl(url, displayName) {
        const img = new Image();
        img.onload = function () {
            STATE.backgroundSlide = img;
            applyThemeColorFromBackground(img);
            if (displayName) {
                backgroundSlideFilename.textContent = displayName;
            }
            refreshPreview();
        };
        img.onerror = function () {
            STATE.backgroundSlide = null;
            if (displayName) {
                backgroundSlideFilename.textContent = displayName + ' (failed to load)';
            }
            refreshPreview();
        };
        img.src = url;
    }

    loadBackgroundSlideFromUrl(DEFAULT_BACKGROUND_SLIDE, 'Conference-Slide.png');

    backgroundSlideInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            backgroundSlideFilename.textContent = file.name;
            const reader = new FileReader();
            reader.onload = function (event) {
                const img = new Image();
                img.onload = function () {
                    STATE.backgroundSlide = img;
                    applyThemeColorFromBackground(img);
                    refreshPreview();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    addParticipantBtn.addEventListener('click', () => {
        createParticipantRow();
        refreshPreview();
    });

    seriesTitleInput.addEventListener('input', refreshPreview);
    episodeTitleInput.addEventListener('input', refreshPreview);
    themeColorInput.addEventListener('input', refreshPreview);

    // Render Canvas
    generateBtn.addEventListener('click', () => {
        refreshPreview();
        downloadBtn.disabled = false;
        downloadCoverBtn.disabled = false;
    });

    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        const episodeFileName = slugifyEpisodeFilename(episodeTitleInput.value);
        link.download = `${episodeFileName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    downloadCoverBtn.addEventListener('click', () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = COVER_CANVAS_SIZE;
        tempCanvas.height = COVER_CANVAS_SIZE;

        const coverCtx = tempCanvas.getContext('2d');
        renderCanvas(coverCtx, true);

        const link = document.createElement('a');
        const episodeFileName = slugifyEpisodeFilename(episodeTitleInput.value);
        link.download = `${episodeFileName}-cover.png`;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    });

    // ----------------------------------------------------
    // Canvas drawing
    // ----------------------------------------------------
    function renderCanvas(renderCtx, isCover = false) {
        const width = renderCtx.canvas.width;
        const height = renderCtx.canvas.height;
        const themeColor = themeColorInput.value;

        renderCtx.fillStyle = '#111';
        renderCtx.fillRect(0, 0, width, height);

        drawBackgroundSlide(renderCtx, width, height);
        drawSunburst(renderCtx, width, height, themeColor, isCover);
        drawHalftone(renderCtx, width, height);

        if (!isCover) {
            drawParticipants(renderCtx, width, height);
        }

        const textZoneLeft = width / 3;
        const textInset = Math.max(56, width * 0.028);
        const textAnchorX = textZoneLeft + textInset;

        drawText(renderCtx, seriesTitleInput.value, textAnchorX, SERIES_TITLE_Y, SERIES_TITLE_SIZE, '#ffffff', true, -0.05, false, 'left');

        const balancedTitle = balanceText(episodeTitleInput.value);
        const talkTitleY = height / 2;
        drawText(
            renderCtx,
            balancedTitle,
            textAnchorX,
            talkTitleY,
            EPISODE_TITLE_SIZE,
            '#ffea00',
            false,
            0,
            true,
            'left'
        );
    }

    function drawBackgroundSlide(ctx, width, height) {
        const img = STATE.backgroundSlide;
        if (!img || !img.complete || !img.naturalWidth) return;

        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const scale = Math.max(width / iw, height / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (width - dw) / 2;
        const dy = (height - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
    }

    function drawSunburst(ctx, width, height, baseColor, isCover = false) {
        ctx.save();
        const originX = isCover ? width / 2 : width / 6;
        const originY = height / 2;
        ctx.translate(originX, originY);

        const rays = SUNBURST_RAY_COUNT;
        const radius = Math.sqrt(width * width + height * height) + SUNBURST_RADIUS_PADDING;

        for (let i = 0; i < rays; i++) {
            const isPrimaryRay = i % 2 === 0;
            ctx.globalAlpha = isPrimaryRay ? 1 : SUNBURST_ALT_RAY_ALPHA;

            const angle = (i * Math.PI * 2) / rays;
            const nextAngle = ((i + 1) * Math.PI * 2) / rays;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            ctx.lineTo(Math.cos(nextAngle) * radius, Math.sin(nextAngle) * radius);
            ctx.closePath();

            ctx.fillStyle = isPrimaryRay ? baseColor : lightenColor(baseColor, 40);
            ctx.fill();

            ctx.lineWidth = 12;
            ctx.strokeStyle = '#000000';
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawHalftone(ctx, width, height) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#000000';

        const spacing = 18;
        const dotRadius = 6;
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

    function drawParticipants(ctx, width, height) {
        const activeParticipants = STATE.participants.filter(p => p.imgObj);
        if (activeParticipants.length === 0) return;

        ctx.save();

        const n = activeParticipants.length;
        const leftZoneW = width / 3;
        const zonePadX = Math.max(80, width * 0.04);
        const zonePadY = Math.max(72, height * 0.065);
        const panelWidth = Math.max(200, leftZoneW - 2 * zonePadX);
        const x0 = zonePadX;
        const gapY = 44;
        const maxPanelH = 800;
        /** Gap from panel bottom edge to name badge (must match visual in drawParticipantName). */
        const nameLabelGap = 10;
        const nameBadgeHeight = 100;
        const nameBelowReserve = nameLabelGap + nameBadgeHeight;

        const availableForPanels =
            height - 2 * zonePadY - n * nameBelowReserve - (n - 1) * gapY;
        const panelHeight = Math.min(maxPanelH, Math.max(140, availableForPanels / n));

        const stackH = n * panelHeight + n * nameBelowReserve + (n - 1) * gapY;
        const startY = (height - stackH) / 2;

        activeParticipants.forEach((p, idx) => {
            const x = x0;
            const panelY = startY + idx * (panelHeight + nameBelowReserve + gapY);

            ctx.save();
            ctx.translate(x + panelWidth / 2, panelY + panelHeight / 2);
            const rotate = (idx % 2 === 0) ? -0.04 : 0.04;
            ctx.rotate(rotate);
            ctx.translate(-(x + panelWidth / 2), -(panelY + panelHeight / 2));

            ctx.fillStyle = '#000000';
            ctx.fillRect(x + 25, panelY + 25, panelWidth, panelHeight);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, panelY, panelWidth, panelHeight);
            ctx.lineWidth = 15;
            ctx.strokeStyle = '#000000';
            ctx.strokeRect(x, panelY, panelWidth, panelHeight);

            ctx.save();
            const innerMargin = 15;
            const irX = x + innerMargin;
            const irY = panelY + innerMargin;
            const irW = panelWidth - innerMargin * 2;
            const irH = panelHeight - innerMargin * 2;

            ctx.beginPath();
            ctx.rect(irX, irY, irW, irH);
            ctx.clip();

            const imgRatio = p.imgObj.width / p.imgObj.height;
            const boxRatio = irW / irH;

            let drawW = irW;
            let drawH = irH;
            if (imgRatio > boxRatio) {
                drawW = irH * imgRatio;
                drawH = irH;
            } else {
                drawW = irW;
                drawH = irW / imgRatio;
            }
            const dx = irX + (irW - drawW) / 2;
            const dy = irY + (irH - drawH) / 2;

            ctx.filter = 'contrast(120%) saturate(120%) brightness(110%)';
            ctx.drawImage(p.imgObj, dx, dy, drawW, drawH);
            ctx.filter = 'none';

            const hSpacing = 12;
            const hRadius = 4;
            ctx.save();
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = '#000';
            for (let hy = Math.floor(irY / hSpacing) * hSpacing; hy < irY + irH + hSpacing; hy += hSpacing) {
                for (let hx = Math.floor(irX / hSpacing) * hSpacing; hx < irX + irW + hSpacing; hx += hSpacing) {
                    const shiftX = Math.floor(hy / hSpacing) % 2 === 0 ? 0 : hSpacing / 2;
                    ctx.beginPath();
                    ctx.arc(hx + shiftX, hy, hRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();

            ctx.restore();
            ctx.restore();

            const nameCenterY = panelY + panelHeight + nameLabelGap + nameBadgeHeight / 2;
            const jauntyAngle = -0.1 + (idx % 2 === 0 ? 0 : 0.05);
            drawParticipantName(ctx, p.name, x + panelWidth / 2, nameCenterY, jauntyAngle);
        });

        ctx.restore();
    }

    function drawParticipantName(ctx, name, x, y, rotation) {
        if (!name.trim()) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        ctx.font = '80px "Bangers", impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metrics = ctx.measureText(name);
        const textWidth = metrics.width;
        const boxPaddingW = 50;

        ctx.fillStyle = '#000';
        ctx.fillRect(-textWidth / 2 - boxPaddingW + 10, -50 + 10, textWidth + boxPaddingW * 2, 100);

        ctx.fillStyle = '#ffea00';
        ctx.fillRect(-textWidth / 2 - boxPaddingW, -50, textWidth + boxPaddingW * 2, 100);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000';
        ctx.strokeRect(-textWidth / 2 - boxPaddingW, -50, textWidth + boxPaddingW * 2, 100);

        ctx.fillStyle = '#000000';
        ctx.fillText(name, 0, 5);

        ctx.restore();
    }

    function drawText(ctx, textParam, x, y, fontSize, fillStyle, isRotated = false, rotationAngle = 0, is3D = false, textAlign = 'center') {
        if (!textParam) return;

        const lines = Array.isArray(textParam) ? textParam : [textParam];

        ctx.save();
        ctx.translate(x, y);
        if (isRotated) {
            ctx.rotate(rotationAngle);
        }

        ctx.font = `${fontSize}px "Bangers", impact, sans-serif`;
        ctx.textAlign = textAlign;
        ctx.textBaseline = 'middle';

        ctx.lineJoin = 'round';

        const lineHeight = fontSize * 1.1;
        const startY = -((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, index) => {
            const lineY = startY + index * lineHeight;

            if (is3D) {
                const extrudeDist = 20;
                ctx.fillStyle = '#000000';
                for (let i = extrudeDist; i > 0; i--) {
                    ctx.fillText(line, i, i + lineY);
                }
            } else {
                ctx.lineWidth = fontSize * 0.15;
                ctx.strokeStyle = '#000000';
                ctx.strokeText(line, 15, 15 + lineY);
            }

            ctx.lineWidth = fontSize * 0.12;
            ctx.strokeStyle = '#000000';
            ctx.strokeText(line, 0, lineY);

            ctx.fillStyle = fillStyle;
            ctx.fillText(line, 0, lineY);
        });

        ctx.restore();
    }

    function balanceText(text) {
        if (!text) return [""];
        const words = text.split(' ');
        if (words.length <= 1) return [text];

        let bestDiff = Infinity;
        let bestSplit = 1;

        for (let i = 1; i < words.length; i++) {
            const line1 = words.slice(0, i).join(' ');
            const line2 = words.slice(i).join(' ');
            const diff = Math.abs(line1.length - line2.length);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestSplit = i;
            }
        }

        return [
            words.slice(0, bestSplit).join(' '),
            words.slice(bestSplit).join(' ')
        ];
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
