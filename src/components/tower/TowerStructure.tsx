import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

// Divine Spire 8.0: Holographic ascending isles.
// A spiral of translucent faceted islands (bright wireframe edges) climbing toward a
// radiant System core, over a faint HUD ground grid — the reference "Tower of God" spire
// rendered in the site's amber (dark) / cyan (light) hologram language.
// Each island's glowing hex pad is a clickable floor; all mechanics from the previous
// tower (raycast focus/open, drag-rotate, wheel, pause, reduced-motion) are preserved.

interface TowerStructureProps {
    onSelectFloor: (floorIndex: number) => void;
    theme: { isDark: boolean };
    onFocus?: (isFocused: boolean, floorIndex?: number) => void;
    items?: any[]; // Pass items to detect empty floors
    itemsPerFloor?: number;
    isPaused?: boolean;
}

const TowerStructure: React.FC<TowerStructureProps> = ({ onSelectFloor, theme, onFocus, items = [], itemsPerFloor = 5, isPaused = false }) => {
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

        // --- THEME (matched to the site's accent tokens: amber-500 #f59e0b / cyan-500 #06b6d4) ---
        const isDark = theme.isDark;
        const PRIMARY_COLOR = isDark ? 0xf59e0b : 0x06b6d4; // amber-500 / cyan-500 (accentColor)
        const HOVER_COLOR = isDark ? 0xffffff : 0x0e7490;   // white / cyan-700
        const BODY_COLOR = isDark ? 0xd6891a : 0x0e9ec4;    // rich amber / vibrant cyan platform fill
        const EDGE_COLOR = isDark ? 0xfbbf24 : 0x22d3ee;    // amber-400 / cyan-400 (bright hologram edge)
        const RIM_COLOR = isDark ? 0xfacc15 : 0x06b6d4;     // yellow-400 / cyan-500 (neon rim)
        const HOT_COLOR = isDark ? 0xfff7e0 : 0xcffafe;     // pale amber / cyan-100 (hot core)

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
        const bodyMat = new THREE.MeshBasicMaterial({ color: BODY_COLOR, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const edgeMat = new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: 0.7 });
        const edgeHoverMat = new THREE.LineBasicMaterial({ color: HOVER_COLOR, transparent: true, opacity: 1.0 });
        const padMat = new THREE.MeshBasicMaterial({ color: PRIMARY_COLOR, transparent: true, opacity: 0.9 });
        const padHoverMat = new THREE.MeshBasicMaterial({ color: HOVER_COLOR, transparent: true, opacity: 1.0 });
        const rimMat = new THREE.MeshBasicMaterial({ color: RIM_COLOR });
        const hotMat = new THREE.MeshBasicMaterial({ color: HOT_COLOR });
        disposables.push(bodyMat, edgeMat, edgeHoverMat, padMat, padHoverMat, rimMat, hotMat);

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
            isEmpty: boolean;
        }[] = [];

        const isMobile = window.innerWidth < 768;

        for (let i = 0; i < 8; i++) {
            const t = i / 7;
            const yPos = (i * FLOOR_SPACING) - TOWER_OFFSET; // keep floor Y identical to old tower (focus-scroll math depends on it)
            const ang = i * SPIRAL_ANG;       // turn per floor -> reads as a spiral
            const rad = (1 - t) * 18 + 6;     // wide orbit so isles clearly swing around the spiral
            const s = 5.6 * (1.3 - t * 0.3);  // bigger isles; gentler taper so the top stays large

            const isle = new THREE.Group();
            isle.position.set(Math.cos(ang) * rad, yPos, Math.sin(ang) * rad);
            isle.rotation.y = Math.random() * Math.PI;

            const isEmpty = items.slice(i * itemsPerFloor, (i + 1) * itemsPerFloor).length === 0;
            const edges: THREE.LineSegments[] = [];

            // main floating rock
            const rGeo = rockGeo(s);
            isle.add(new THREE.Mesh(rGeo, bodyMat));
            const rEdgeGeo = new THREE.EdgesGeometry(rGeo, 22);
            const rEdge = new THREE.LineSegments(rEdgeGeo, edgeMat);
            isle.add(rEdge); edges.push(rEdge);
            disposables.push(rGeo, rEdgeGeo);

            // glowing hex pad (the clickable floor marker) + rim + floating glyph
            const padGeo = new THREE.CylinderGeometry(s * 0.42, s * 0.5, 0.5, 6);
            const pad = new THREE.Mesh(padGeo, padMat); pad.position.y = s * 0.55; isle.add(pad);
            const ringGeo = new THREE.TorusGeometry(s * 0.5, 0.09, 6, 6);
            const ring = new THREE.Mesh(ringGeo, rimMat); ring.rotation.x = Math.PI / 2; ring.position.y = s * 0.62; isle.add(ring);
            const glyphGeo = new THREE.TorusGeometry(s * 0.22, 0.07, 6, 6);
            const glyph = new THREE.Mesh(glyphGeo, hotMat); glyph.rotation.x = Math.PI / 2; glyph.position.y = s * 0.95; isle.add(glyph);
            disposables.push(padGeo, ringGeo, glyphGeo);

            // debris shards
            for (let d = 0; d < 3; d++) {
                const dGeo = jitter(new THREE.TetrahedronGeometry(s * 0.14 + Math.random() * s * 0.16), s * 0.1);
                dGeo.computeVertexNormals();
                const da = Math.random() * Math.PI * 2, dr = s * 1.05 + Math.random() * s * 0.7;
                const dPos = new THREE.Vector3(Math.cos(da) * dr, (Math.random() - 0.4) * s * 0.9, Math.sin(da) * dr);
                const dMesh = new THREE.Mesh(dGeo, bodyMat); dMesh.position.copy(dPos); isle.add(dMesh);
                const dEdgeGeo = new THREE.EdgesGeometry(dGeo);
                const dEdge = new THREE.LineSegments(dEdgeGeo, edgeMat); dEdge.position.copy(dPos); isle.add(dEdge); edges.push(dEdge);
                disposables.push(dGeo, dEdgeGeo);
            }

            // invisible hitbox around the isle (raycast target)
            const hitGeo = new THREE.SphereGeometry(s * 1.35, 12, 12);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            const hitbox = new THREE.Mesh(hitGeo, hitMat);
            hitbox.userData = { type: 'floor', index: i };
            isle.add(hitbox);
            disposables.push(hitGeo, hitMat);

            // --- SECTOR label sprite ---
            const sectorNum = (i + 1).toString().padStart(2, '0');
            const text = `SECTOR ${sectorNum}`;
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
                const themeColor = isDark ? '#f59e0b' : '#0e7490';
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
                    ctx.fillStyle = themeColor;
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.fillText(text, canvas.width / 2, 512);
                }
                if (tex) tex.needsUpdate = true;
            };
            drawLabel();
            const labelTex = new THREE.CanvasTexture(canvas);
            labelTex.minFilter = THREE.LinearFilter;
            labelTex.magFilter = THREE.LinearFilter;
            labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
            document.fonts.ready.then(() => { drawLabel(labelTex); });
            const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, opacity: 1.0, depthWrite: false });
            const label = new THREE.Sprite(labelMat);
            label.center.set(0, 0.5);
            label.position.set(s * 1.35 + 3, s * 0.4, 0);
            const scaleY = isMobile ? 3.5 : 5;
            label.scale.set(scaleY * (canvas.width / canvas.height), scaleY, 1);
            isle.add(label);
            disposables.push(labelMat, labelTex);

            group.add(isle);
            floorObjects.push({ hitbox, edges, pad, glyph, label, isle, originalY: yPos, isEmpty });
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
        const moteTopY = (7 * FLOOR_SPACING) - TOWER_OFFSET + 10;
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
        const moteMat = new THREE.PointsMaterial({ size: 1.9, map: moteTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9, color: isDark ? 0xffbe3d : 0x2fd6ec });
        const motes = new THREE.Points(moteGeo, moteMat);
        group.add(motes);
        disposables.push(moteGeo, moteTex, moteMat);

        // --- SCROLL / CAMERA LOGIC ---
        // Camera pans between the base grid and the apex core; starts centred on the isles.
        const centerY = (7 * FLOOR_SPACING - 2 * TOWER_OFFSET) / 2;
        let scrollY = centerY;
        const minScroll = -TOWER_OFFSET - 10;
        const maxScroll = (7 * FLOOR_SPACING) - TOWER_OFFSET + 12;
        let targetScrollY = centerY;

        let zPos = 120;
        let targetZ = 120;
        const ZOOM_CLOSE = 54;
        const ZOOM_FAR = 120;

        let focusedFloorIndex = -1;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            targetScrollY -= e.deltaY * 0.05;
            targetScrollY = Math.max(minScroll, Math.min(maxScroll, targetScrollY));
            if (focusedFloorIndex !== -1) {
                focusedFloorIndex = -1;
                if (onFocus) onFocus(false);
                targetZ = ZOOM_FAR;
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
            const dist = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
            if (dist < 5) {
                if (hoveredFloor) {
                    const floorIndex = hoveredFloor.userData.index;
                    const floorY = (floorIndex * FLOOR_SPACING) - TOWER_OFFSET;
                    if (focusedFloorIndex === floorIndex) {
                        onSelectFloorRef.current(floorIndex);
                    } else {
                        targetScrollY = floorY;
                        focusedFloorIndex = floorIndex;
                        targetZ = ZOOM_CLOSE;
                        // Rotate this isle to front-centre (world x≈0, nearest the camera) so the
                        // zoom lands on it instead of the empty central axis.
                        let want = Math.PI / 2 - (floorIndex * SPIRAL_ANG);
                        want += Math.round((currentRotY - want) / (Math.PI * 2)) * (Math.PI * 2);
                        targetRotationY = want;
                        if (onFocus) onFocus(true, floorIndex);
                    }
                } else {
                    if (focusedFloorIndex !== -1) {
                        focusedFloorIndex = -1;
                        if (onFocus) onFocus(false);
                        targetZ = ZOOM_FAR;
                    }
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
                    if (focusedFloorIndex !== -1 && onFocus) onFocus(false);
                    focusedFloorIndex = -1;
                    targetZ = ZOOM_FAR;
                }
            }
        };

        const handleTouchStart = () => { isDragging = true; };
        const handleTouchEnd = () => { isDragging = false; };
        const handleBlur = () => { isDragging = false; };

        const canvasEl = renderer.domElement;
        canvasEl.addEventListener('wheel', handleWheel, { passive: false });
        canvasEl.addEventListener('mousedown', handleDown);
        // Capture phase: these fire before any overlay panel can stopPropagation, so a drag
        // continues over the side panels and a mouseup ALWAYS clears the drag (no stuck drag).
        window.addEventListener('mouseup', handleUp, true);
        window.addEventListener('mousemove', handleMove, true);
        canvasEl.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('blur', handleBlur);

        const handleResize = () => {
            if (!mountRef.current || !renderer || !camera) return;
            const w = mountRef.current.clientWidth;
            const hh = mountRef.current.clientHeight;
            const aspect = w / hh;
            renderer.setSize(w, hh);
            camera.aspect = aspect;
            if (w < 768) {
                if (aspect < 1) { camera.fov = 75; targetZ = 172; }
                else { camera.fov = 50; targetZ = 130; }
            } else if (w < 1280) {
                if (aspect < 1) { camera.fov = 80; targetZ = 178; }
                else { camera.fov = 66; targetZ = 124; }
            } else {
                camera.fov = 65; targetZ = 120;
            }
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', handleResize);

        // --- ANIMATION ---
        const clock = new THREE.Clock();
        let frameId: number;
        const reduceMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const AUTO_SPIN_SPEED = reduceMotion ? 0 : 0.05;
        const tempVec = new THREE.Vector3();

        const animate = () => {
            frameId = requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.1);
            if (isPausedRef.current || document.hidden) return;

            // Rotation (auto + damped). Auto-spin halts while a floor is focused so the
            // centred isle stays put and stays clickable.
            if (!isDragging && focusedFloorIndex === -1) targetRotationY += AUTO_SPIN_SPEED * dt;
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
                    obj.isle.position.y = obj.originalY + Math.sin(et * 0.6 + k) * 0.8;
                    obj.glyph.rotation.z += dt * 0.5;
                });
                const mp = motes.geometry.attributes.position;
                for (let k = 0; k < MOTE_COUNT; k++) {
                    let y = mp.getY(k) + moteSpeeds[k] * dt;
                    if (y > moteTopY) y = moteBotY;
                    mp.setY(k, y);
                }
                mp.needsUpdate = true;
            }

            // Hover styling
            floorObjects.forEach((obj) => {
                const isHover = (obj.hitbox === hoveredFloor);
                obj.edges.forEach(e => { e.material = isHover ? edgeHoverMat : edgeMat; });
                obj.pad.material = isHover ? padHoverMat : padMat;
                obj.label.material.opacity = isHover ? 1 : 0.8;
                obj.label.getWorldPosition(tempVec);
                const anchorX = Math.max(0, Math.min(1, 0.5 - (tempVec.x / 36)));
                obj.label.center.set(anchorX, 0.5);
            });

            // Raycast
            raycaster.setFromCamera(mouse, camera);
            const floorIntersects = raycaster.intersectObjects(floorObjects.map(f => f.hitbox));
            hoveredFloor = floorIntersects.length > 0 ? floorIntersects[0].object : null;
            const towerIntersects = raycaster.intersectObjects(group.children, true);
            isHoveringTower = towerIntersects.length > 0;

            if (mountRef.current) {
                if (isDragging) mountRef.current.style.cursor = 'grabbing';
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
            window.removeEventListener('touchend', handleTouchEnd);
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

    return <div ref={mountRef} className="w-full h-full min-h-[500px]" />;
};

export default TowerStructure;
