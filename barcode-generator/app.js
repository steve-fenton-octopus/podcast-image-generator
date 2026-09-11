document.addEventListener('DOMContentLoaded', () => {
    // EAN-13 / ISBN-13 Encoding Tables
    const PARITY_MAP = [
        'LLLLLL', // 0
        'LLGLGG', // 1
        'LLGGLG', // 2
        'LLGGGL', // 3
        'LGLLGG', // 4
        'LGGLLG', // 5
        'LGGGLL', // 6
        'LGLGLG', // 7
        'LGLGGL', // 8
        'LGGLGL'  // 9
    ];

    const L_CODES = [
        '0001101', '0011001', '0010011', '0111101', '0100011',
        '0110001', '0101111', '0111011', '0110111', '0001011'
    ];

    const G_CODES = [
        '0100111', '0110011', '0011011', '0100001', '0011101',
        '0111001', '0000101', '0010001', '0001001', '0010111'
    ];

    const R_CODES = [
        '1110010', '1100110', '1101100', '1000010', '1011100',
        '1001110', '1010000', '1000100', '1001000', '1110100'
    ];

    // DOM Elements
    const canvas = document.getElementById('barcode-canvas');
    const ctx = canvas.getContext('2d');

    const isbnInput = document.getElementById('isbnInput');
    const bgColorInput = document.getElementById('bgColor');
    const barColorInput = document.getElementById('barColor');
    const showTextInput = document.getElementById('showText');
    const barHeightScaleInput = document.getElementById('barHeightScale');
    const validationMessage = document.getElementById('validation-message');

    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');

    let renderScheduled = false;

    function requestRender() {
        if (renderScheduled) return;
        renderScheduled = true;
        requestAnimationFrame(() => {
            renderScheduled = false;
            renderBarcode();
        });
    }

    document.fonts.ready.then(() => {
        requestRender();
    });

    // Strip hyphens and whitespace to get digits
    function getCleanISBN(rawInput) {
        return rawInput.replace(/[\s-]/g, '');
    }

    // Validate ISBN-13
    function validateISBN(rawInput) {
        const clean = getCleanISBN(rawInput);
        if (!clean) {
            return { valid: false, message: 'Please enter an ISBN-13 number.' };
        }
        if (!/^\d+$/.test(clean)) {
            return { valid: false, message: 'ISBN should contain numbers and hyphens only.' };
        }
        if (clean.length !== 13) {
            return { valid: false, message: `ISBN-13 must be 13 digits (currently ${clean.length} digits).` };
        }

        // Calculate expected check digit
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(clean[i], 10);
            sum += (i % 2 === 0) ? digit : digit * 3;
        }
        const expectedCheckDigit = (10 - (sum % 10)) % 10;
        const actualCheckDigit = parseInt(clean[12], 10);

        if (actualCheckDigit !== expectedCheckDigit) {
            return { valid: true, warning: true, message: `Valid length (13 digits), but checksum digit is ${actualCheckDigit} (expected ${expectedCheckDigit}).` };
        }

        return { valid: true, message: 'Valid ISBN-13 number' };
    }

    function updateValidationState() {
        const rawInput = isbnInput.value.trim();
        const status = validateISBN(rawInput);

        if (!status.valid) {
            isbnInput.classList.add('invalid');
            validationMessage.textContent = status.message;
            validationMessage.className = 'validation-message error';
            downloadBtn.disabled = true;
        } else if (status.warning) {
            isbnInput.classList.remove('invalid');
            validationMessage.textContent = status.message;
            validationMessage.className = 'validation-message warning';
            downloadBtn.disabled = false;
        } else {
            isbnInput.classList.remove('invalid');
            validationMessage.textContent = status.message;
            validationMessage.className = 'validation-message valid';
            downloadBtn.disabled = false;
        }

        requestRender();
    }

    // Event Listeners
    isbnInput.addEventListener('input', updateValidationState);
    bgColorInput.addEventListener('input', requestRender);
    barColorInput.addEventListener('input', requestRender);
    showTextInput.addEventListener('change', requestRender);
    barHeightScaleInput.addEventListener('change', requestRender);

    generateBtn.addEventListener('click', () => {
        updateValidationState();
        requestRender();
    });

    // Download handler - filename MUST be exact raw input entered by user
    downloadBtn.addEventListener('click', () => {
        const rawInput = isbnInput.value.trim();
        if (!rawInput) return;

        const filename = `${rawInput}.png`;
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    // Main Canvas Render Loop
    function renderBarcode() {
        const width = canvas.width;
        const height = canvas.height;
        const bgColor = bgColorInput.value;
        const barColor = barColorInput.value;
        const showText = showTextInput.value === 'true';
        const barHeightPreset = barHeightScaleInput.value;
        const rawInput = isbnInput.value.trim();
        const cleanISBN = getCleanISBN(rawInput);

        // Fill background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);

        // If ISBN is invalid (not 13 digits), display friendly error box on canvas
        if (!cleanISBN || cleanISBN.length !== 13 || !/^\d{13}$/.test(cleanISBN)) {
            ctx.save();
            ctx.fillStyle = '#ef4444';
            ctx.font = '600 44px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Please enter a valid 13-digit ISBN', width / 2, height / 2);
            ctx.restore();
            return;
        }

        // Construct EAN-13 Bit Map
        // Structure:
        // First digit: cleanISBN[0]
        // Left 6: cleanISBN[1..6]
        // Right 6: cleanISBN[7..12]
        const firstDigit = parseInt(cleanISBN[0], 10);
        const leftDigits = cleanISBN.slice(1, 7);
        const rightDigits = cleanISBN.slice(7, 13);
        const parityPattern = PARITY_MAP[firstDigit];

        // Modules array: items of { isBar: boolean, isGuard: boolean }
        const modules = [];

        // Start guard: 101
        modules.push({ bit: 1, isGuard: true });
        modules.push({ bit: 0, isGuard: true });
        modules.push({ bit: 1, isGuard: true });

        // Left 6 digits
        for (let i = 0; i < 6; i++) {
            const digit = parseInt(leftDigits[i], 10);
            const codeType = parityPattern[i]; // 'L' or 'G'
            const codeBits = (codeType === 'L') ? L_CODES[digit] : G_CODES[digit];
            for (let b = 0; b < 7; b++) {
                modules.push({ bit: parseInt(codeBits[b], 10), isGuard: false });
            }
        }

        // Center guard: 01010
        modules.push({ bit: 0, isGuard: true });
        modules.push({ bit: 1, isGuard: true });
        modules.push({ bit: 0, isGuard: true });
        modules.push({ bit: 1, isGuard: true });
        modules.push({ bit: 0, isGuard: true });

        // Right 6 digits
        for (let i = 0; i < 6; i++) {
            const digit = parseInt(rightDigits[i], 10);
            const codeBits = R_CODES[digit];
            for (let b = 0; b < 7; b++) {
                modules.push({ bit: parseInt(codeBits[b], 10), isGuard: false });
            }
        }

        // End guard: 101
        modules.push({ bit: 1, isGuard: true });
        modules.push({ bit: 0, isGuard: true });
        modules.push({ bit: 1, isGuard: true });

        // Calculate dimensions
        // Total modules = 95
        const totalModules = modules.length;
        const quietZoneModules = 10; // Quiet zone
        const totalUnits = totalModules + (quietZoneModules * 2);

        // Compute module width to fit nicely on canvas
        const availableWidth = width * 0.82;
        const moduleWidth = availableWidth / totalUnits;
        const barcodeWidth = totalUnits * moduleWidth;
        const startX = (width - barcodeWidth) / 2 + (quietZoneModules * moduleWidth);

        // Height calculations
        let barHeight = 350;
        if (barHeightPreset === 'compact') barHeight = 250;
        if (barHeightPreset === 'tall') barHeight = 420;

        const guardExtension = showText ? 45 : 0;
        const dataBarHeight = barHeight;
        const guardBarHeight = barHeight + guardExtension;
        const totalContentHeight = guardBarHeight + (showText ? 45 : 0);
        const startY = (height - totalContentHeight) / 2;

        // Draw Barcode Bars
        ctx.fillStyle = barColor;

        let currentX = startX;
        for (let i = 0; i < totalModules; i++) {
            const mod = modules[i];
            if (mod.bit === 1) {
                const currentBarHeight = mod.isGuard ? guardBarHeight : dataBarHeight;
                ctx.fillRect(currentX, startY, moduleWidth + 0.3, currentBarHeight);
            }
            currentX += moduleWidth;
        }

        // Draw Digits / Human Readable Text
        if (showText) {
            ctx.save();
            ctx.fillStyle = barColor;
            ctx.font = '700 60px "Roboto Mono", "Courier New", monospace';
            ctx.textBaseline = 'top';

            const textY = startY + dataBarHeight + 12;

            // First digit (outside start guard)
            ctx.textAlign = 'right';
            const firstDigitX = startX - (moduleWidth * 3);
            ctx.fillText(cleanISBN[0], firstDigitX, textY);

            // Left 6 digits group (between start and center guards)
            ctx.textAlign = 'center';
            const leftBlockStartX = startX + (3 * moduleWidth);
            const leftBlockWidth = 42 * moduleWidth;
            const leftBlockCenterX = leftBlockStartX + (leftBlockWidth / 2);
            ctx.fillText(cleanISBN.slice(1, 7), leftBlockCenterX, textY);

            // Right 6 digits group (between center and end guards)
            const rightBlockStartX = startX + ((3 + 42 + 5) * moduleWidth);
            const rightBlockWidth = 42 * moduleWidth;
            const rightBlockCenterX = rightBlockStartX + (rightBlockWidth / 2);
            ctx.fillText(cleanISBN.slice(7, 13), rightBlockCenterX, textY);

            ctx.restore();
        }
    }

    // Initial validation and setup
    updateValidationState();
});
