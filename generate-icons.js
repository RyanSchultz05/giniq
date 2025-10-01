const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background gradient (simulated with solid color)
    ctx.fillStyle = '#6C63FF';
    ctx.fillRect(0, 0, size, size);

    // Draw bottle shape
    ctx.fillStyle = '#ffffff';

    const bottleWidth = size * 0.25;
    const bottleHeight = size * 0.6;
    const x = (size - bottleWidth) / 2;
    const y = size * 0.2;

    // Bottle neck
    const neckWidth = bottleWidth * 0.4;
    const neckHeight = bottleHeight * 0.2;
    const neckX = x + (bottleWidth - neckWidth) / 2;

    ctx.fillRect(neckX, y, neckWidth, neckHeight);

    // Bottle body
    ctx.beginPath();
    ctx.roundRect(x, y + neckHeight, bottleWidth, bottleHeight - neckHeight, size * 0.02);
    ctx.fill();

    // Add "G" text
    ctx.fillStyle = '#6C63FF';
    ctx.font = `bold ${size * 0.3}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('G', size / 2, y + neckHeight + (bottleHeight - neckHeight) / 2);

    return canvas;
}

// Generate 192x192
const canvas192 = createIcon(192);
const buffer192 = canvas192.toBuffer('image/png');
fs.writeFileSync('icon-192.png', buffer192);
console.log('✓ Created icon-192.png');

// Generate 512x512
const canvas512 = createIcon(512);
const buffer512 = canvas512.toBuffer('image/png');
fs.writeFileSync('icon-512.png', buffer512);
console.log('✓ Created icon-512.png');

console.log('\nIcons generated successfully!');
