import * as THREE from 'three';
import {
    TIERS, FLOOR_RINGS, TABS, STATIONS, TICKS,
    MEASUREMENT, stationAngle,
} from '../../lib/dais/geometry';

/**
 * Builds the holographic dais as an emissive light construct.
 *
 * The reference has no PBR surface to reconstruct — it is additive light with a halo
 * over 80% of its own footprint — so nothing here is lit. Every element carries its own
 * emission, which is also why the light theme swaps blending: additive light on a pale
 * background sums straight to white, so on light it composites normally instead.
 */

export interface DaisHandle {
    resize: (w: number, h: number) => void;
    frame: (dtSeconds: number) => void;
    dispose: () => void;
}

export interface DaisOptions {
    /**
     * Element the renderer's canvas is appended to.
     *
     * The canvas is created here rather than handed in: a canvas that has had a WebGL
     * context force-lost can never hand out another one, so reusing a React-owned
     * element made every rebuild — including a light/dark toggle — throw inside the
     * renderer's constructor. Each build now gets a fresh element and drops it on dispose.
     */
    host: HTMLElement;
    isDark: boolean;
    /** Holds the sweep and the core pulse still, and drops the idle spin. */
    reducedMotion: boolean;
}

const RING_SEGMENTS = 256;

/** Height of the floor rings. See the note where they are added. */
const FLOOR_RING_Y = 0.022;

/** Shared glow shader. `aT` is the gradient parameter each geometry supplies per vertex. */
const GLOW_VERT = /* glsl */ `
    attribute float aT;
    varying float vT;
    varying vec3 vLocal;
    void main() {
        vT = aT;
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const GLOW_FRAG = /* glsl */ `
    uniform vec3 uCold;
    uniform vec3 uHot;
    uniform float uIntensity;
    uniform float uTime;
    uniform float uSweep;
    uniform float uFloor;
    varying float vT;
    varying vec3 vLocal;
    void main() {
        float g = pow(clamp(vT, 0.0, 1.0), 1.6);
        vec3 c = mix(uCold, uHot, g);
        // How much of a tier face carries colour away from its own edge. High on dark,
        // because the reference body is a filled luminous mass whose edges are highlights
        // on top of it. Low on light, where stacked half-opaque annuli just average into
        // grey — there the edges do the work and the faces stay a wash.
        float a = uIntensity * (uFloor + (1.0 - uFloor) * g);
        // One brighter arc travelling round the dais, so it reads as a live readout.
        float ang = atan(vLocal.z, vLocal.x);
        float s = 0.5 + 0.5 * cos(ang - uTime * 0.55);
        a *= 0.84 + 0.4 * pow(s, 6.0) * uSweep;
        gl_FragColor = vec4(c * a, a);
    }
