document.addEventListener('DOMContentLoaded', () => {
    const FONT_LOAD_DELAY_MS = 200;
    const COVER_CANVAS_SIZE = 1440;

    const SERIES_TITLE_Y = 250;
    const SERIES_TITLE_SIZE = 160;
    const EPISODE_TITLE_SIZE = 200;
    const COVER_EPISODE_TITLE_Y_OFFSET = 100;
    const EPISODE_TITLE_BOTTOM_MIN_GAP = 150;
    const EPISODE_TITLE_BOTTOM_EXTRA = 30;

    const SUNBURST_RAY_COUNT = 24;
    const SUNBURST_RADIUS_PADDING = 100;

    const STATE = {
        participants: [] // stores { id, name, imgObj, imgSrc }
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

    function slugifyEpisodeFilename(title) {
        return title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
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
        if (isCover) {
            drawText(
                renderCtx,
                balancedTitle,
                textAnchorX,
                height / 2 + COVER_EPISODE_TITLE_Y_OFFSET,
                EPISODE_TITLE_SIZE,
                '#ffea00',
                false,
                0,
                true,
                'left'
            );
        } else {
            drawText(
                renderCtx,
                balancedTitle,
                textAnchorX,
                height - Math.max(EPISODE_TITLE_BOTTOM_MIN_GAP, height / 8) - EPISODE_TITLE_BOTTOM_EXTRA,
                EPISODE_TITLE_SIZE,
                '#ffea00',
                false,
                0,
                true,
                'left'
            );
        }
    }

    function drawSunburst(ctx, width, height, baseColor, isCover = false) {
        ctx.save();
        const originX = isCover ? width / 2 : width / 6;
        const originY = height / 2;
        ctx.translate(originX, originY);

        const rays = SUNBURST_RAY_COUNT;
        const radius = Math.sqrt(width * width + height * height) + SUNBURST_RADIUS_PADDING;

        for (let i = 0; i < rays; i++) {
            const angle = (i * Math.PI * 2) / rays;
            const nextAngle = ((i + 1) * Math.PI * 2) / rays;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            ctx.lineTo(Math.cos(nextAngle) * radius, Math.sin(nextAngle) * radius);
            ctx.closePath();

            ctx.fillStyle = (i % 2 === 0) ? baseColor : lightenColor(baseColor, 40);
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

        const availableStackH = height - 2 * zonePadY - (n - 1) * gapY;
        const panelHeight = Math.min(maxPanelH, availableStackH / n);

        const stackH = n * panelHeight + (n - 1) * gapY;
        const startY = (height - stackH) / 2;

        activeParticipants.forEach((p, idx) => {
            const x = x0;
            const panelY = startY + idx * (panelHeight + gapY);

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

            const jauntyAngle = -0.18 + (idx % 2 === 0 ? 0 : 0.06);
            drawParticipantName(ctx, p.name, x + panelWidth / 2, panelY + 20, jauntyAngle);
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
