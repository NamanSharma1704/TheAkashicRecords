export interface Theme {
    id: string;
    name: string;
    primary: string;
    accent: string;
    appBg: string;
    panelBg: string;
    modalBg: string;
    inputBg: string;
    baseText: string;
    headingText: string;
    mutedText: string;
    highlightText: string;
    border: string;
    borderSubtle: string;
    overlay: string;
    starColor: string;
    gradient: string;
    /**
     * Decorative accent: fills, large shapes, glows. High chroma, no contrast duty.
     */
    accentColor: string;
    /**
     * Structural accent: text, icons and thin lines — anything that carries meaning
     * and therefore has to pass contrast. Identical to `accentColor` on dark, where
     * amber on near-black already measures 9.66:1, but darker on light, where
     * cyan-500 on the page measured only 2.32:1 and failed AA outright.
     */
    accentInk: string;
    /**
     * Warning ink — the guest session countdown and anything else that means "running
     * out". Deliberately NOT derived from the accent: a warning must stay amber when the
     * theme is cyan. Light uses amber-800, because amber-500 on the page is 1.84:1.
     */
    warningInk: string;
    isDark: boolean;
}

export interface Rank {
    name: string;
    threshold: number;
    color: string;
    /**
     * Rank colour for use on a LIGHT surface. `color` is the -400 rung, which is tuned for
     * the void and sits near 2.3:1 on a white card. Only surfaces that are actually pale
     * should reach for this — ManhwaDetail keeps `color`, because its backdrop is dark in
     * both themes.
     */
    colorLight?: string;
    bg: string;
    border?: string;
    glow?: string;
}

export interface Quest {
    id: string;      // The frontend ID, mapped from MongoDB _id
    _id?: string;    // The actual MongoDB ID
    title: string;
    coverUrl?: string; // CHANGED FROM cover
    totalChapters: number;
    currentChapter: number;
    status: string;
    classType: string;
    link?: string;     // CHANGED FROM readLink
    lastUpdated?: number | string; // CHANGED FROM lastRead
    synopsis?: string; // ADDED
}

export interface User {
    id: string;
    username: string;
    role: 'SOVEREIGN' | 'GUEST';
}

export interface AuthResponse {
    user: User;
    /** Epoch ms at which the session cookie lapses. Used only to avoid a login flash. */
    expiresAt?: number;
}
