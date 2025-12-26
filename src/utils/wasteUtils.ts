// constants.ts or wasteUtils.ts

export const THEORETICAL_CONSTANTS: Record<string, number> = {
    'plastic': 0.04, 
    'can': 0.015,
    'paper': 0.1,
    'uco': 1.0
};

export const UCO_DEVICE_IDS = ['071582000007', '071582000009'];

export const getEvidencePhotos = (urlStr: string | null) => {
    if (!urlStr) return { before: '', after: '' };
    
    const parts = urlStr.split(',').map(p => p.trim());
    let before = parts[0] || '';
    let after = parts[1] || parts[0] || ''; 

    if (after.startsWith('http') && !before.startsWith('http')) {
        try {
            const domain = new URL(after).origin; 
            const path = before.startsWith('/') ? before : '/' + before;
            before = domain + path;
        } catch (e) {
            console.error("Invalid URL in evidence:", after);
        }
    }
    return { before, after };
};

export const detectWasteType = (rawName: string): string => {
    if (!rawName) return "Unknown";
    const n = rawName.toLowerCase();
    
    if (n.includes('paper') || n.includes('kertas') || n.includes('buku') || n.includes('book')) return 'Paper';
    if (n.includes('oil') || n.includes('minyak') || n.includes('uco')) return 'UCO';
    if (n.includes('plastic') || n.includes('plastik') || n.includes('bottle') || n.includes('can') || n.includes('aluminium') || n.includes('botol')) return 'Plastik / Aluminium';
    
    return rawName;
};