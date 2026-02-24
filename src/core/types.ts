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
    shadow: string;
    glow: string;
    overlay: string;
    starColor: string;
    gradient: string;
    rayColor: string;
    isDark: boolean;
}

export interface Rank {
    name: string;
    threshold: number;
    color: string;
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
    rating?: number;   // ADDED
}

export type UserRank = Rank;
export type ManhwaRank = Rank;