`;

/** Adds a per-vertex gradient parameter derived from each vertex's own position. */
const attachT = (geo: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => number) => {
    const pos = geo.getAttribute('position');
    const t = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
        t[i] = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
};

export const createDais = ({ host, isDark, reducedMotion }: DaisOptions): DaisHandle => {
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(d: T): T => { disposables.push(d); return d; };

    const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
    });
    const canvas = renderer.domElement;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.appendChild(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();

    // Long lens: the reference traced to within 0.5px of an orthographic projection,
    // so the FOV stays narrow and the camera sits well back.
    const camera = new THREE.PerspectiveCamera(10, 1, 0.1, 100);
    const elevation = THREE.MathUtils.degToRad(MEASUREMENT.elevationDeg);

    /** Horizontal half-extent the camera must cover: the outer ring plus real air. */
    const FRAME_RADIUS = 1.24;
    /**
     * Vertical half-extent to cover, as a share of FRAME_RADIUS.
     *
     * With the pins gone the tallest thing left is the outer ring itself, so this
     * dropped from 0.30 to 0.20 and WIDTH now drives the fit — which is what stops the
     * rings being clipped by the canvas edge. The look-at also returns to y=0: the pins
     * were the only reason to aim above the floor, and centring on the floor now centres
     * the disc instead of leaving dead canvas under it.
     */
    const VERT_FIT = 0.20;
    const placeCamera = (aspect: number) => {
        const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
        // Fit whichever axis is tighter so the pins never clip out of frame.
        const byWidth = FRAME_RADIUS / (Math.tan(halfFov) * Math.max(aspect, 0.0001));
        const byHeight = FRAME_RADIUS * VERT_FIT / Math.tan(halfFov);
        const dist = Math.max(byWidth, byHeight);
        camera.position.set(0, Math.sin(elevation) * dist, Math.cos(elevation) * dist);
        camera.lookAt(0, 0, 0);
    };

    // ---- palette -------------------------------------------------------------
    // The platform is WHITE LIGHT, not an accent surface. It deliberately does not
    // track the theme's amber/cyan: the dais reading in the same hue as the card's
    // own chrome is what made the two merge into one stacked mass.
    //
    // Only the VALUE adapts between themes, never the hue. Pure white on the light
    // theme's pale page would be invisible, so light runs the same neutral ramp
    // inverted — pale greys for the tier faces, deepening toward each edge and the
    // core — which keeps the steps legible without introducing any colour.
    const COLD = new THREE.Color(isDark ? 0x6e6e72 : 0xc7ccd4);
    const WARM = new THREE.Color(isDark ? 0xd8d8de : 0x8d95a1);
    const EDGE = new THREE.Color(isDark ? 0xffffff : 0x5a6673);
    const HOT = new THREE.Color(isDark ? 0xffffff : 0x3b4350);
    const LINE = new THREE.Color(isDark ? 0xf4f5f7 : 0x4b5563);

    const BLEND = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
    /**
     * Fills and lines need opposite treatment between the themes.
     *
     * On dark the dais is emitted light, so fills carry it and additive blending sums
     * them. On a pale background that same glow just hazes over, so light mode reads the
     * dais as a drawn neutral blueprint instead: the fills drop back to a wash and the lines
     * carry the structure. Using one gain for both is what left light mode a pale puddle
     * with its steps and pins invisible.
     */
    const FILL_GAIN = isDark ? 1 : 0.55;
    const LINE_GAIN = isDark ? 1 : 1.25;

    const glowMaterials: THREE.ShaderMaterial[] = [];
    const makeGlow = (cold: THREE.Color, hot: THREE.Color, intensity: number, sweep: number) => {
        const m = new THREE.ShaderMaterial({
            vertexShader: GLOW_VERT,
            fragmentShader: GLOW_FRAG,
            uniforms: {
                uCold: { value: cold.clone() },
                uHot: { value: hot.clone() },
                uIntensity: { value: intensity * FILL_GAIN },
                uTime: { value: 0 },
                uSweep: { value: reducedMotion ? 0 : sweep },
                uFloor: { value: isDark ? 0.62 : 0.24 },
            },
            transparent: true,
            blending: BLEND,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        glowMaterials.push(m);
        return track(m);
    };

    const makeLine = (color: THREE.Color, opacity: number) => track(new THREE.LineBasicMaterial({
        color: color.clone(),
        transparent: true,
        opacity: Math.min(opacity * LINE_GAIN, 1),
        blending: BLEND,
        depthWrite: false,
    }));

    // ---- the dais ------------------------------------------------------------
    const dais = new THREE.Group();
    scene.add(dais);

    /**
     * A ring drawn as a thin ribbon MESH, never as a GL line.
     *
     * These ellipses are extremely flat (minor/major 0.17), so sampled uniformly in
     * angle their screen-space segments collapse near the left and right extremes —
     * under a pixel long at 512 segments. Sub-pixel line segments get dropped by the
     * rasteriser, which cut a blunt gap out of both extremes of every ring, symmetric
     * and impossible to fix by adding segments (that shortens them further). A ribbon
     * always has real width to rasterise, so the caps close.
     */
    const ringBand = (radius: number, y: number, color: THREE.Color, opacity: number, width = 0.005) => {
        const geo = track(new THREE.RingGeometry(
            radius - width / 2, radius + width / 2, RING_SEGMENTS, 1,
        ));
        geo.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geo, track(new THREE.MeshBasicMaterial({
            color: color.clone(),
            transparent: true,
            opacity: Math.min(opacity * LINE_GAIN, 1),
            blending: BLEND,
            depthWrite: false,
            side: THREE.DoubleSide,
        })));
        mesh.position.y = y;
        return mesh;
    };

    /**
     * The two hairline rings, lifted just clear of the floor.
     *
     * On the floor (y=0.001) their BACK arc projects to -0.1725 while the body's back
     * rim projects to -0.1793 — so the back half of each ring passes behind the body's
     * rim on screen and, being additive over a near-saturated disc, disappears. What is
     * left reads as two arcs that stop dead, which is the "outer ring getting cut".
     * Raising them by 0.022 puts that arc above the rim with room to spare. The
     * reference has the same overlap; it just never had a disc this bright.
     */
    FLOOR_RINGS.forEach((r, i) => {
        dais.add(ringBand(r, FLOOR_RING_Y, LINE, i === FLOOR_RINGS.length - 1 ? 0.95 : 0.6));
    });

    // Stepped body: an annular top face per tier, a wall under each step, and a bright
    // edge line where the two meet — the arrangement the trace actually found.
    TIERS.forEach((tier, i) => {
        const depth = i / (TIERS.length - 1);

        const isCore = i === TIERS.length - 1;
        const top = new THREE.RingGeometry(
            Math.max(tier.rInner, 0.0001), tier.rOuter, RING_SEGMENTS, 1,
        );
        top.rotateX(-Math.PI / 2);
        attachT(top, (x, _y, z) => {
            const r = Math.hypot(x, z);
            const span = Math.max(tier.rOuter - tier.rInner, 1e-5);
            const t = (r - tier.rInner) / span;
            // Every tier brightens toward its outer edge, where the next step's highlight
            // sits. The core is the exception: it is the source, so it peaks at the centre.
            return isCore ? 1 - t : t;
        });
        track(top);
        const topMesh = new THREE.Mesh(top, makeGlow(
            isCore ? WARM : COLD.clone().lerp(WARM, depth * 0.7),
            isCore ? HOT : EDGE,
            isCore ? 1.25 : 0.62 + depth * 0.5,
            1,
        ));
        topMesh.position.y = tier.top;
        topMesh.renderOrder = 2 + i;
        dais.add(topMesh);

        // Wall below this step. The outermost tier skirts down to the floor; the rest
        // drop only to the tier outside them.
        const base = i === 0 ? 0 : TIERS[i - 1].top;
        const h = tier.top - base;
        if (h > 0.0005) {
            const wall = new THREE.CylinderGeometry(
                tier.rOuter, tier.rOuter, h, RING_SEGMENTS, 1, true,
            );
            attachT(wall, (_x, y) => (y + h / 2) / h);
            track(wall);
            const wallMesh = new THREE.Mesh(wall, makeGlow(
                COLD, WARM, 0.95 + depth * 0.45, 0.7,
            ));
            wallMesh.position.y = base + h / 2;
            wallMesh.renderOrder = 2 + i;
            dais.add(wallMesh);
        }

        dais.add(ringBand(tier.rOuter, tier.top + 0.0006, EDGE, 0.7 + depth * 0.25, 0.004));
    });

    // Radial dash band on one tier face.
    {
        const tier = TIERS[TICKS.tierIndex];
        const span = tier.rOuter - tier.rInner;
        const r0 = tier.rInner + span * (1 - TICKS.lengthFraction) * 0.5;
        const r1 = r0 + span * TICKS.lengthFraction;
        const pts: number[] = [];
        for (let i = 0; i < TICKS.count; i++) {
            const a = (i / TICKS.count) * Math.PI * 2;
            const c = Math.cos(a), s = Math.sin(a);
            pts.push(c * r0, tier.top + 0.0012, s * r0, c * r1, tier.top + 0.0012, s * r1);
        }
        const geo = track(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const ticks = new THREE.LineSegments(geo, makeLine(HOT, 0.5));
        ticks.renderOrder = 9;
        dais.add(ticks);
    }

    // Marker plates just outside the body rim, one per station.
    {
        const geo = track(new THREE.BoxGeometry(TABS.depth, TABS.height, TABS.width));
        const mat = track(new THREE.MeshBasicMaterial({
            color: EDGE.clone(),
            transparent: true,
            opacity: Math.min(0.85 * LINE_GAIN, 1),
            blending: BLEND,
            depthWrite: false,
        }));
        const tabs = new THREE.InstancedMesh(geo, mat, STATIONS);
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const one = new THREE.Vector3(1, 1, 1);
        for (let i = 0; i < STATIONS; i++) {
            const a = stationAngle(i);
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
            m.compose(
                new THREE.Vector3(Math.cos(a) * TABS.radius, TABS.height / 2, Math.sin(a) * TABS.radius),
                q, one,
            );
            tabs.setMatrixAt(i, m);
        }
        tabs.instanceMatrix.needsUpdate = true;
        tabs.renderOrder = 10;
        dais.add(tabs);
    }




    // ---- loop ----------------------------------------------------------------
    let time = 0;
    /** Latched by dispose: a late resize or frame must never draw through a released context. */
    let disposed = false;
    const frame = (dt: number) => {
        if (disposed) return;
        if (!reducedMotion) {
            time += dt;
            for (const m of glowMaterials) m.uniforms.uTime.value = time;
            dais.rotation.y = time * 0.045;
        }
        renderer.render(scene, camera);
    };

    const resize = (w: number, h: number) => {
        if (disposed || w <= 0 || h <= 0) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        placeCamera(camera.aspect);
        camera.updateProjectionMatrix();
        // setSize reallocates the drawing buffer, which clears it. With the loop running
        // the next frame repaints anyway, but a paused or reduced-motion dais has no next
        // frame and would sit blank until something else woke it — so repaint here.
        renderer.render(scene, camera);
    };

    const dispose = () => {
        if (disposed) return;
        disposed = true;
        for (const d of disposables) {
            try { d.dispose(); } catch { /* already gone */ }
        }
        disposables.length = 0;
        renderer.forceContextLoss();
        renderer.dispose();
        canvas.remove();
    };

    resize(host.clientWidth || 1, host.clientHeight || 1);
    return { resize, frame, dispose };
};
