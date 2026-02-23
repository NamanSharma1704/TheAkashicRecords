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
    _id?: string;
    id: string;
    title: string;
    coverUrl: string;
    totalChapters: number | null;
    currentChapter: number;
    status: string;       // Unified: READING | COMPLETED | PLAN_TO_READ | DROPPED | ON_HOLD | ACTIVE | CONQUERED | SEVERED
    classType?: string;   // Akashic Records extra field
    link: string;
    synopsis?: string;
    rating?: number;
    lastUpdated?: string;
}

export type UserRank = Rank;
export type ManhwaRank = Rank;
