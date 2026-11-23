/**
 * The words of each page's tour (SystemTour loads this with itself, on first use). Each step
 * names a `data-tour` target on its page, or null for a centred message. A target that is not
 * laid out (the phone folds some away) turns its step into a centred message too, so every step
 * reads on its own.
 *
 * 2026-11-23, the owner: the walkthrough should cover every detail of the site's features. Each
 * page's tour now walks every part of that page, in the order the eye meets it.
 */
import { TourId } from '../../core/tours';

export interface TourStep {
    /** A `data-tour` key, or several to try in order, or null for a centred message. */
    target: string | string[] | null;
    title: string;
    body: string;
    /** Leave the step out where its target is not laid out (a phone folds some parts away). */
    onlyIfShown?: boolean;
    /** Leave the step out unless this `data-tour` part is laid out (for a centred message about it). */
    requires?: string;
    /** A keyboard step: left out on a touch screen. */
    keyboard?: boolean;
}


/** The page's name in the card's caption ("System // Spire · 2 / 5"). */
export const TOUR_NAMES: Record<TourId, string> = {
    dashboard: 'Tutorial',
    spire: 'Spire',
    floor: 'Spire floor',
    matrix: 'Matrix',
    profile: 'Profile',
    series: 'Series',
    gate: 'Gate editor',
};

const dashboard = (guest: boolean): TourStep[] => [
    {
        target: null,
        title: 'Welcome, Hunter',
        body: guest
            ? 'The Akashic Records tracks the manhwa you read, run as an RPG System: chapters are EXP, series are gates, and your library is a tower. This archive is a demo: it is yours for two hours, and nothing you do here touches the owner\'s library. This tour walks through every part of the home screen.'
            : 'The Akashic Records tracks the manhwa you read, run as an RPG System: chapters are EXP, series are gates, and your library is a tower. This tour walks through every part of the home screen.',
    },
    ...(guest ? [{
        target: 'link-stability',
        title: 'Link stability',
        body: 'The time left in this demo. It turns to the warning colour for its last 10 minutes; when it runs out the link closes and this archive is deleted. Entering as a guest again starts a fresh one.',
    }] : []),
    { target: 'theme', title: 'Void or Arcanum', body: 'Switch between the dark Void theme and the light Arcanum theme. Your choice is remembered on this device.' },
    { target: 'hero-card', title: 'The active gate', body: 'The series you are reading now, standing on its holographic dais, which answers each chapter you log. Double-click (or double-tap) the cover to edit its record. A conquered series never stands here: the next active one takes its place.' },
    { target: null, requires: 'mana-ring', title: 'The Mana Ring', body: 'The ring around the hero is today\'s Divine Mandate. Two arms of light leave the gate at the top as you read and meet at the seal at the bottom when the mandate is cleared; the ring flares once. (Phones leave the ring out; the mandate is also in the Spire\'s quests.)' },
    { target: 'hero-rank', onlyIfShown: true, title: 'Rank and class', body: 'RANK ASSESSMENT grades the series by its length: E up to 20 chapters, D past 20, C past 50, B past 100, A past 200, S past 500. CLASSIFICATION is its class (Player, Irregular, Mage, Constellation or Necromancer), which also sets the domain its page opens into.' },
    { target: 'hero-sequence', onlyIfShown: true, title: 'Sequence data', body: 'Your current chapter. Tap the number to type a chapter: one save however far the jump. The digits roll like a counter\'s wheels as it moves. Below: how many chapters exist so far, and +N NEW when the tracker has found more.' },
    { target: 'event-log', onlyIfShown: true, title: 'Event log', body: 'The last four things that actually happened, each with its real time: chapters absorbed (an Undo cancels out), new chapters the tracker found, gates conquered and titles earned. A new line decodes in as it arrives.' },
    { target: 'completion', title: 'Completion rate', body: 'How far through the known chapters you are. On a phone your chapter readout sits here as well, and takes a typed chapter too.' },
    { target: 'read', title: 'Log a chapter', body: '+ logs a chapter and - takes one back; hold either to count quickly, saved once you let go. A big jump offers Undo. If the connection drops, the number holds and the save retries for two minutes. ENTER PORTAL opens the series on its reading site.' },
    { target: null, title: 'Returned from the gate', body: 'Open a series through ENTER PORTAL and come back three minutes or more later: a sheet asks how far you read, with +1, +2, +5 or a typed chapter. It asks once per trip, waits until nothing else is open, and slips away after 30 seconds untouched.' },
    { target: 'rank', title: 'Your hunter rank', body: 'Every chapter read is 1 EXP. EXP climbs the ranks: Drifter, Awakened, Adept, Vanguard, Ascendant, Paragon, Sovereign, Eclipse, Monarch at 15,000, then the Transcendent tiers. The bar shows the way to the next rank; a rank that opens a new avatar frame plays the Rank Ascension.' },
    { target: 'quest-metrics', title: 'Quest metrics', body: 'The hero series at a glance. Wisdom is the chapter you have read to, Might its size (a tenth of its chapters), Sync how far through it you are, and Gate its state: OPEN while you read it.' },
    { target: 'quests', title: 'Active quests', body: 'Every series you are reading. Tap one to bring it to the hero, drag its handle to reorder (the order is saved), and search with the glass. New chapters asks the sources for releases, active series first.' },
    { target: 'spire', title: 'The Divine Spire', body: 'Your whole library as a tower, floor by floor, with search, sorting, changes to many series at once, the Command Matrix, and your daily and weekly quests. It has its own tour.' },
    { target: 'sidebar-grip', onlyIfShown: true, title: 'More room', body: 'This grip folds the side panel away to give the hero the whole screen, and brings it back.' },
    { target: 'create-gate', title: 'Open a new gate', body: 'Add a series: CREATE_GATE here, New on a phone\'s tab bar, or N on a keyboard. Paste the link where you read it and the System fills in the rest. The editor has its own tour.' },
    { target: 'profile', title: 'Hunter Profile', body: 'Your banner and rank ladder, titles, reading activity, backups and imports, the Trash, and the System settings. It has its own tour.' },
    { target: 'console', onlyIfShown: true, title: 'The console', body: 'OMNI_LOG reads out your own state in turn: today\'s mandate, this week\'s decree, your streak, the distance to the next rank, gates with new chapters, the last event. [?] KEYS lists the keyboard shortcuts.' },
    { target: null, keyboard: true, title: 'Keyboard', body: 'The right arrow logs a chapter and the left takes one back (hold to repeat). Enter opens the reading link, / searches the Spire, N opens a new gate, Ctrl+Z undoes while its notice shows, and ? lists every key.' },
    { target: null, title: 'The System speaks', body: 'Rank-ups, titles earned and cleared quests arrive one at a time, never over a tour. Once a week, active series left unread for 30 days are gathered for review as Dormant Gates. Low-power effects and chapter sounds are in the profile\'s System settings.' },
    { target: null, title: 'Every page has a tour', body: 'The Spire, its floors, the Command Matrix, the profile, a series page and the gate editor each have their own tour, offered the first time you open them and replayed from their ? button (Tour on the profile).' },
];

