/**
 * The words of each page's tour (SystemTour loads this with itself, on first use). Each step
 * names a `data-tour` target on its page, or null for a centred message.
 */
import { TourId } from '../../core/tours';

interface TourStep {
    target: string | null;
    title: string;
    body: string;
}


/** The page's name in the card's caption ("System // Spire · 2 / 5"). */
export const TOUR_NAMES: Record<TourId, string> = {
    dashboard: 'Tutorial',
    spire: 'Spire',
    floor: 'Spire floor',
    profile: 'Profile',
    series: 'Series',
    gate: 'Gate editor',
};

export const tourSteps = (id: TourId, guest: boolean): TourStep[] => {
    switch (id) {
        case 'dashboard': return [
            {
                target: null,
                title: 'Welcome, Hunter',
                body: guest
                    ? 'The Akashic Records tracks the manhwa you read, run by the System. This archive is a demo: it is yours for the next two hours, and nothing you do here touches the owner\'s library.'
                    : 'The Akashic Records tracks the manhwa you read, run by the System. Here is the HUD in six steps.',
            },
            { target: 'read', title: 'Log a chapter', body: 'Press + when you finish a chapter; hold it to count quickly. ENTER PORTAL opens the series on its reading site.' },
            { target: 'rank', title: 'Earn your rank', body: 'Every chapter read is 1 EXP. EXP raises your rank from Drifter to Monarch, and reading earns Hunter Titles along the way.' },
            { target: 'quests', title: 'Active quests', body: 'The series you are reading now. Tap one to bring it up, drag its handle to reorder, and use New chapters to check for releases.' },
            { target: 'spire', title: 'The Divine Spire', body: 'The whole library as a tower: each floor holds the series at one stage of progress. Search, sorting and your daily quests live there.' },
            { target: 'profile', title: 'Hunter Profile', body: 'Your rank ladder, titles, reading activity, backups and a shareable Hunter Card. Add a series of your own with CREATE_GATE.' },
        ];
        case 'spire': return [
            { target: null, title: 'The Divine Spire', body: 'Your library as a tower. Each floor holds the series at one stage of progress, from the Sealed Gates you have not started up to the Throne of conquered ones. Dropped and paused series rest at the base.' },
            { target: 'tower-metrics', title: 'Player metrics', body: 'Series read, chapters, conquests and your reading streak, across the whole library.' },
            { target: 'tower-quests', title: 'Daily and weekly quests', body: 'Today\'s mandate and this week\'s decree. Adjust quests to choose what counts and how much.' },
            { target: 'tower-recents', title: 'Recent data', body: 'The series you touched last. Tap one to open its page.' },
            { target: null, title: 'Enter a floor', body: 'Tap an isle of the tower to walk into that floor and see its series. Keyboard: Tab reaches a button for each floor.' },
        ];
        case 'floor': return [
            { target: 'floor-search', title: 'Search the archive', body: 'Type any part of a title to find it on every floor at once.' },
            { target: 'floor-layer', title: 'Change floor', body: 'The arrows step between floors. Tap the floor name for filters by class and status, the sort order, and a jump to any floor.' },
            { target: 'floor-cards', title: 'The series here', body: 'Scroll sideways through this floor. Tap a card to open its series page.' },
            { target: 'floor-select', title: 'Change many at once', body: 'Select turns taps into a selection, across floors and searches. Then set one status on all of them, or move them to the Trash; every change offers Undo.' },
        ];
        case 'profile': return [
            { target: 'profile-banner', title: 'Your designation', body: 'Your rank, the EXP to the next one and the whole ladder. Edit Profile changes your name; Hunter Card makes an image of all this to share.' },
            { target: 'profile-titles', title: 'Hunter Titles', body: 'Titles the System grants for reading: streaks, big days, conquests. Equip one to wear it under your name.' },
            { target: 'profile-activity', title: 'Reading activity', body: 'A year of reading from your log, day by day, with your streaks.' },
            { target: 'profile-tools', title: 'Archive tools', body: 'Export a backup, import a file or an AniList or MyAnimeList list, open the Trash, find missing covers, and calm the effects.' },
        ];
        case 'series': return [
            { target: null, title: 'A series page', body: 'Everything about one series: where you are in it, your score for it, its history, and series like it.' },
            { target: 'series-actions', title: 'Read, edit, focus', body: 'ENTER PORTAL opens it on its reading site. EDIT_ARTIFACT changes its record. MARK_TARGET makes it the series on your dashboard.' },
            { target: 'series-progress', title: 'Your progress', body: 'How far along you are, and which floor of the Spire that puts it on.' },
            { target: 'series-appraisal', title: 'Hunter\'s Appraisal', body: 'Your own score, 1 to 10. It sorts the Spire and shows on its card.' },
            { target: 'series-chronicle', title: 'Chronicle', body: 'When you added it, when you read it, and at your recent pace how long until you clear it.' },
        ];
        case 'gate': return [
            { target: 'gate-link', title: 'Open a gate', body: 'Paste the link where you read it: the System reads the series and fills in its title, cover, synopsis and class.' },
            { target: 'gate-title', title: 'Or name it', body: 'No link? Type the title and use the archive search beside it to fetch the same details.' },
            { target: 'gate-chapters', title: 'Where you are', body: 'Your current chapter, and how many exist so far (0 when unknown).' },
            { target: 'gate-status', title: 'Status and class', body: 'ACTIVE while you read it, SEALED for later, STASIS for a pause. The class decides where it sits among the hunters.' },
        ];
    }
};
