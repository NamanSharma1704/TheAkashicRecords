import { getProxiedImageUrl } from '../../utils/api';

/** What a Hunter Card shows. Built by the profile from the live library. */
export interface HunterCardData {
    username: string;
    rank: string;
    /** The equipped title's name, if one is worn. */
    title: string | null;
    exp: number;
    next: { label: string; minExp: number } | null;
    /** 0..1 toward the next rank. */
    progress: number;
    series: number;
    conquered: number;
    chapters: number;
    titlesEarned: number;
    titlesTotal: number;
    top: { title: string; chapters: number; coverUrl?: string }[];
}

/** The theme inks the card needs. The card is a dark plate in both themes, as the profile
 *  banner is, so text takes the plate inks rather than the page's. */
interface HunterCardInks {
    /** Glow and bars. */
    accent: string;
    /** Accent-coloured text on the dark plate. */
    plateInk: string;
}

/** Link-preview size (Open Graph and most chat apps crop to 1.91:1). */
export const CARD_W = 1200;
export const CARD_H = 630;

const INK = '#f5f5f4';
const MUTED = '#a8a29e';
const PLATE = '#07060a';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const loadImage = (src: string, timeoutMs = 4000) => new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
});

/** Only same-origin images may be drawn: a cross-origin one taints the canvas, and an export
 *  of a tainted canvas throws. Covers go through the app's own image proxy, which is. */
const sameOrigin = (src: string) => {
    try { return new URL(src, window.location.href).origin === window.location.origin; } catch { return false; }
};

