import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { FLOOR_DEFS } from './floors';

// Divine Spire 8.0: Holographic ascending isles.
// A spiral of translucent faceted islands (bright wireframe edges) climbing toward a
// radiant System core, over a faint HUD ground grid — the reference "Tower of God" spire
// rendered in the site's amber (dark) / cyan (light) hologram language.
// Each island's glowing hex pad is a clickable floor; all mechanics from the previous
// tower (raycast focus/open, drag-rotate, wheel, pause, reduced-motion) are preserved.

/** Isles in the spire — one per progress floor (see floors.ts). The keyboard layer list in
 *  DivineSpire mirrors this. */
const TOWER_FLOORS = FLOOR_DEFS.length;

interface TowerStructureProps {
    onSelectFloor: (floorIndex: number) => void;
    theme: { isDark: boolean };
    onFocus?: (isFocused: boolean, floorIndex?: number) => void;
    isPaused?: boolean;
}

const TowerStructure: React.FC<TowerStructureProps> = ({ onSelectFloor, theme, onFocus, isPaused = false }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const onSelectFloorRef = useRef(onSelectFloor);
    // isPaused must be read through a ref: the scene effect below is scoped to [theme], so a
    // value captured in its closure would freeze at mount.
    const isPausedRef = useRef(isPaused);

    // Keep refs in sync with props
    useEffect(() => {
        onSelectFloorRef.current = onSelectFloor;
    }, [onSelectFloor]);
    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        // ---- VERTICAL SCALE SYSTEM (Responsive Tower Spacing) ----
        const h = mount.clientHeight;

        const FLOOR_SPACING =
            h < 700 ? 12 :
                h < 900 ? 13 :
                    14;

        const TOWER_OFFSET = FLOOR_SPACING * 3;
        const SPIRAL_ANG = 2.4; // radians of turn per floor (shared by build + focus math)
        const disposables: (THREE.Material | THREE.BufferGeometry | THREE.Texture | { dispose: () => void })[] = [];
        const mouse = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let targetRotationY = 0;
        let currentRotY = 0;
        let hoveredFloor: THREE.Object3D | null = null;
        let isHoveringTower = false;

        // --- THEME. Void: amber hologram emitting light. Aureic: a lapis monument drawn in
        // the accent's ink with a gold hot core — gold on ultramarine, standing out by
        // saturation and edge contrast on the vellum rather than by glow. ---
        const isDark = theme.isDark;
        const PRIMARY_COLOR = isDark ? 0xf59e0b : 0x7c3aed; // violet-500 / lapis (accentColor)
        const HOVER_COLOR = isDark ? 0xffffff : 0x3b1d6e;   // white / deep lapis (accentInk)
        const BODY_COLOR = isDark ? 0xd6891a : 0x8b5cf6;    // rich amber / lapis body fill
        const EDGE_COLOR = isDark ? 0xfbbf24 : 0xa78bfa;    // amber-400 / bright lapis edge
        const RIM_COLOR = isDark ? 0xfacc15 : 0x7c3aed;     // yellow-400 / lapis rim
        const HOT_COLOR = isDark ? 0xfff7e0 : 0xc4b0f5;     // pale amber / GOLD hot core (treasure)

        // --- SCENE ---
        const scene = new THREE.Scene();
        scene.background = null; // Transparent to show app layers behind

        // --- CAMERA ---
        const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        const INITIAL_CENTER = -2;
        camera.position.set(0, INITIAL_CENTER, 100);
        camera.lookAt(0, INITIAL_CENTER, 0);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Performance Cap
        mount.appendChild(renderer.domElement);

        const group = new THREE.Group();
        scene.add(group);
        // No vertical offset: floor local Y == world Y, so camera focus-scroll (which targets
        // floorY) lands exactly on the isle's height.
        group.position.y = 0;

        // --- MATERIALS (holographic: translucent bodies + bright wireframe edges) ---
        // Fully opaque so platforms read solid (writes depth to occlude their own back faces);
        // polygonOffset pushes faces back a touch so the bright wireframe edges sit cleanly on top.
        // Each floor's body, edge, pad, rim and core come from its mood (below); the hover pair
        // is shared, so a selection reads the same on every floor.
        const edgeHoverMat = new THREE.LineBasicMaterial({ color: HOVER_COLOR, transparent: true, opacity: 1.0 });
        const padHoverMat = new THREE.MeshBasicMaterial({ color: HOVER_COLOR, transparent: true, opacity: 1.0 });
        disposables.push(edgeHoverMat, padHoverMat);

        // --- FLOOR MOODS. Each floor reads its stage through energy, not colour: the theme's
        // accent throughout, neutral ink for the depowered, and one exception, the Throne in
        // the relic gold every conquered series wears (RelicFrame; artwork, the same in both
        // themes). Keyed by label, so a reordered FLOOR_DEFS keeps its moods.
        //   SEVERED    dropped: depowered. Faint, grey, edges broken into dashes, no glow, still.
        //   STASIS     on hold: frozen. Muted, and it bobs and turns at a tenth of the speed.
        //   SEALED     untouched: locked. Dimmed, the emblem still, no bob.
        //   THRESHOLD..CREST  the climb: today's look, a touch brighter with each floor.
        //   VIGIL      caught up: on watch. The emblem turns 1.3x and the pad breathes.
        //   THRONE     conquered: relic gold, at full brightness, with gold motes rising.
        // Hover and focus keep the shared hover materials on every floor: the selection reads
        // the same wherever it lands. ---
        interface Mood {
            body: number; bodyOpacity: number;
            edge: number; edgeOpacity: number; dashed?: boolean;
            pad: number; padOpacity: number;
            rim: number; rimOpacity: number;
            hot: number; hotOpacity: number;
            bob: number; spin: number;
            pulse?: boolean; relicMotes?: boolean;
        }
        // Toward the neutral ink of each theme: the depowered floors lose the accent's charge.
        // theme-color-ok: WebGL colours, which cannot read CSS variables
        const NEUTRAL = isDark ? 0x8a8478 : 0x8e86a3;
        const toward = (hex: number, k: number) => new THREE.Color(hex).lerp(new THREE.Color(NEUTRAL), k).getHex();
        // The relic gold (RelicFrame's GOLD_DEEP / GOLD / GOLD_LIGHT), artwork in both themes.
        const RELIC_BODY = 0xb8892f;
        const RELIC = 0xe2b552;
        const RELIC_LIGHT = 0xfbe9b0;
        const base: Mood = {
            body: BODY_COLOR, bodyOpacity: 1, edge: EDGE_COLOR, edgeOpacity: 0.7,
            pad: PRIMARY_COLOR, padOpacity: 0.9, rim: RIM_COLOR, rimOpacity: 1, hot: HOT_COLOR, hotOpacity: 1,
            bob: 1, spin: 1,
        };
        const climb = (c: number): Mood => ({ ...base, edgeOpacity: 0.6 + 0.2 * c, padOpacity: 0.84 + 0.12 * c });
        const MOODS: Record<string, Mood> = {
            SEVERED: {
                body: toward(BODY_COLOR, 0.75), bodyOpacity: 0.18, edge: toward(EDGE_COLOR, 0.7), edgeOpacity: 0.55, dashed: true,
                pad: toward(PRIMARY_COLOR, 0.75), padOpacity: 0.16, rim: toward(RIM_COLOR, 0.75), rimOpacity: 0.22,
                hot: HOT_COLOR, hotOpacity: 0, bob: 0, spin: 0,
            },
            STASIS: {
                body: toward(BODY_COLOR, 0.35), bodyOpacity: 0.38, edge: toward(EDGE_COLOR, 0.3), edgeOpacity: 0.5,
                pad: toward(PRIMARY_COLOR, 0.35), padOpacity: 0.35, rim: toward(RIM_COLOR, 0.35), rimOpacity: 0.45,
                hot: HOT_COLOR, hotOpacity: 0.4, bob: 0.1, spin: 0.1,
            },
            SEALED: { ...base, bodyOpacity: 0.55, edgeOpacity: 0.5, padOpacity: 0.45, rimOpacity: 0.55, hotOpacity: 0.5, bob: 0, spin: 0 },
            THRESHOLD: climb(0),
            TRIALS: climb(1 / 3),
            ASCENT: climb(2 / 3),
            CREST: climb(1),
            VIGIL: { ...climb(1), spin: 1.3, pulse: true },
            THRONE: {
                body: RELIC_BODY, bodyOpacity: 1, edge: RELIC_LIGHT, edgeOpacity: 0.95,
                pad: RELIC, padOpacity: 1, rim: RELIC, rimOpacity: 1, hot: RELIC_LIGHT, hotOpacity: 1,
                bob: 1, spin: 1, relicMotes: true,
            },
        };
        /** One floor's materials, from its mood. Faint parts are transparent and skip the depth
         *  write, so a ghostly isle does not cut holes in what is behind it. */
        const moodMaterials = (m: Mood) => {
            const see = (o: number) => ({ transparent: o < 1, opacity: o, depthWrite: o >= 1 });
            const mats = {
                body: new THREE.MeshBasicMaterial({ color: m.body, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...see(m.bodyOpacity) }),
                edge: m.dashed
                    ? new THREE.LineDashedMaterial({ color: m.edge, dashSize: 0.55, gapSize: 0.5, transparent: true, opacity: m.edgeOpacity })
                    : new THREE.LineBasicMaterial({ color: m.edge, transparent: true, opacity: m.edgeOpacity }),
                pad: new THREE.MeshBasicMaterial({ color: m.pad, transparent: true, opacity: m.padOpacity }),
                rim: new THREE.MeshBasicMaterial({ color: m.rim, ...see(m.rimOpacity) }),
                hot: new THREE.MeshBasicMaterial({ color: m.hot, ...see(m.hotOpacity) }),
            };
            disposables.push(mats.body, mats.edge, mats.pad, mats.rim, mats.hot);
            return mats;
        };

        // --- HELPERS ---
        const jitter = (g: THREE.BufferGeometry, a: number) => {
            const p = g.attributes.position;
            for (let k = 0; k < p.count; k++) {
                p.setXYZ(k, p.getX(k) + (Math.random() - 0.5) * a, p.getY(k) + (Math.random() - 0.5) * a, p.getZ(k) + (Math.random() - 0.5) * a);
            }
            return g;
        };
        // Faceted floating-rock chunk: flattened icosahedron pinched to a point underneath.
        const rockGeo = (s: number) => {
            const g = new THREE.IcosahedronGeometry(s, 1);
            g.scale(1.55, 0.62, 1.55);
            const p = g.attributes.position;
            const maxD = 0.62 * s;
            for (let k = 0; k < p.count; k++) {
                const y = p.getY(k);
                if (y < -0.05 * s) {
                    const f = Math.max(0, 1 - (-y / maxD) * 0.95);
                    p.setX(k, p.getX(k) * f);
                    p.setZ(k, p.getZ(k) * f);
                    p.setY(k, y * 2.1 - 0.3 * s);
                }
            }
            jitter(g, 0.28 * s);
            g.computeVertexNormals();
            return g;
        };
        // --- 1. THE ISLES (one per floor, on an ascending spiral) ---
        const floorObjects: {
            hitbox: THREE.Mesh;
            edges: THREE.LineSegments[];
            pad: THREE.Mesh;
            glyph: THREE.Mesh;
            label: THREE.Sprite;
            isle: THREE.Group;
            originalY: number;
            mood: Mood;
            edgeMat: THREE.Material;
            padMat: THREE.MeshBasicMaterial;
            relicMotes: THREE.Points | null;
        }[] = [];

        const isMobile = window.innerWidth < 768;

        for (let i = 0; i < TOWER_FLOORS; i++) {
            const t = i / (TOWER_FLOORS - 1);
            const yPos = (i * FLOOR_SPACING) - TOWER_OFFSET; // keep floor Y identical to old tower (focus-scroll math depends on it)
            const ang = i * SPIRAL_ANG;       // turn per floor -> reads as a spiral
            const rad = (1 - t) * 18 + 6;     // wide orbit so isles clearly swing around the spiral
            const s = 5.6 * (1.3 - t * 0.3);  // bigger isles; gentler taper so the top stays large

            const isle = new THREE.Group();
            isle.position.set(Math.cos(ang) * rad, yPos, Math.sin(ang) * rad);
            isle.rotation.y = Math.random() * Math.PI;

            const mood = MOODS[FLOOR_DEFS[i].label] ?? base;
            const mats = moodMaterials(mood);
            const edges: THREE.LineSegments[] = [];
            // Dashed lines are measured along their length; plain ones ignore the attribute.
            const edgeLines = (geo: THREE.BufferGeometry) => {
                const line = new THREE.LineSegments(geo, mats.edge);
                if (mood.dashed) line.computeLineDistances();
                return line;
            };

            // main floating rock
            const rGeo = rockGeo(s);
            isle.add(new THREE.Mesh(rGeo, mats.body));
            const rEdgeGeo = new THREE.EdgesGeometry(rGeo, 22);
            const rEdge = edgeLines(rEdgeGeo);
            isle.add(rEdge); edges.push(rEdge);
            disposables.push(rGeo, rEdgeGeo);

            // glowing hex pad (the clickable floor marker) + rim + floating glyph
            const padGeo = new THREE.CylinderGeometry(s * 0.42, s * 0.5, 0.5, 6);
            const pad = new THREE.Mesh(padGeo, mats.pad); pad.position.y = s * 0.55; isle.add(pad);
            const ringGeo = new THREE.TorusGeometry(s * 0.5, 0.09, 6, 6);
            const ring = new THREE.Mesh(ringGeo, mats.rim); ring.rotation.x = Math.PI / 2; ring.position.y = s * 0.62; isle.add(ring);
            const glyphGeo = new THREE.TorusGeometry(s * 0.22, 0.07, 6, 6);
            const glyph = new THREE.Mesh(glyphGeo, mats.hot); glyph.rotation.x = Math.PI / 2; glyph.position.y = s * 0.95; isle.add(glyph);
            glyph.visible = mood.hotOpacity > 0;
            disposables.push(padGeo, ringGeo, glyphGeo);

            // debris shards
            for (let d = 0; d < 3; d++) {
                const dGeo = jitter(new THREE.TetrahedronGeometry(s * 0.14 + Math.random() * s * 0.16), s * 0.1);
                dGeo.computeVertexNormals();
                const da = Math.random() * Math.PI * 2, dr = s * 1.05 + Math.random() * s * 0.7;
                const dPos = new THREE.Vector3(Math.cos(da) * dr, (Math.random() - 0.4) * s * 0.9, Math.sin(da) * dr);
                const dMesh = new THREE.Mesh(dGeo, mats.body); dMesh.position.copy(dPos); isle.add(dMesh);
                const dEdgeGeo = new THREE.EdgesGeometry(dGeo);
                const dEdge = edgeLines(dEdgeGeo); dEdge.position.copy(dPos); isle.add(dEdge); edges.push(dEdge);
                disposables.push(dGeo, dEdgeGeo);
            }

            // invisible hitbox around the isle (raycast target)
            const hitGeo = new THREE.SphereGeometry(s * 1.45, 12, 12);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            const hitbox = new THREE.Mesh(hitGeo, hitMat);
            hitbox.userData = { type: 'floor', index: i };
            isle.add(hitbox);
            disposables.push(hitGeo, hitMat);

            // --- FLOOR label sprite --- the progress-stage name, not a sector number.
            const text = FLOOR_DEFS[i].label;
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            let textWidth = 4000;
            if (tempCtx) {
                tempCtx.font = '900 400px "Orbitron", sans-serif';
                tempCtx.letterSpacing = "20px";
                textWidth = tempCtx.measureText(text).width;
            }
            const canvas = document.createElement('canvas');
            canvas.width = textWidth + 100;
            canvas.height = 1024;
            const drawLabel = (tex?: THREE.CanvasTexture) => {
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.font = '900 400px "Orbitron", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.letterSpacing = "20px";
                // theme-color-ok: drawn on a 2D canvas, which cannot read CSS variables
                const themeColor = isDark ? '#f59e0b' : '#5b21b6';
                if (isDark) {
                    ctx.lineWidth = 15;
                    ctx.strokeStyle = themeColor;
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.shadowBlur = 10;
                    ctx.shadowOffsetX = 4;
                    ctx.shadowOffsetY = 4;
                    ctx.strokeText(text, canvas.width / 2, 512);
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    ctx.fillText(text, canvas.width / 2, 512);
                } else {
                    // A pale capsule under the ink, the light theme's panel in miniature. Labels
                    // draw over the rock, and violet ink on the violet crystal faces vanished;
                    // a thin pale stroke was tried first, but at label size it blended with the
                    // ink into lavender. The capsule keeps the ink on its own ground.
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    const plateW = canvas.width - 20;
                    const plateH = 560;
                    const x0 = 10;
                    const y0 = 512 - plateH / 2;
                    ctx.fillStyle = 'rgba(251, 249, 255, 0.9)';
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(x0, y0, plateW, plateH, plateH / 2);
                    else ctx.rect(x0, y0, plateW, plateH);
                    ctx.fill();
                    ctx.fillStyle = '#4c1d95'; // theme-color-ok: canvas ink; violet-900 on the capsule
                    ctx.fillText(text, canvas.width / 2, 512);
                }
                if (tex) tex.needsUpdate = true;
            };
            drawLabel();
            const labelTex = new THREE.CanvasTexture(canvas);
            // Mipmapped: the 1024px-tall canvas lands at ~10px on screen, and plain linear
            // sampling at that ratio skipped most texels, so the letters shimmered and broke up.
            labelTex.minFilter = THREE.LinearMipmapLinearFilter;
            labelTex.generateMipmaps = true;
            labelTex.magFilter = THREE.LinearFilter;
            labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
            document.fonts.ready.then(() => { drawLabel(labelTex); });
            // The label is how a floor is read, so it draws over the rock rather than in the
            // scene's depth: the isles carry a random spin and the tower turns, which kept
            // parking a label behind a crystal ("…NT" for ASCENT). Each floor sits at its own
            // height, so labels on top of everything do not collide with one another.
            const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, opacity: 1.0, depthWrite: false, depthTest: false });
            const label = new THREE.Sprite(labelMat);
            label.renderOrder = 10;
            label.center.set(0, 0.5);
            label.position.set(s * 1.35 + 3, s * 0.4, 0);
            // `aspect` and `baseScale` feed the per-frame minimum size (see LABEL_MIN_PX).
            const scaleY = isMobile ? 3.5 : 5;
            label.userData = { type: 'floor', index: i, aspect: canvas.width / canvas.height, baseScale: scaleY };
            label.scale.set(scaleY * (canvas.width / canvas.height), scaleY, 1);
            isle.add(label);
            disposables.push(labelMat, labelTex);

            // The Throne's relic motes: a few gold sparks rising off its pad, in the isle's own
            // space so they ride its bob. Built after the moteTex below exists (see 4.).
            group.add(isle);
            floorObjects.push({ hitbox, edges, pad, glyph, label, isle, originalY: yPos, mood, edgeMat: mats.edge, padMat: mats.pad, relicMotes: null });
        }

        // --- 2. HUD GROUND GRID (radar disc) ---
        const gridGroup = new THREE.Group(); gridGroup.position.y = -TOWER_OFFSET - 12; group.add(gridGroup);
        for (let c = 1; c <= 5; c++) {
            const g2 = new THREE.TorusGeometry(c * 8, 0.06, 6, 80);
            const m2 = new THREE.MeshBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: Math.max(0.03, 0.16 - c * 0.025) });
            const rr = new THREE.Mesh(g2, m2); rr.rotation.x = Math.PI / 2; gridGroup.add(rr);
            disposables.push(g2, m2);
        }
        const gridLineMat = new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: 0.05 });
        for (let s2 = 0; s2 < 12; s2++) {
            const a = (s2 / 12) * Math.PI * 2;
            const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 40, 0, Math.sin(a) * 40)]);
            gridGroup.add(new THREE.Line(lg, gridLineMat));
            disposables.push(lg);
        }
        disposables.push(gridLineMat);

        // --- 4. RISING DATA-MOTES ---
        const MOTE_COUNT = 90;
        const moteGeo = new THREE.BufferGeometry();
        const motePos = new Float32Array(MOTE_COUNT * 3);
        const moteSpeeds: number[] = [];
        const moteTopY = ((TOWER_FLOORS - 1) * FLOOR_SPACING) - TOWER_OFFSET + 10;
        const moteBotY = -TOWER_OFFSET - 6;
        for (let k = 0; k < MOTE_COUNT; k++) {
            motePos[k * 3] = (Math.random() - 0.5) * 60;
            motePos[k * 3 + 1] = moteBotY + Math.random() * (moteTopY - moteBotY);
            motePos[k * 3 + 2] = (Math.random() - 0.5) * 40;
            moteSpeeds.push(2 + Math.random() * 4);
        }
        moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
        const moteTex = (() => {
            const cv = document.createElement('canvas'); cv.width = cv.height = 32;
            const x = cv.getContext('2d');
            if (x) { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); }
            return new THREE.CanvasTexture(cv);
        })();
        const moteMat = new THREE.PointsMaterial({ size: 1.9, map: moteTex, transparent: true, blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, opacity: isDark ? 0.9 : 0.55, color: isDark ? 0xffbe3d : 0xb9a5ec });
        const motes = new THREE.Points(moteGeo, moteMat);
        group.add(motes);
        disposables.push(moteGeo, moteTex, moteMat);

        // The Throne's relic motes (see FLOOR MOODS): gold, rising a short way off the pad and
        // fading as they go, then starting again. Each isle keeps its size (`s`) in scale terms:
        // the pad sits at 0.55 of it.
        const RELIC_MOTES = 14;
        const RELIC_RISE = 9;
        floorObjects.forEach((obj, i) => {
            if (!obj.mood.relicMotes) return;
            const t = i / (TOWER_FLOORS - 1);
            const s = 5.6 * (1.3 - t * 0.3);
            const g = new THREE.BufferGeometry();
            const p = new Float32Array(RELIC_MOTES * 3);
            const speeds: number[] = [];
            for (let k = 0; k < RELIC_MOTES; k++) {
                const a = Math.random() * Math.PI * 2, r = Math.random() * s * 0.55;
                p[k * 3] = Math.cos(a) * r;
                p[k * 3 + 1] = s * 0.6 + Math.random() * RELIC_RISE;
                p[k * 3 + 2] = Math.sin(a) * r;
                speeds.push(1.6 + Math.random() * 1.8);
            }
            g.setAttribute('position', new THREE.BufferAttribute(p, 3));
            g.userData = { floorY: s * 0.6, speeds };
            // On the light page additive gold would vanish into the pale ground; it draws
            // normally there, a shade deeper, so it still reads as gold.
            const m = new THREE.PointsMaterial({
                size: 1.25, map: moteTex, transparent: true, depthWrite: false,
                blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
                color: isDark ? RELIC : RELIC_BODY, opacity: isDark ? 0.95 : 0.85,
            });
            const pts = new THREE.Points(g, m);
            obj.isle.add(pts);
            obj.relicMotes = pts;
            disposables.push(g, m);
        });

        // --- SCROLL / CAMERA / TOUCH LOGIC ---
        const getZoomLevels = () => {
            const w = mountRef.current?.clientWidth || window.innerWidth;
            const hh = mountRef.current?.clientHeight || window.innerHeight;
            const aspect = w / hh;
            if (w < 768) {
                return {
                    far: aspect < 1 ? 172 : 130,
                    close: aspect < 1 ? 82 : 62,
                };
            } else if (w < 1280) {
                return {
                    far: aspect < 1 ? 178 : 124,
                    close: aspect < 1 ? 76 : 58,
                };
            } else {
                return {
                    far: 120,
                    close: 54,
                };
            }
        };

        // Camera pans between the base grid and the apex core; starts centred on the isles.
        const centerY = ((TOWER_FLOORS - 1) * FLOOR_SPACING - 2 * TOWER_OFFSET) / 2;
        let scrollY = centerY;
        const minScroll = -TOWER_OFFSET - 10;
        const maxScroll = ((TOWER_FLOORS - 1) * FLOOR_SPACING) - TOWER_OFFSET + 12;
        let targetScrollY = centerY;

        const initialZoom = getZoomLevels();
        let zPos = initialZoom.far;
        let targetZ = initialZoom.far;
        camera.position.set(0, centerY, initialZoom.far);
        camera.lookAt(0, centerY, 0);

        let focusedFloorIndex = -1;

        // Reusable floor detection at any viewport point (used by mouse and touch)
        const getFloorAtPoint = (clientX: number, clientY: number): THREE.Object3D | null => {
            const m = mountRef.current;
            if (!m) return null;
            const rect = m.getBoundingClientRect();
            const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
            const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
            const pt = new THREE.Vector2(nx, ny);
            raycaster.setFromCamera(pt, camera);
            const targets: THREE.Object3D[] = [];
            floorObjects.forEach(f => {
                targets.push(f.hitbox);
                targets.push(f.label);
            });
            const intersects = raycaster.intersectObjects(targets);
            return intersects.length > 0 ? intersects[0].object : null;
        };

        const selectOrFocusFloor = (floorIndex: number) => {
            const floorY = (floorIndex * FLOOR_SPACING) - TOWER_OFFSET;
            if (focusedFloorIndex === floorIndex) {
                onSelectFloorRef.current(floorIndex);
            } else {
                targetScrollY = floorY;
                focusedFloorIndex = floorIndex;
                targetZ = getZoomLevels().close;
                // Rotate this isle to front-centre (world x≈0, nearest the camera) so the
                // zoom lands on it instead of the empty central axis.
                let want = Math.PI / 2 - (floorIndex * SPIRAL_ANG);
                want += Math.round((currentRotY - want) / (Math.PI * 2)) * (Math.PI * 2);
                targetRotationY = want;
                if (onFocus) onFocus(true, floorIndex);
            }
        };

        const unfocus = () => {
            if (focusedFloorIndex !== -1) {
                focusedFloorIndex = -1;
                if (onFocus) onFocus(false);
                targetZ = getZoomLevels().far;
            }
        };

        // --- MOUSE HANDLERS ---
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            targetScrollY -= e.deltaY * 0.05;
            targetScrollY = Math.max(minScroll, Math.min(maxScroll, targetScrollY));
            if (focusedFloorIndex !== -1) {
                unfocus();
            }
        };

        const handleDown = (e: MouseEvent) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
        };

        const handleUp = (e: MouseEvent) => {
            if (!isDragging) return;
            isDragging = false;
            const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
            if (dist < 6) {
                const hitFloor = hoveredFloor || getFloorAtPoint(e.clientX, e.clientY);
                if (hitFloor) {
                    selectOrFocusFloor(hitFloor.userData.index);
                } else {
                    unfocus();
                }
            }
        };

        let lastMoveTime = 0;
        const handleMove = (e: MouseEvent) => {
            const now = performance.now();
            if (now - lastMoveTime < 16) return;
            lastMoveTime = now;
            const m = mountRef.current;
            if (!m) return;
            const rect = m.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            if (isDragging) {
                targetRotationY += e.movementX * 0.005;
                targetScrollY += e.movementY * 0.1;
                targetScrollY = Math.max(minScroll, Math.min(maxScroll, targetScrollY));
                if (Math.abs(e.movementY) > 0) {
                    if (focusedFloorIndex !== -1) unfocus();
                }
            }
        };

        // --- TOUCH HANDLERS (Phones & iPads) ---
        let isTouchDragging = false;
        let isPinching = false;
        let touchStartX = 0;
        let touchStartY = 0;
        let lastTouchX = 0;
        let lastTouchY = 0;
        let touchStartTime = 0;
        let lastPinchDist = 0;
        let lastPinchMidY = 0;

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                isTouchDragging = true;
                isPinching = false;
                touchStartX = t.clientX;
                touchStartY = t.clientY;
                lastTouchX = t.clientX;
                lastTouchY = t.clientY;
                touchStartTime = performance.now();
            } else if (e.touches.length === 2) {
                isPinching = true;
                isTouchDragging = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastPinchDist = Math.hypot(dx, dy);
                lastPinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (isPinching && e.touches.length === 2) {
                if (e.cancelable) e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const pinchDelta = dist - lastPinchDist;
                lastPinchDist = dist;

                const zoomLevels = getZoomLevels();
                // Pinch spread (dist increases) -> zoom closer (targetZ decreases)
                // Pinch together (dist decreases) -> zoom farther (targetZ increases)
                targetZ -= pinchDelta * 0.45;
                targetZ = Math.max(zoomLevels.close - 15, Math.min(zoomLevels.far + 40, targetZ));

                // Two-finger vertical pan
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const deltaMidY = midY - lastPinchMidY;
                lastPinchMidY = midY;
                targetScrollY += deltaMidY * 0.12;
                targetScrollY = Math.max(minScroll, Math.min(maxScroll, targetScrollY));
                return;
            }

            if (isTouchDragging && e.touches.length === 1) {
                if (e.cancelable) e.preventDefault();
                const t = e.touches[0];
                const dx = t.clientX - lastTouchX;
                const dy = t.clientY - lastTouchY;
                lastTouchX = t.clientX;
                lastTouchY = t.clientY;

                // Rotate and scroll
                targetRotationY += dx * 0.007;
                targetScrollY += dy * 0.12;
                targetScrollY = Math.max(minScroll, Math.min(maxScroll, targetScrollY));

                if (Math.abs(dy) > 1.2 && focusedFloorIndex !== -1) {
                    unfocus();
                }
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (isPinching) {
                if (e.touches.length === 0) {
                    isPinching = false;
                } else if (e.touches.length === 1) {
                    isPinching = false;
                    isTouchDragging = true;
                    lastTouchX = e.touches[0].clientX;
                    lastTouchY = e.touches[0].clientY;
                }
                return;
            }

            if (isTouchDragging) {
                isTouchDragging = false;
                const t = e.changedTouches[0];
                if (!t) return;
                const totalDist = Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY);
                const duration = performance.now() - touchStartTime;

                // Tap registered (minimal movement within brief time)
                if (totalDist < 14 && duration < 600) {
                    const hitFloor = getFloorAtPoint(t.clientX, t.clientY);
                    if (hitFloor) {
                        selectOrFocusFloor(hitFloor.userData.index);
                    } else {
                        unfocus();
                    }
                }
            }
        };

        const handleTouchCancel = () => {
            isTouchDragging = false;
            isPinching = false;
        };

        const handleBlur = () => {
            isDragging = false;
            isTouchDragging = false;
            isPinching = false;
        };

        const canvasEl = renderer.domElement;
        canvasEl.style.touchAction = 'none';
        canvasEl.style.userSelect = 'none';
        canvasEl.style.webkitUserSelect = 'none';

        canvasEl.addEventListener('wheel', handleWheel, { passive: false });
        canvasEl.addEventListener('mousedown', handleDown);
        // Capture phase: these fire before any overlay panel can stopPropagation, so a drag
        // continues over the side panels and a mouseup ALWAYS clears the drag (no stuck drag).
        window.addEventListener('mouseup', handleUp, true);
        window.addEventListener('mousemove', handleMove, true);

        canvasEl.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { passive: false });
        window.addEventListener('touchcancel', handleTouchCancel, { passive: true });
        window.addEventListener('blur', handleBlur);

        const handleResize = () => {
            if (!mountRef.current || !renderer || !camera) return;
            const w = mountRef.current.clientWidth || window.innerWidth;
            const hh = mountRef.current.clientHeight || window.innerHeight;
            const aspect = w / hh;
            renderer.setSize(w, hh);
            camera.aspect = aspect;
            const zoomLevels = getZoomLevels();
            if (w < 768) {
                camera.fov = aspect < 1 ? 75 : 50;
            } else if (w < 1280) {
                camera.fov = aspect < 1 ? 80 : 66;
            } else {
                camera.fov = 65;
            }
            if (focusedFloorIndex === -1) {
                targetZ = zoomLevels.far;
            } else {
                targetZ = zoomLevels.close;
            }
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        // --- ANIMATION ---
        const clock = new THREE.Clock();
        let frameId: number;
        const reduceMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const AUTO_SPIN_SPEED = reduceMotion ? 0 : 0.05;
        // Minimum on-screen height of a floor label's sprite. The letters fill ~27% of it
        // (400px Orbitron caps on a 1024px canvas), so 40px gives ~11px capitals.
        const LABEL_MIN_PX = 40;
        const tempVec = new THREE.Vector3();

        const animate = () => {
            frameId = requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.1);
            if (isPausedRef.current || document.hidden) return;

            // Rotation (auto + damped). Auto-spin halts while a floor is focused or dragged so the
            // centred isle stays put and stays clickable.
            if (!isDragging && !isTouchDragging && !isPinching && focusedFloorIndex === -1) {
                targetRotationY += AUTO_SPIN_SPEED * dt;
            }
            const damp = Math.min(1.0, dt * 4.0);
            currentRotY += (targetRotationY - currentRotY) * damp;
            group.rotation.y = currentRotY;

            // Camera scroll & zoom
            scrollY += (targetScrollY - scrollY) * damp;
            zPos += (targetZ - zPos) * damp;
            camera.position.y = scrollY;
            camera.position.z = zPos;
            camera.lookAt(0, scrollY, 0);

            // Ambient life (skipped under reduced motion)
            if (!reduceMotion) {
                const et = clock.getElapsedTime();
                floorObjects.forEach((obj, k) => {
                    // Each floor at its mood's pace (constant per floor, so scaling time keeps
                    // the wave continuous).
                    obj.isle.position.y = obj.originalY + Math.sin(et * 0.6 * obj.mood.bob + k) * 0.8 * Math.min(1, obj.mood.bob * 4);
                    obj.glyph.rotation.z += dt * 0.5 * obj.mood.spin;
                    // The Vigil's pad breathes, slowly: on watch for the next chapter.
                    if (obj.mood.pulse) obj.padMat.opacity = obj.mood.padOpacity - 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(et * 2.2));
                    if (obj.relicMotes) {
                        const rp = obj.relicMotes.geometry.attributes.position;
                        const { floorY, speeds } = obj.relicMotes.geometry.userData as { floorY: number; speeds: number[] };
                        for (let q = 0; q < RELIC_MOTES; q++) {
                            let y = rp.getY(q) + speeds[q] * dt;
                            if (y > floorY + RELIC_RISE) y = floorY;
                            rp.setY(q, y);
                        }
                        rp.needsUpdate = true;
                    }
                });
                const mp = motes.geometry.attributes.position;
                for (let k = 0; k < MOTE_COUNT; k++) {
                    let y = mp.getY(k) + moteSpeeds[k] * dt;
                    if (y > moteTopY) y = moteBotY;
                    mp.setY(k, y);
                }
                mp.needsUpdate = true;
            }

            // World units per screen pixel at the tower's depth, for the label floor.
            const viewW = mountRef.current?.clientWidth || window.innerWidth;
            const worldPerPx = (2 * zPos * Math.tan((camera.fov * Math.PI) / 360)) / (mountRef.current?.clientHeight || window.innerHeight);
            const LABEL_EDGE_PX = 8;

            // Hover styling & focus highlight
            floorObjects.forEach((obj, idx) => {
                const isHover = (obj.hitbox === hoveredFloor) || (focusedFloorIndex === idx);
                obj.edges.forEach(e => { e.material = isHover ? edgeHoverMat : obj.edgeMat; });
                obj.pad.material = isHover ? padHoverMat : obj.padMat;
                obj.label.material.opacity = isHover ? 1 : 0.8;
                // Never smaller than LABEL_MIN_PX on screen: a fixed world size let the names
                // shrink to ~4px letters at tablet widths, where the camera sits far back.
                const { aspect, baseScale } = obj.label.userData;
                const sy = Math.max(baseScale, LABEL_MIN_PX * worldPerPx);
                obj.label.scale.set(sy * aspect, sy, 1);
                obj.label.getWorldPosition(tempVec);
                // Lean outward from the spiral's centre (the original anchor), then clamp so
                // the whole label stays on screen: at the larger phone sizes the far-left and
                // far-right names ran off the edge.
                const preferred = Math.max(0, Math.min(1, 0.5 - (tempVec.x / 36)));
                const labelPx = (sy * aspect) / worldPerPx;
                const posPx = ((tempVec.project(camera).x + 1) / 2) * viewW;
                const minA = (posPx + labelPx - (viewW - LABEL_EDGE_PX)) / labelPx; // keeps the right edge in
                const maxA = (posPx - LABEL_EDGE_PX) / labelPx;                      // keeps the left edge in
                const anchorX = minA > maxA ? 0.5 : Math.max(minA, Math.min(maxA, preferred));
                obj.label.center.set(Math.max(0, Math.min(1, anchorX)), 0.5);
            });

            // Raycast
            raycaster.setFromCamera(mouse, camera);
            const floorIntersects = raycaster.intersectObjects(floorObjects.map(f => f.hitbox));
            hoveredFloor = floorIntersects.length > 0 ? floorIntersects[0].object : null;
            const towerIntersects = raycaster.intersectObjects(group.children, true);
            isHoveringTower = towerIntersects.length > 0;

            if (mountRef.current) {
                if (isDragging || isTouchDragging) mountRef.current.style.cursor = 'grabbing';
                else if (hoveredFloor) mountRef.current.style.cursor = 'pointer';
                else if (isHoveringTower) mountRef.current.style.cursor = 'grab';
                else mountRef.current.style.cursor = 'default';
            }

            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('mouseup', handleUp, true);
            window.removeEventListener('mousemove', handleMove, true);
            window.removeEventListener('resize', handleResize);
            if (renderer && renderer.domElement) {
                renderer.domElement.removeEventListener('mousedown', handleDown);
                renderer.domElement.removeEventListener('wheel', handleWheel);
                renderer.domElement.removeEventListener('touchstart', handleTouchStart);
            }
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchCancel);
            window.removeEventListener('blur', handleBlur);
            if (mount && renderer.domElement && mount.contains(renderer.domElement)) {
                mount.removeChild(renderer.domElement);
            }
            disposables.forEach(d => {
                if ('dispose' in d && typeof d.dispose === 'function') d.dispose();
            });
            renderer.forceContextLoss();
            renderer.dispose();
            // @ts-expect-error deliberately clearing a non-nullable field to release the canvas
            renderer.domElement = null;
        };
        // Scoped to `theme` on purpose — rebuilding the whole WebGL scene on every
        // items/callback change would thrash the context. Those are read via refs/closures.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [theme]);

    return <div ref={mountRef} className="absolute inset-0 w-full h-full touch-none select-none overflow-hidden" />;
};

export default TowerStructure;