export const tourSteps = (id: TourId, guest: boolean): TourStep[] => {
    switch (id) {
        case 'dashboard': return dashboard(guest);
        case 'spire': return [
            { target: null, title: 'The Divine Spire', body: 'Your library as a tower of nine floors. Each floor holds the series at one stage of progress, built from your own records, so the shape of the tower is the shape of your reading.' },
            { target: null, title: 'The nine floors', body: 'From the base: The Severed (dropped), The Stasis (on hold), Sealed Gates (not started), Threshold (under 25%), Trials (25 to 49%), Ascent (50 to 74%), Crest (75 to 99%), the Vigil (caught up, waiting for chapters) and the Throne (conquered).' },
            { target: 'tower-legend', onlyIfShown: true, title: 'Ascent key', body: 'The same nine floors as a key, from the base to the Throne, with the rule for each.' },
            { target: null, title: 'Each floor\'s mood', body: 'Every floor has its own atmosphere: the Severed a faint grey ghost, the Stasis nearly frozen, Sealed Gates dim and still. The climb brightens as it rises, the Vigil breathes, and motes rise from the Throne.' },
            { target: null, title: 'Moving around', body: 'Drag to turn the tower, scroll to climb, pinch to zoom. Tap an isle to bring it to the front, then tap it again to walk onto that floor. With a keyboard, Tab reaches a button for each floor.' },
            { target: 'tower-metrics', title: 'Player metrics', body: 'Series held, chapters absorbed, conquests and your reading streak, across the whole library.' },
            { target: 'tower-quests', onlyIfShown: true, title: 'Daily and weekly quests', body: 'Titles discovered, today\'s mandate and this week\'s decree. Adjust quests to choose what counts: the daily as a number of series or of chapters, the weekly as chapters from Monday to Sunday in your own time zone. Clearing one flares the streak supernova.' },
            { target: 'tower-top', onlyIfShown: true, title: 'Top revelations', body: 'Your longest series, by chapters. Tap one to open its page.' },
            { target: 'tower-synergy', onlyIfShown: true, title: 'Synergy index', body: 'How your library splits across the five classes.' },
            { target: 'tower-recents', onlyIfShown: true, title: 'Recent data', body: 'The series you touched last. Tap one to open its page.' },
            { target: 'spire-views', title: 'Tower or Matrix', body: 'Matrix shows every series as one list instead, with a +1 on each row. The Spire opens in whichever you used last.' },
        ];
        case 'floor': return [
            { target: 'floor-search', title: 'Search the archive', body: 'Type any part of a title to find it on every floor at once.' },
            { target: 'floor-layer', title: 'Change floor', body: 'The arrows step between floors. Tap the floor name for filters by class and status, the sort order (your appraisal among them), and a jump to any floor.' },
            { target: 'floor-cards', title: 'The series here', body: 'Scroll sideways through this floor. Tap a card to open its series page.' },
            { target: null, title: 'What a card wears', body: 'A card shows its status: SEALED in chains with a keyhole and the art dimmed, STASIS in frost, SEVERED with a corner broken off. A conquered series becomes an Ascended Relic in a gold-leaf frame. ACTIVE wears nothing.' },
            { target: 'floor-select', title: 'Change many at once', body: 'Select turns taps into a selection, across floors and searches. Then set one status on all of them, or move them to the Trash; every change offers Undo.' },
        ];
        case 'matrix': return [
            { target: 'spire-views', title: 'The Command Matrix', body: 'The whole library as one list, for logging chapters across many series quickly. Tower takes you back to the floors.' },
            { target: 'matrix-tools', title: 'Find and order', body: 'Search by title, filter by status (each chip shows its count), and choose the order. The sort is shared with the floors.' },
            { target: 'matrix-row', title: 'What a row shows', body: 'The cover, title and class, the status and the floor it stands on, your appraisal, and your progress, with +N NEW when the tracker has found chapters.' },
            { target: 'matrix-row', title: 'One row, three actions', body: '+1 logs a chapter; taps on one row save together. The arrow opens the series page, and the bolt opens its reading link. The list keeps its order while you work.' },
            { target: null, keyboard: true, title: 'Keys', body: 'With a keyboard: J and K (or the arrows) move down and up the list, + logs a chapter on the marked row and - takes one back, O opens it, Enter opens its reading link, and / jumps to the search.' },
        ];
        case 'profile': return [
            { target: null, title: 'Your hunter record', body: 'Everything about you as a reader: your rank, your titles, your reading history, and the tools that keep your archive safe.' },
            { target: 'profile-banner', title: 'The banner', body: 'Your portrait and name, the title you wear, and your designation (your rank). The sigil beside them is your overall completion across the whole library.' },
            { target: ['profile-ledger', 'profile-banner'], title: 'The rank ladder', body: 'The EXP to your next rank, and the ladder of ranks from Drifter to Monarch. Past Monarch it slides on to the Transcendent tiers, drawn as diamonds.' },
            { target: 'profile-actions', title: 'Edit, share, replay', body: 'Edit Profile changes your name or password (your current password is needed, and a new one signs out your other devices). Hunter Card makes a 1200 by 630 image of your profile with your top three covers, to share or download. Tour replays this walkthrough.' },
            { target: 'profile-metrics', title: 'Combat metrics', body: 'Titles earned, series conquered, series in progress and chapters absorbed.' },
            { target: 'profile-titles', title: 'Hunter Titles', body: 'Thirty titles earned by reading: streaks, big days and weeks, conquests, depth and breadth. Four are hidden, UNDECODED until you earn them. Each shows its progress; equip one to wear it under your name.' },
            { target: 'profile-activity', title: 'Reading activity', body: 'A year of reading from your log, day by day, with this week, your current and longest streaks, and the days you have read.' },
            { target: 'profile-classes', title: 'Class distribution', body: 'How your library splits across the five classes.' },
            { target: 'profile-top', title: 'Top series', body: 'Your five most-read series, by chapters read.' },
            { target: 'profile-progress', title: 'Active progress', body: 'Your active series as cards, the furthest along first, each with how far through it you are.' },
            { target: 'profile-tools', title: 'Archive tools', body: 'The tools along the top keep your archive: export and import, the Trash, covers, settings and recalibration. One at a time:' },
            { target: 'profile-export', title: 'Export', body: 'A full backup (.json: every record, the Trash, the reading log, titles, streak and quest settings), or a spreadsheet (.csv).' },
            { target: 'profile-import', title: 'Import', body: 'A backup or spreadsheet, an AniList list by username, or a MyAnimeList export (.xml or .xml.gz). Importing only adds: it fills gaps and moves chapters forward, never back, and never overwrites a record.' },
            { target: 'profile-trash', title: 'The Trash', body: 'Deleted series wait here for 30 days. Restore one, or delete it for good.' },
            { target: 'profile-covers', title: 'Find missing covers', body: 'Searches the archives for every series still showing a placeholder cover.' },
            { target: 'profile-settings', title: 'System settings', body: 'Low-power effects holds every animation still. Chapter sounds plays a soft bell for each chapter you log, climbing a scale as you read on. Both are kept on this device.' },
            { target: 'profile-recalibrate', title: 'System recalibration', body: 'Re-checks every series\' genres on AniList, MangaDex and MyAnimeList, and re-assigns its class.' },
        ];
        case 'series': return [
            { target: null, title: 'A series page', body: 'Everything about one series. It opens into its class\'s domain: the Abyssal Crypt (Necromancer), the System Matrix (Player), the Leyline Sanctum (Mage), the Star Stream (Constellation) or the Dimensional Fracture (Irregular). The top bar names it.' },
            { target: 'series-actions', title: 'Read, edit, focus', body: 'ENTER PORTAL opens it on its reading site. EDIT_ARTIFACT changes its record. MARK_TARGET makes it the series on your dashboard. MARK_CONQUERED, once you have finished it, plays the Ascension Rite and makes it a relic.' },
            { target: 'series-progress', title: 'Your progress', body: 'How far along you are, and the Spire floor that puts it on. Stars mark the first chapter, a quarter, half, three quarters and the latest; hover or tap one to see when you crossed it.' },
            { target: 'series-synopsis', title: 'Synopsis', body: 'The story so far, from the archives or in your own words. Edit it here.' },
            { target: 'series-appraisal', title: 'Hunter\'s Appraisal', body: 'Your own score, 1 to 10. It sorts the Spire and shows on its card. A 10 locks on the Transcendent crest.' },
            { target: 'series-chronicle', title: 'Chronicle', body: 'When you added it and when you conquered it, the chapters you read and when, and at your recent pace how long until you clear it.' },
            { target: 'series-radar', title: 'Release radar', body: 'When it usually releases ("Usually Tuesdays", "About every 10 days", or on a break), the next expected day and the last release, from MangaUpdates or MangaDex. Your reading site may differ by a day.' },
            { target: 'series-meta', title: 'Source data', body: 'From the archives: its RESONANCE score, ORIGIN year, DEPTH in chapters, and its genres.' },
            { target: 'series-entities', title: 'Entities detected', body: 'The main characters, from AniList, or from MyAnimeList when AniList is down.' },
            { target: 'series-similar', title: 'Similar records', body: 'Other series in your library of the same class. Tapping one makes it your active series, as MARK_TARGET does.' },
        ];
        case 'gate': return [
            { target: 'gate-link', title: 'Open a gate', body: 'Paste the link where you read it and SCAN: the System reads the title from the link and finds its cover, chapter count and synopsis on AniList, MyAnimeList or MangaDex, or picks the best match itself (AUTO).' },
            { target: 'gate-title', title: 'Or name it', body: 'No link? Type the title and use the archive search beside it to fetch the same details. A title already in your archive is caught before it is added twice.' },
            { target: 'gate-chapters', title: 'Where you are', body: 'Your current chapter, and how many exist so far (0 when unknown).' },
            { target: 'gate-status', title: 'Status and class', body: 'ACTIVE while you read it, SEALED for later, STASIS for a pause, CONQUERED once finished, SEVERED if dropped; reading a sealed or paused series opens it again. The class (Player, Irregular, Mage, Constellation or Necromancer) sets its domain.' },
            { target: 'gate-appraisal', title: 'Hunter\'s Appraisal', body: 'Your rating, 1 to 10, if you want one. A 10 shows the Transcendent crest.' },
            { target: 'gate-synopsis', title: 'Synopsis', body: 'Filled in by the scan, or written by you.' },
            { target: 'gate-footer', title: 'Seal the gate', body: 'Save the record. On a series you already have, the delete button moves it to the Trash, where it waits 30 days. Marking a series CONQUERED here plays the Ascension Rite.' },
        ];
    }
};
