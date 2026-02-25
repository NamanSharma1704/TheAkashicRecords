import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

// Tower 7.0: Holographic Schematic based on user reference
// Reference: Amber wireframe, grid floors, floating panels, vertical spine.

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

    // Keep ref in sync with prop
    useEffect(() => {
        onSelectFloorRef.current = onSelectFloor;
    }, [onSelectFloor]);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
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

        // --- THEME ---
        const isDark = theme.isDark;

        // Dark Mode: Bright Gold/Amber Hologram on Black
        // Light Mode: Cyan Hologram on White
        const PRIMARY_COLOR = isDark ? 0xffd700 : 0x0ea5e9; // Gold (Bright) vs Sky-500
        const SECONDARY_COLOR = isDark ? 0xffed4a : 0x38bdf8; // Yellow-300 vs Sky-400
        const HOVER_COLOR = isDark ? 0xffffff : 0x0284c7; // White vs Sky-600

        // --- SCENE ---
        const scene = new THREE.Scene();
        scene.background = null; // Transparent background to show app layers
        // Fog removed for transparency

        // --- LIGHTING ---
        // Boosted Saturation for "THE DIVINE" Reference
        const ambientLight = new THREE.AmbientLight(isDark ? 0xffaa00 : 0xffffff, isDark ? 2.0 : 1.5); // Amber Ambient in Dark Mode
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, isDark ? 3.0 : 2.0); // White Highlights on Gold
        dirLight.position.set(10, 20, 10);
        scene.add(dirLight);

        const pointLight = new THREE.PointLight(isDark ? 0xff8800 : 0x0ea5e9, isDark ? 4.0 : 1.5, 100); // Deep Orange Core Glow
        pointLight.position.set(0, 10, 10);
        scene.add(pointLight);

        // --- CAMERA ---
        const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        camera.position.set(0, 5, 100); // Initial position matches new defaults (Centered, Zoomed in)
        camera.lookAt(0, 5, 0);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Performance Cap
        mount.appendChild(renderer.domElement);

        const group = new THREE.Group();
        scene.add(group);

        // --- TEXTURES ---
        const generateGradientTexture = (dark: boolean) => {
            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            if (!ctx) return new THREE.Texture();

            const gradient = ctx.createLinearGradient(0, 64, 0, 0); // Bottom to Top

            if (dark) {
                // Dark Mode: MATCH REFERENCE IMAGE "THE DIVINE"
                // Deep Orange/Copper -> Rich Amber -> Vibrant Yellow (NO WHITE)
                gradient.addColorStop(0, '#ea580c'); // Orange-600 (Deep Copper Base)
                gradient.addColorStop(0.4, '#f59e0b'); // Amber-500 (Rich Gold)
                gradient.addColorStop(0.8, '#facc15'); // Yellow-400 (Bright Gold)
                gradient.addColorStop(1, '#fde047'); // Yellow-300 (Vibrant Tip - NO WHITE)
            } else {
                // Light Mode Text Gradient: from-sky-600 via-cyan-400 to-indigo-200
                gradient.addColorStop(0, '#0284c7'); // Sky-600
                gradient.addColorStop(0.5, '#22d3ee'); // Cyan-400
                gradient.addColorStop(1, '#c7d2fe'); // Indigo-200
            }

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 64, 64);

            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace; // Ensure vibrant colors
            tex.needsUpdate = true;
            return tex;
        };

        const gradientTex = generateGradientTexture(isDark);
        disposables.push(gradientTex);

        // --- MATERIALS ---
        const wireMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, // White base
            map: gradientTex,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1, // Pull forward
            polygonOffsetUnits: -1,
        });

        // 1. SIDE/GRADIENT MATERIAL (Bright Phong)
        const solidMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: gradientTex,
            transparent: false,
            opacity: 1.0,
            side: THREE.FrontSide, // Solid object
            emissive: isDark ? 0xaa4400 : 0x000000,
            emissiveIntensity: isDark ? 0.6 : 0.0,
            specular: isDark ? 0xffc107 : 0x444444,
            shininess: isDark ? 80 : 30,
            flatShading: false,
            depthWrite: true, // Ensure it occludes objects behind it
        });

        // 2. CAP MATERIAL (Solid Gold Top/Bottom - No Texture)
        const capMat = new THREE.MeshPhongMaterial({
            color: isDark ? 0xffd700 : 0xbae6fd, // Gold vs Sky
            transparent: false,
            opacity: 1.0,
            side: THREE.FrontSide,
            emissive: isDark ? 0xaa4400 : 0x000000, // Matching Glow
            emissiveIntensity: 0.6,
            specular: isDark ? 0xffffff : 0x444444,
            shininess: 60,
            flatShading: false,
            depthWrite: true, // Ensure it occludes objects behind it
        });

        // 3. PANEL MATERIALS (Split for Inside/Outside control)
        // INNER SIDE (FrontSide looking at 0,0,0) -> Make it DARKER
        const panelMatInner = new THREE.MeshPhongMaterial({
            color: 0x888888, // Darker base
            map: gradientTex,
            transparent: false,
            opacity: 1.0,
            side: THREE.FrontSide,
            emissive: isDark ? 0xaa4400 : 0x000000,
            emissiveIntensity: isDark ? 0.2 : 0.0, // Low emission inside
            specular: 0x111111, // Low specular
            shininess: 10,
            flatShading: false,
        });

        // OUTER SIDE (BackSide facing away) -> Make it BRIGHTER
        const panelMatOuter = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: gradientTex,
            transparent: false,
            opacity: 1.0,
            side: THREE.BackSide,
            emissive: isDark ? 0xffaa00 : 0x000000,
            emissiveIntensity: isDark ? 1.5 : 0.0, // High emission outside
            specular: isDark ? 0xffea00 : 0x444444,
            shininess: 100, // High shine
            flatShading: false,
        });

        const activeWireMat = new THREE.MeshBasicMaterial({
            color: HOVER_COLOR,
            wireframe: true,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
        });

        const pillarMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: gradientTex,
            transparent: false,
            opacity: 1.0,
            side: THREE.FrontSide,
            emissive: isDark ? 0xaa4400 : 0x000000,
            emissiveIntensity: 0.6,
            specular: isDark ? 0xffc107 : 0xffffff,
            shininess: isDark ? 80 : 100,
            flatShading: false
        });

        disposables.push(wireMat, solidMat, capMat, panelMatInner, panelMatOuter, activeWireMat, pillarMat);

        // --- 1. SPINE (Central Column) ---
        const spineGeo = new THREE.CylinderGeometry(2, 2, 100, 64, 1, false); // Smoother Spine // Reduced height from 120
        const spine = new THREE.Mesh(spineGeo, pillarMat);
        const spineWireMat = new THREE.MeshBasicMaterial({ color: PRIMARY_COLOR, wireframe: true, transparent: true, opacity: 0.1 });
        const spineWire = new THREE.Mesh(spineGeo, spineWireMat);
        spine.add(spineWire);
        group.add(spine);

        const coreGeo = new THREE.CylinderGeometry(0.5, 0.5, 100, 16); // Smoother Core // Reduced height from 120
        const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: PRIMARY_COLOR, opacity: 0.5, transparent: true }));
        group.add(core);

        disposables.push(spineGeo, coreGeo, spineWireMat, core.material);

        // --- 2. FLOORS (Grids) ---
        const floorObjects: {
            hitbox: THREE.Mesh;
            plat: THREE.Mesh;
            fill: THREE.Mesh;
            panels: THREE.Mesh[];
            label: THREE.Sprite;
            originalY: number;
            isEmpty: boolean;
        }[] = [];

        for (let i = 0; i < 8; i++) {
            const floorGroup = new THREE.Group();
            const yPos = (i * 12) - 42;
            floorGroup.position.y = yPos;

            const baseRadius = 8;
            const floorRadius = baseRadius + (Math.log(i + 1) * 6);

            const floorItemsCount = items.slice(i * itemsPerFloor, (i + 1) * itemsPerFloor).length;
            const isEmpty = floorItemsCount === 0;

            // Solid High-Tech Floors (Height 0.8)
            const platGeo = new THREE.CylinderGeometry(floorRadius, floorRadius, 0.8, 64, 1);

            // Material Array: [Side(Gradient), Top(Solid Gold), Bottom(Solid Gold)]
            const fill = new THREE.Mesh(platGeo, [solidMat, capMat, capMat]);

            // WIREFRAME OVERLAY for Floor (Same technique as Panels)
            const floorWire = new THREE.Mesh(platGeo, wireMat);

            // Glowing Rims for Definition (Top & Bottom Highlighting)
            const rimGeo = new THREE.TorusGeometry(floorRadius, 0.05, 8, 128);
            const rimMat = new THREE.MeshBasicMaterial({
                color: isDark ? 0xffea00 : 0x0ea5e9
            }); // Bright Neon Rim

            const rimTop = new THREE.Mesh(rimGeo, rimMat);
            rimTop.rotation.x = Math.PI / 2;
            rimTop.position.y = 0.4; // Top Edge

            const rimBottom = new THREE.Mesh(rimGeo, rimMat);
            rimBottom.rotation.x = Math.PI / 2;
            rimBottom.position.y = -0.4; // Bottom Edge

            // Add Solid Body + Wireframe Overlay + Neon Rims
            floorGroup.add(fill, floorWire, rimTop, rimBottom);

            const panelGeo = new THREE.PlaneGeometry(4, 6);
            const panels = [];
            const panelRadius = floorRadius + 2;

            for (let p = 0; p < 8; p++) {
                const angle = (p / 8) * Math.PI * 2;

                // 1. Wireframe Overlay
                const panel = new THREE.Mesh(panelGeo, wireMat);
                panel.position.set(Math.cos(angle) * panelRadius, 0, Math.sin(angle) * panelRadius);
                panel.lookAt(0, 0, 0);
                panel.rotateX(-Math.PI / 4);

                // 2. Solid Backing (Split into Inner/Outer for lighting control)

                // Inner (FrontSide)
                const panelInner = new THREE.Mesh(panelGeo, panelMatInner);
                panelInner.position.copy(panel.position);
                panelInner.rotation.copy(panel.rotation);

                // Outer (BackSide)
                const panelOuter = new THREE.Mesh(panelGeo, panelMatOuter);
                panelOuter.position.copy(panel.position);
                panelOuter.rotation.copy(panel.rotation);

                floorGroup.add(panel, panelInner, panelOuter);

                // Track components for hover effects
                // Store distinct references if needed, or just push both to panels for generic hover logic
                // For now, pushing both means both will get hover effect applied
                panels.push(panel, panelInner, panelOuter);
            }

            const hitGeo = new THREE.CylinderGeometry(panelRadius + 2, panelRadius + 2, 4, 32); // Smoother Hitbox
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            const hitbox = new THREE.Mesh(hitGeo, hitMat);
            hitbox.userData = { type: 'floor', index: i };

            const labelDist = panelRadius + 4; // Start right after panels

            // Unused vars removed
            // (floorItems/isEmpty logic removed)

            const floorIndex = i;
            const sectorNum = ((floorIndex || 0) + 1).toString().padStart(2, '0');
            const text = `SECTOR ${sectorNum}`;

            // Measure text to tightly wrap the canvas width
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            let textWidth = 4000;
            if (tempCtx) {
                tempCtx.font = '900 400px "Orbitron", sans-serif';
                // @ts-ignore
                tempCtx.letterSpacing = "20px";
                textWidth = tempCtx.measureText(text).width;
            }

            const canvas = document.createElement('canvas');
            canvas.width = textWidth + 100; // Tight wrap with minor padding
            canvas.height = 1024; // Keep standard height

            const drawLabel = (tex?: THREE.CanvasTexture) => {
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.font = '900 400px "Orbitron", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // @ts-ignore
                ctx.letterSpacing = "20px";

                const themeColor = isDark ? '#ffaa00' : '#0369a1';

                if (isDark) {
                    // Dark Mode: Theme Outline, White Fill
                    ctx.lineWidth = 15;
                    ctx.strokeStyle = themeColor;
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.shadowBlur = 10;
                    ctx.shadowOffsetX = 4;
                    ctx.shadowOffsetY = 4;
                    ctx.strokeText(text, canvas.width / 2, 512);

                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 0; // Clear shadow for fill to keep it crisp
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    ctx.fillText(text, canvas.width / 2, 512);
                } else {
                    // Light Mode: Solid Theme Color, No Stroke, No Glare
                    ctx.fillStyle = themeColor;
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    ctx.fillText(text, canvas.width / 2, 512);
                }

                if (tex) tex.needsUpdate = true;
            };

            // Initial Draw
            drawLabel();

            const labelTex = new THREE.CanvasTexture(canvas);

            // Texture High-Quality Settings
            labelTex.minFilter = THREE.LinearFilter;
            labelTex.magFilter = THREE.LinearFilter;
            labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

            document.fonts.ready.then(() => {
                drawLabel(labelTex);
            });

            const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, opacity: 1.0, depthWrite: false });
            const label = new THREE.Sprite(labelMat);

            label.center.set(0, 0.5);
            label.position.set(labelDist, 0, 0);

            // Dynamically scale width based on calculated texture ratio
            const isMobile = window.innerWidth < 768;
            const scaleY = isMobile ? 3.5 : 5; // Smaller labels on mobile
            label.scale.set(scaleY * (canvas.width / canvas.height), scaleY, 1);

            floorGroup.add(hitbox, label);
            group.add(floorGroup);
            floorObjects.push({
                hitbox,
                plat: fill,
                fill,
                panels,
                label,
                originalY: yPos,
                isEmpty
            });

            disposables.push(platGeo, panelGeo, hitGeo, hitMat, labelMat, labelTex);
        }

        // --- 3. CONNECTING RODS (Between floors) ---
        // Vertical lines connecting the panels for that "structure" look
        const rodGeo = new THREE.CylinderGeometry(0.1, 0.1, 12, 4);
        const rodMat = new THREE.MeshBasicMaterial({ color: SECONDARY_COLOR });

        for (let i = 0; i < 7; i++) { // Between 8 floors -> 7 gaps
            const yPos = (i * 12) - 36; // Midpoint
            for (let p = 0; p < 4; p++) { // Only 4 rods, not 8, to keep it clean
                const angle = (p / 4) * Math.PI * 2;
                const rod = new THREE.Mesh(rodGeo, rodMat);
                rod.position.set(Math.cos(angle) * 5, yPos, Math.sin(angle) * 5); // Reduce rod radius to 5 to fit inside 8
                group.add(rod);
            }
        }
        disposables.push(rodGeo, rodMat);

        // --- SCROLL / CAMERA LOGIC ---
        let scrollY = 5; // Center the camera vertically
        const minScroll = -50;
        const maxScroll = 50;
        let targetScrollY = 5;

        let zPos = 100; // Tighter zoom because pillar is shorter
        let targetZ = 100;
        const ZOOM_CLOSE = 40; // Zoom level when focused
        const ZOOM_FAR = 100;   // Zoom level when viewing whole tower (tighter zoom)

        let focusedFloorIndex = -1; // Track focused floor

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            targetScrollY -= e.deltaY * 0.05;
            targetScrollY = Math.max(minScroll, Math.min(maxScroll, targetScrollY));

            if (focusedFloorIndex !== -1) {
                focusedFloorIndex = -1; // Reset focus on manual scroll
                if (onFocus) onFocus(false);
                targetZ = ZOOM_FAR;     // Zoom out on manual scroll
            }
        };

        // --- EVENTS ---
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
                    // FOCUS LOGIC: Scroll camera to align with the selected floor's Y position
                    const floorIndex = hoveredFloor.userData.index;
                    const floorY = (floorIndex * 12) - 42;

                    if (focusedFloorIndex === floorIndex) {
                        // ALREADY FOCUSED -> OPEN
                        onSelectFloorRef.current(floorIndex);
                    } else {
                        // OBJECTIVE: FOCUS & ZOOM
                        targetScrollY = floorY;
                        focusedFloorIndex = floorIndex;
                        targetZ = ZOOM_CLOSE; // Zoom In
                        if (onFocus) onFocus(true, floorIndex);
                    }
                } else {
                    // Clicked background or non-floor -> RESET FOCUS
                    if (focusedFloorIndex !== -1) {
                        focusedFloorIndex = -1;
                        if (onFocus) onFocus(false);
                        targetZ = ZOOM_FAR; // Zoom out
                    }
                }
            }
        };
        const handleMove = (e: MouseEvent) => {
            const mount = mountRef.current;
            if (!mount) return;
            const rect = mount.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            if (isDragging) {
                // X movement -> Rotation
                targetRotationY += e.movementX * 0.005;

                // Y movement -> Pan Camera (Scroll)
                targetScrollY += e.movementY * 0.1;
                targetScrollY = Math.max(minScroll, Math.min(maxScroll, targetScrollY));

                if (Math.abs(e.movementY) > 0) {
                    if (focusedFloorIndex !== -1 && onFocus) onFocus(false);
                    focusedFloorIndex = -1; // Reset focus on drag
                    targetZ = ZOOM_FAR;     // Zoom out on drag
                }
            }
        };

        const handleTouchStart = () => { isDragging = true; };
        const handleTouchEnd = () => { isDragging = false; };

        // Define canvasEl after renderer is initialized
        const canvasEl = renderer.domElement;

        // Attach event listeners
        canvasEl.addEventListener('wheel', handleWheel, { passive: false });
        canvasEl.addEventListener('mousedown', handleDown);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('mousemove', handleMove);
        canvasEl.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchend', handleTouchEnd);

        const handleResize = () => {
            if (!mountRef.current || !renderer || !camera) return;
            const w = mountRef.current.clientWidth;
            const h = mountRef.current.clientHeight;
            const aspect = w / h;

            renderer.setSize(w, h);
            camera.aspect = aspect;

            // Responsive Logic 2.0: Aspect-Ratio & Width aware
            if (w < 768) {
                // Mobile (Portrait & Landscape)
                if (aspect < 1) {
                    // Mobile Portrait
                    camera.fov = 75;
                    targetZ = 160;
                } else {
                    // Mobile Landscape
                    camera.fov = 50;
                    targetZ = 120;
                }
            } else if (w < 1280) {
                // Tablet / Small Laptop
                if (aspect < 1) {
                    // Tablet Portrait
                    camera.fov = 70;
                    targetZ = 140;
                } else {
                    // Tablet Landscape
                    camera.fov = 60;
                    targetZ = 100;
                }
            } else {
                // Desktop
                camera.fov = 60;
                targetZ = 100;
            }
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', handleResize);

        // --- ANIMATION ---
        const clock = new THREE.Clock();
        let frameId: number;
        const AUTO_SPIN_SPEED = 0.05; // Radians per second
        const tempVec = new THREE.Vector3();

        const animate = () => {
            frameId = requestAnimationFrame(animate);
            if (isPaused) return;
            const dt = clock.getDelta(); // Get delta time

            // Rotation (Unified Model)
            // 1. Auto-rotate pushes the target
            if (!isDragging) {
                targetRotationY += AUTO_SPIN_SPEED * dt;
            }

            // 2. Smoothly damp towards target (Manual or Auto)
            const damp = Math.min(1.0, dt * 4.0);
            currentRotY += (targetRotationY - currentRotY) * damp;

            // 3. Apply
            group.rotation.y = currentRotY;

            // Camera Scroll & Zoom Smoothing
            scrollY += (targetScrollY - scrollY) * damp;
            zPos += (targetZ - zPos) * damp;

            camera.position.y = scrollY;
            camera.position.z = zPos;
            camera.lookAt(0, scrollY, 0); // Always look straight ahead at the current level

            // Hover Effects
            // Hover Effects
            floorObjects.forEach((obj) => {
                const isHover = (obj.hitbox === hoveredFloor);

                // HOVER LOGIC FIX: Do NOT replace the solid floor material with wireframe!
                // Instead, just brighten the panels or handle the floor glow if needed.

                // 1. Panels (Floating screens)
                obj.panels.forEach(p => {
                    if (p.material instanceof THREE.MeshPhongMaterial) {
                        // Solid Panel: Boost Glow
                        p.material.emissiveIntensity = isHover ? 1.0 : 0.6;
                    } else {
                        // Wireframe Overlay: Swap Color
                        p.material = isHover ? activeWireMat : wireMat;
                    }
                });

                // 2. Floor Body (Solid) - Optional Emissive Boost (Safe Way)
                // Accessing the material array safely
                if (Array.isArray(obj.plat.material)) {
                    obj.plat.material.forEach(m => {
                        if (m instanceof THREE.MeshPhongMaterial) {
                            // Boost emissive on hover
                            m.emissiveIntensity = isHover ? 1.0 : (isDark ? 0.6 : 0.0);
                        }
                    });
                } else if (obj.plat.material instanceof THREE.MeshPhongMaterial) {
                    obj.plat.material.emissiveIntensity = isHover ? 1.0 : (isDark ? 0.6 : 0.0);
                }

                // Label pop - Hover only opacity, NO SCALE/ZOOM
                obj.label.material.opacity = isHover ? 1 : 0.8;

                // Dynamic pivot to prevent clipping into the tower when on the left side
                obj.label.getWorldPosition(tempVec);
                const anchorX = Math.max(0, Math.min(1, 0.5 - (tempVec.x / 36)));
                obj.label.center.set(anchorX, 0.5);
            });

            // Raycast
            // Raycast
            raycaster.setFromCamera(mouse, camera);

            // 1. Check Floor Hover (specific for selection)
            const floorIntersects = raycaster.intersectObjects(floorObjects.map(f => f.hitbox));
            hoveredFloor = null;
            if (floorIntersects.length > 0) {
                hoveredFloor = floorIntersects[0].object;
            }

            // 2. Check General Tower Hover (for drag availability)
            const towerIntersects = raycaster.intersectObjects(group.children, true);
            isHoveringTower = towerIntersects.length > 0;

            if (mountRef.current) {
                if (isDragging) {
                    mountRef.current.style.cursor = 'grabbing';
                } else if (hoveredFloor) {
                    mountRef.current.style.cursor = 'pointer'; // Clickable floor
                } else if (isHoveringTower) {
                    mountRef.current.style.cursor = 'grab'; // Draggable tower
                } else {
                    mountRef.current.style.cursor = 'default';
                }
            }

            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('resize', handleResize);
            // Ensure canvasEl is captured or re-accessed
            if (renderer && renderer.domElement) {
                renderer.domElement.removeEventListener('mousedown', handleDown);
                renderer.domElement.removeEventListener('wheel', handleWheel);
                renderer.domElement.removeEventListener('touchstart', handleTouchStart);
                renderer.domElement.removeEventListener('touchend', handleTouchEnd); // Also remove touchend from canvasEl
            }
            if (mount && renderer.domElement) {
                mount.removeChild(renderer.domElement);
            }
            disposables.forEach(d => {
                if (d.dispose) d.dispose();
            });
            renderer.dispose();
        };
    }, [theme]);

    return <div ref={mountRef} className="w-full h-full min-h-[500px]" />;
};

export default TowerStructure;