/** Letter spacing where the canvas supports it (most current browsers); a no-op elsewhere. */
const track = (ctx: CanvasRenderingContext2D, px: number) => {
    (ctx as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`;
};

/** The largest font size, at most `max`, at which `text` fits `width`. */
const fitFont = (ctx: CanvasRenderingContext2D, text: string, weight: string, family: string, max: number, width: number, min = 24) => {
    let size = max;
    for (; size > min; size -= 2) {
        ctx.font = `${weight} ${size}px ${family}`;
        if (ctx.measureText(text).width <= width) break;
    }
    return size;
};

/** `text` cut to `width` with an ellipsis. */
const clip = (ctx: CanvasRenderingContext2D, text: string, width: number) => {
    if (ctx.measureText(text).width <= width) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
};

/** Up to two lines of `text` within `width`, the second ellipsised if it runs long. */
const twoLines = (ctx: CanvasRenderingContext2D, text: string, width: number): string[] => {
    const words = text.split(/\s+/);
    let first = '';
    let i = 0;
    for (; i < words.length; i++) {
        const next = first ? `${first} ${words[i]}` : words[i];
        if (ctx.measureText(next).width > width && first) break;
        first = next;
    }
    const rest = words.slice(i).join(' ');
    return rest ? [clip(ctx, first, width), clip(ctx, rest, width)] : [clip(ctx, first, width)];
};

const brackets = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, arm: number, color: string, lw = 3) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, y + arm); ctx.lineTo(x, y); ctx.lineTo(x + arm, y);
    ctx.moveTo(x + w - arm, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + arm);
    ctx.moveTo(x + w, y + h - arm); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - arm, y + h);
    ctx.moveTo(x + arm, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - arm);
    ctx.stroke();
};

/** A cover, cropped to fill its box like object-fit: cover; a lettered plate without one. */
const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, title: string, x: number, y: number, w: number, h: number, inks: HunterCardInks) => {
    ctx.save();
    ctx.fillStyle = '#15121c';
    ctx.fillRect(x, y, w, h);
    if (img) {
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const sw = w / scale, sh = h / scale;
        ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
    } else {
        ctx.fillStyle = inks.plateInk;
        ctx.font = `900 30px Orbitron, ${SANS}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((title.trim()[0] || '?').toUpperCase(), x + w / 2, y + h / 2);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
};

/**
 * Paint a Hunter Card and return it as a PNG. Fonts are awaited first (Orbitron is a web
 * font, and a canvas paints with whatever is loaded at that moment). Covers that fail to load
 * in time, or that are not same-origin, fall back to lettered plates.
 */
export const renderHunterCard = async (data: HunterCardData, inks: HunterCardInks): Promise<Blob> => {
    try {
        await Promise.all([
            document.fonts.load('900 112px Orbitron'),
            document.fonts.load('700 40px Orbitron'),
        ]);
    } catch { /* the fallback face still renders */ }

    const [emblem, ...covers] = await Promise.all([
        loadImage('/icon-192.png'),
        ...data.top.slice(0, 3).map(t => {
            const src = getProxiedImageUrl(t.coverUrl);
            return src && sameOrigin(src) ? loadImage(src) : Promise.resolve(null);
        }),
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable.');

    // Plate, two accent blooms and a faint survey grid.
    ctx.fillStyle = PLATE;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    const bloom = (x: number, y: number, r: number, alpha: string) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `${inks.accent}${alpha}`);
        g.addColorStop(1, `${inks.accent}00`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CARD_W, CARD_H);
    };
    bloom(260, 250, 520, '38');
    bloom(1120, 640, 420, '24');
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CARD_W; x += 40) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, CARD_H); ctx.stroke(); }
    for (let y = 0; y <= CARD_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(CARD_W, y + 0.5); ctx.stroke(); }
    brackets(ctx, 24, 24, CARD_W - 48, CARD_H - 48, 40, inks.accent);

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // Header: emblem, name, date. The emblem file is the Void (amber) one; it is recoloured
    // to this theme's accent, keeping its shading ('color' blend), then clipped back to it.
    if (emblem) {
        const tint = document.createElement('canvas');
        tint.width = 112;
        tint.height = 112;
        const t = tint.getContext('2d');
        if (t) {
            t.drawImage(emblem, 0, 0, 112, 112);
            t.globalCompositeOperation = 'color';
            t.fillStyle = inks.accent;
            t.fillRect(0, 0, 112, 112);
            t.globalCompositeOperation = 'destination-in';
            t.drawImage(emblem, 0, 0, 112, 112);
            ctx.drawImage(tint, 60, 52, 56, 56);
        } else {
            ctx.drawImage(emblem, 60, 52, 56, 56);
        }
    }
    ctx.fillStyle = INK;
    ctx.font = `700 22px Orbitron, ${SANS}`;
    track(ctx, 4);
    ctx.fillText('THE AKASHIC RECORDS', 132, 78);
    ctx.fillStyle = inks.plateInk;
    ctx.font = `700 14px ${MONO}`;
    track(ctx, 5);
    ctx.fillText('HUNTER CARD // SYSTEM.VERIFIED', 132, 102);
    ctx.textAlign = 'right';
    ctx.fillStyle = MUTED;
    ctx.fillText(new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase(), CARD_W - 60, 78);
    ctx.textAlign = 'left';

    // Identity: designation, rank, name and title.
    const left = 60, leftW = 640;
    ctx.fillStyle = inks.plateInk;
    ctx.font = `700 15px ${MONO}`;
    track(ctx, 5);
    ctx.fillText('HUNTER DESIGNATION', left, 178);
    track(ctx, 0);
    const rankSize = fitFont(ctx, data.rank, '900', `Orbitron, ${SANS}`, 112, leftW, 56);
    ctx.font = `900 ${rankSize}px Orbitron, ${SANS}`;
    const rankGrad = ctx.createLinearGradient(left, 0, left + Math.min(leftW, ctx.measureText(data.rank).width), 0);
    rankGrad.addColorStop(0, inks.plateInk);
    rankGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = rankGrad;
    ctx.fillText(data.rank, left - 4, 182 + rankSize * 0.92);

    const nameY = 182 + rankSize * 0.92 + 48;
    ctx.fillStyle = INK;
    ctx.font = `700 26px Orbitron, ${SANS}`;
    track(ctx, 2);
    const name = clip(ctx, data.username.toUpperCase(), leftW);
    ctx.fillText(name, left, nameY);
    if (data.title) {
        const nameW = ctx.measureText(name).width;
        ctx.fillStyle = inks.plateInk;
        ctx.font = `700 16px ${MONO}`;
        track(ctx, 3);
        const room = leftW - nameW - 24;
        if (room > 120) ctx.fillText(clip(ctx, `« ${data.title.toUpperCase()} »`, room), left + nameW + 24, nameY - 3);
        else ctx.fillText(clip(ctx, `« ${data.title.toUpperCase()} »`, leftW), left, nameY + 28);
    }

    // EXP toward the next rank.
    const barY = 410;
    ctx.fillStyle = MUTED;
    ctx.font = `700 15px ${MONO}`;
    track(ctx, 3);
    ctx.fillText(`${data.exp.toLocaleString()} EXP${data.next ? ` · ${(data.next.minExp - data.exp).toLocaleString()} TO ${data.next.label}` : ' · HIGHEST RANK'}`, left, barY - 14);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(left, barY, leftW, 8);
    ctx.fillStyle = inks.accent;
    ctx.fillRect(left, barY, Math.round(leftW * Math.min(1, Math.max(0, data.progress))), 8);

    // Four stat tiles.
    const stats: [string, string][] = [
        ['SERIES', data.series.toLocaleString()],
        ['CONQUERED', data.conquered.toLocaleString()],
        ['CHAPTERS', data.chapters.toLocaleString()],
        ['TITLES', data.titlesTotal ? `${data.titlesEarned}/${data.titlesTotal}` : '—'],
    ];
    const tileW = (leftW - 3 * 14) / 4;
    stats.forEach(([label, value], i) => {
        const x = left + i * (tileW + 14);
        const y = 452;
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(x, y, tileW, 96);
        brackets(ctx, x, y, tileW, 96, 12, `${inks.accent}aa`, 2);
        track(ctx, 0);
        ctx.fillStyle = INK;
        const valueSize = fitFont(ctx, value, '700', `Orbitron, ${SANS}`, 38, tileW - 28, 18);
        ctx.font = `700 ${valueSize}px Orbitron, ${SANS}`;
        ctx.fillText(value, x + 14, y + 52);
        ctx.fillStyle = inks.plateInk;
        ctx.font = `700 12px ${MONO}`;
        track(ctx, 3);
        ctx.fillText(label, x + 14, y + 78);
    });

    // Top series.
    const right = 760, rightW = CARD_W - 60 - right;
    ctx.fillStyle = inks.plateInk;
    ctx.font = `700 15px ${MONO}`;
    track(ctx, 5);
    ctx.fillText('TOP SERIES', right, 178);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(right, 192.5); ctx.lineTo(right + rightW, 192.5); ctx.stroke();
    const rows = data.top.slice(0, 3);
    if (rows.length === 0) {
        ctx.fillStyle = MUTED;
        ctx.font = `400 16px ${MONO}`;
        track(ctx, 0);
        ctx.fillText('No series yet.', right, 232);
    }
    rows.forEach((s, i) => {
        const y = 212 + i * 116;
        drawCover(ctx, covers[i] ?? null, s.title, right, y, 68, 96, inks);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = inks.plateInk;
        ctx.font = `700 13px ${MONO}`;
        track(ctx, 2);
        ctx.fillText(`#${i + 1}`, right + 86, y + 20);
        ctx.fillStyle = INK;
        ctx.font = `700 21px ${SANS}`;
        track(ctx, 0);
        twoLines(ctx, s.title, rightW - 86).forEach((line, j) => ctx.fillText(line, right + 86, y + 46 + j * 25));
        ctx.fillStyle = MUTED;
        ctx.font = `700 14px ${MONO}`;
        track(ctx, 2);
        ctx.fillText(`CH ${s.chapters.toLocaleString()}`, right + 86, y + 94);
    });

    // Footer: where it came from.
    ctx.fillStyle = MUTED;
    ctx.font = `400 14px ${MONO}`;
    track(ctx, 3);
    ctx.fillText(window.location.host.toUpperCase(), left, CARD_H - 52);

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The card could not be exported.'))), 'image/png');
    });
};
