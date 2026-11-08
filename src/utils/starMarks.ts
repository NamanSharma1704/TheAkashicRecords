/**
 * The star-path's milestone chapters (the series page's progress thread): the first chapter, a
 * quarter, half, three quarters and the latest; duplicates dropped, so a short series has
 * fewer, and a series of under four chapters only its first and last. backend/index.js
 * `starMarks` is the same rule: the server dates each crossing, and the page draws the stars
 * from this before the dates arrive.
 */
export const starMarks = (total: number): number[] => {
    if (!(total > 0)) return [];
    if (total < 4) return [...new Set([1, total])];
    return [...new Set([1, Math.ceil(total * 0.25), Math.ceil(total * 0.5), Math.ceil(total * 0.75), total])];
};

/** What each mark is called, by its place in the full list above. */
export const starName = (chapter: number, total: number): { name: string; caption: string } => {
    if (chapter === 1) return { name: 'First read', caption: 'CH 1' };
    if (chapter === total) return { name: 'Latest chapter', caption: 'LATEST' };
    if (chapter === Math.ceil(total * 0.25)) return { name: 'A quarter', caption: '25%' };
    if (chapter === Math.ceil(total * 0.5)) return { name: 'Halfway', caption: '50%' };
    return { name: 'Three quarters', caption: '75%' };
};
