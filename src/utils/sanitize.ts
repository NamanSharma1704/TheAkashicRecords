/**
 * Minimal HTML sanitizer for third-party synopsis text.
 *
 * Synopses arrive from AniList / MangaDex / MAL and are rendered with
 * dangerouslySetInnerHTML, which makes them a direct path to the JWT held in
 * localStorage. They also legitimately contain light markup (<br>, <i>, <b>) that the
 * layout depends on, so stripping to plain text would visibly regress the detail view.
 *
 * The approach: parse into an inert document, then rebuild from an allowlist. Every
 * attribute is dropped, so there is no surface for onerror/onload handlers or
 * javascript: URLs, and no allowlisted tag can load a resource or execute.
 */

// Tags kept, rendered without any attributes.
const ALLOWED_TAGS = new Set(['BR', 'B', 'STRONG', 'I', 'EM', 'U', 'P', 'SPAN']);

// Tags whose *contents* are discarded rather than unwrapped. Unwrapping a <script>
// would surface its source as visible text; these are simply removed.
const DROP_ENTIRELY = new Set([
    'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT',
    'TEMPLATE', 'SVG', 'MATH', 'LINK', 'META', 'BASE', 'FORM', 'INPUT'
]);

const escapeText = (text: string): string =>
    text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

/**
 * Returns HTML safe to hand to dangerouslySetInnerHTML.
 * Unknown tags are unwrapped — their text survives, the tag and its attributes do not.
 */
export const sanitizeHtml = (dirty: string | undefined | null): string => {
    if (!dirty) return '';

    // Guard for any non-browser render path (tests, SSR) where DOMParser is absent.
    if (typeof DOMParser === 'undefined') return escapeText(dirty);

    let doc: Document;
    try {
        // Documents from DOMParser are inert: no scripts run and no resources load.
        doc = new DOMParser().parseFromString(dirty, 'text/html');
    } catch {
        return escapeText(dirty);
    }

    const clean = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return escapeText(node.textContent || '');
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const el = node as Element;
        const tag = el.tagName.toUpperCase();

        if (DROP_ENTIRELY.has(tag)) return '';

        const inner = Array.from(el.childNodes).map(clean).join('');

        if (!ALLOWED_TAGS.has(tag)) return inner; // unwrap: keep the text, drop the element
        if (tag === 'BR') return '<br>';

        const lower = tag.toLowerCase();
        return `<${lower}>${inner}</${lower}>`;
    };

    return Array.from(doc.body.childNodes).map(clean).join('');
};
