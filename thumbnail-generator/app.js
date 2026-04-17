document.addEventListener('DOMContentLoaded', () => {
    const STATE = {
        participants: [] // stores { id, name, imgObj, imgSrc }
    };

    // Check if fonts are loaded before generating
    document.fonts.ready.then(() => {
        console.log('Fonts loaded');
        // Give a slight delay to ensure 'Bangers' triggers appropriately on canvas
        setTimeout(() => renderCanvas(), 200);
    });

    const canvas = document.getElementById('thumbnail-canvas');
    const ctx = canvas.getContext('2d');

    // Inputs
    const seriesTitleInput = document.getElementById('seriesTitle');
    const episodeTitleInput = document.getElementById('episodeTitle');
    const episodeNumberInput = document.getElementById('episodeNumber');
    const themeColorInput = document.getElementById('themeColor');

    // Buttons
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const addParticipantBtn = document.getElementById('add-participant');

    // Form elements
    const participantsList = document.getElementById('participants-list');
    const participantTemplate = document.getElementById('participant-template');

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
            };
            img.src = initialImageUrl;
        }

        nameInput.addEventListener('input', (e) => {
            participantObj.name = e.target.value;
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
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        removeBtn.addEventListener('click', () => {
            STATE.participants = STATE.participants.filter(p => p.id !== id);
            row.remove();
        });

        participantsList.appendChild(clone);
    }

    // Add initial participant rows from defaults
    const defaultParticipants = [
        'Tony-Kelly.png',
        'Bob-Walker.jpeg',
        'Steve-Fenton.png'
    ];

    defaultParticipants.forEach(filename => {
        // Extract name and remove extension, replace hyphens with spaces
        const name = filename.replace(/\.[^/.]+$/, "").replace(/-/g, " ");
        createParticipantRow(name, `defaults/Participants/${filename}`);
    });

    addParticipantBtn.addEventListener('click', () => createParticipantRow());

    // Render Canvas
    generateBtn.addEventListener('click', () => {
        renderCanvas();
        downloadBtn.disabled = false;
    });

    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        const episodeFileName = episodeTitleInput.value.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        link.download = `${episodeFileName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    // ----------------------------------------------------
    // Canvas Drawing Logic - The Comic Book Zing 🚀
    // ----------------------------------------------------
    function renderCanvas() {
        const width = canvas.width;
        const height = canvas.height;
        const themeColor = themeColorInput.value;

        // 1. Clear background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);

        // 2. Draw Sunburst rays background (Comic style action lines)
        drawSunburst(width, height, themeColor);

        // 3. Draw Halftone pattern overlay
        drawHalftone(width, height);

        // 4. Draw Participants
        drawParticipants(width, height);

        // 5. Draw Episode Number inside a starburst
        drawEpisodeNumber(width, height, episodeNumberInput.value, themeColor);

        // 6. Draw Texts
        drawText(seriesTitleInput.value, width / 2, 250, 160, '#ffffff', true, -0.05); // Series Title
        
        // Wrap episode title onto balanced lines
        const balancedTitle = balanceText(episodeTitleInput.value);
        drawText(balancedTitle, width / 2, height - Math.max(150, height / 8) - 30, 200, '#ffea00', false, 0, true); // Episode Title
    }

    function drawSunburst(width, height, baseColor) {
        ctx.save();
        ctx.translate(width / 2, height / 2);

        const rays = 24;
        const radius = Math.sqrt(width * width + height * height) + 100; // reach corners

        // Create an alternating dark/light version of the theme color
        // Using raw HSL would be cleaner but let's interpolate simply
        for (let i = 0; i < rays; i++) {
            const angle = (i * Math.PI * 2) / rays;
            const nextAngle = ((i + 1) * Math.PI * 2) / rays;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            ctx.lineTo(Math.cos(nextAngle) * radius, Math.sin(nextAngle) * radius);
            ctx.closePath();

            // Alternate colors
            ctx.fillStyle = (i % 2 === 0) ? baseColor : lightenColor(baseColor, 40);
            ctx.fill();

            // Add thick comic borders between rays
            ctx.lineWidth = 12;
            ctx.strokeStyle = '#000000';
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawHalftone(width, height) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#000000';

        const spacing = 18;
        const radius = 6;
        for (let y = 0; y < height; y += spacing) {
            for (let x = 0; x < width; x += spacing) {
                // Shift every other row for hex-like pattern
                const shiftX = (y / spacing) % 2 === 0 ? 0 : spacing / 2;
                ctx.beginPath();
                ctx.arc(x + shiftX, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    function drawParticipants(width, height) {
        const activeParticipants = STATE.participants.filter(p => p.imgObj);
        if (activeParticipants.length === 0) return;

        ctx.save();

        // Settings based on number of participants
        const padding = 120;
        let panelsCount = activeParticipants.length;
        const panelWidth = (width - padding * (panelsCount + 1)) / panelsCount;
        // Keep them roughly vertically centered but shifted down slightly to make room for Title
        const panelY = height / 2 - 200;
        const panelHeight = 800;

        activeParticipants.forEach((p, idx) => {
            const x = padding + idx * (panelWidth + padding);

            // Draw a slightly rotated comic panel box
            ctx.save();
            ctx.translate(x + panelWidth / 2, panelY + panelHeight / 2);
            // Slight alternating rotation
            const rotate = (idx % 2 === 0) ? -0.04 : 0.04;
            ctx.rotate(rotate);
            ctx.translate(-(x + panelWidth / 2), -(panelY + panelHeight / 2));

            // Drop shadow for the panel
            ctx.fillStyle = '#000000';
            ctx.fillRect(x + 25, panelY + 25, panelWidth, panelHeight);

            // Panel background (white rim)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, panelY, panelWidth, panelHeight);
            ctx.lineWidth = 15;
            ctx.strokeStyle = '#000000';
            ctx.strokeRect(x, panelY, panelWidth, panelHeight);

            // Clip region for the image inside the border
            ctx.save();
            const innerMargin = 15;
            const irX = x + innerMargin;
            const irY = panelY + innerMargin;
            const irW = panelWidth - innerMargin * 2;
            const irH = panelHeight - innerMargin * 2;

            ctx.beginPath();
            ctx.rect(irX, irY, irW, irH);
            ctx.clip();

            // Draw participant image, scale to cover
            const imgRatio = p.imgObj.width / p.imgObj.height;
            const boxRatio = irW / irH;

            let drawW = irW;
            let drawH = irH;
            if (imgRatio > boxRatio) {
                // image is wider than box -> match height, crop width
                drawW = irH * imgRatio;
                drawH = irH;
            } else {
                drawW = irW;
                drawH = irW / imgRatio;
            }
            // center it
            const dx = irX + (irW - drawW) / 2;
            const dy = irY + (irH - drawH) / 2;

            // Cartoonize / Pop art effect
            ctx.filter = 'contrast(120%) saturate(120%) brightness(110%)';
            ctx.drawImage(p.imgObj, dx, dy, drawW, drawH);
            ctx.filter = 'none';

            // Optional half tone over the image to blend it into the comic style
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

            ctx.restore(); // remove clip
            ctx.restore(); // remove rotation

            // Draw Participant Name on the top-left of each image at a jaunty angle
            const jauntyAngle = -0.18 + (idx % 2 === 0 ? 0 : 0.06); // Alternate angle slightly
            drawParticipantName(p.name, x + 220, panelY + 20, jauntyAngle);
        });

        ctx.restore();
    }

    function drawParticipantName(name, x, y, rotation) {
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
        const boxPaddingH = 30;

        // Draw black shadow for box
        ctx.fillStyle = '#000';
        ctx.fillRect(-textWidth / 2 - boxPaddingW + 10, -50 + 10, textWidth + boxPaddingW * 2, 100);

        // Draw yellow box
        ctx.fillStyle = '#ffea00';
        ctx.fillRect(-textWidth / 2 - boxPaddingW, -50, textWidth + boxPaddingW * 2, 100);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000';
        ctx.strokeRect(-textWidth / 2 - boxPaddingW, -50, textWidth + boxPaddingW * 2, 100);

        // Draw text
        ctx.fillStyle = '#000000';
        ctx.fillText(name, 0, 5); // manual vertical alignment adjustment

        ctx.restore();
    }

    function drawEpisodeNumber(width, height, text, themeColor) {
        if (!text) return;

        ctx.save();

        const x = width - 300;
        const y = 220;

        ctx.translate(x, y);

        // Pulsing / jagged starburst shape
        const points = 16;
        const outerRadius = 190;
        const innerRadius = 110;

        // Shadow/Offset for starburst
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points;
            const px = Math.cos(angle) * radius + 20; // 20px shadow offset
            const py = Math.sin(angle) * radius + 20;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#000000';
        ctx.fill();

        // Main starburst
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            // slightly randomized radiuses for extra comic zing
            const rOffset = Math.random() * 20 - 10;
            const radius = (i % 2 === 0 ? outerRadius : innerRadius) + rOffset;
            const angle = (i * Math.PI) / points;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();

        // Use contrasting color (like yellow or cyan depending on theme, we'll hardcode yellow pop)
        ctx.fillStyle = '#ffea00';
        ctx.fill();
        ctx.lineWidth = 15;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // Text inside starburst
        ctx.font = '90px "Bangers", impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text Outline
        ctx.lineWidth = 16;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000';
        ctx.strokeText(text, 0, 10);

        // Text Fill
        ctx.fillStyle = '#ff2a2a'; // vibrant red text for contrast
        ctx.fillText(text, 0, 10);

        ctx.restore();
    }

    function drawText(textParam, x, y, fontSize, fillStyle, isRotated = false, rotationAngle = 0, is3D = false) {
        if (!textParam) return;

        const lines = Array.isArray(textParam) ? textParam : [textParam];

        ctx.save();
        ctx.translate(x, y);
        if (isRotated) {
            ctx.rotate(rotationAngle);
        }

        ctx.font = `${fontSize}px "Bangers", impact, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.lineJoin = 'round';

        const lineHeight = fontSize * 1.1;
        const startY = -((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, index) => {
            const lineY = startY + index * lineHeight;

            if (is3D) {
                // Extrude text effect
                const extrudeDist = 20;
                ctx.fillStyle = '#000000';
                for (let i = extrudeDist; i > 0; i--) {
                    ctx.fillText(line, i, i + lineY);
                }
            } else {
                // Drop shadow text
                ctx.lineWidth = fontSize * 0.15;
                ctx.strokeStyle = '#000000';
                ctx.strokeText(line, 15, 15 + lineY);
            }

            // Main Text Outline
            ctx.lineWidth = fontSize * 0.12; // Thick black outline
            ctx.strokeStyle = '#000000';
            ctx.strokeText(line, 0, lineY);

            // Main Text Fill
            ctx.fillStyle = fillStyle;
            ctx.fillText(line, 0, lineY);
        });

        ctx.restore();
    }

    // Helper to balance text into two lines
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

    // Helper to lighten hex color for the sunburst
    function lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16),
            amt = Math.round(2.55 * percent),
            R = (num >> 16) + amt,
            B = (num >> 8 & 0x00FF) + amt,
            G = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
    }
});
