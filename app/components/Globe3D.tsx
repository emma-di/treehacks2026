'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';

const GOLD = 0xfbbf24;
const WIRE = 0xfcd34d;
const NAVY = 0x1e3a5f;

export type HospitalNode = { name: string; href: string; lat: number; lon: number };

function latLonToPosition(lat: number, lon: number, radius: number) {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(theta)
  );
}

type Globe3DProps = {
  hospitals: HospitalNode[];
  onHospitalClick: (href: string) => void;
  /** When true, show translucent ties from each node to the global model (globe center) and keep globe still */
  showTies?: boolean;
  /** When true, globe does not auto-rotate */
  still?: boolean;
  /** Explicit size (width/height) when square */
  size?: number;
  /** Explicit width when using non-square (taller) view */
  width?: number;
  /** Explicit height when using non-square (taller) view */
  height?: number;
};

export function Globe3D({ hospitals, onHospitalClick, showTies = false, still = false, size, width: widthProp, height: heightProp }: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onHospitalClickRef = useRef(onHospitalClick);
  onHospitalClickRef.current = onHospitalClick;
  const pausedRef = useRef(false);
  const stillRef = useRef(still);
  stillRef.current = still;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = widthProp ?? size ?? (container.clientWidth || 280);
    const height = heightProp ?? size ?? (container.clientHeight || 280);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
    const aspect = width / height;
    camera.position.z = showTies ? (aspect > 0.8 ? 5.9 : 5.4) : 4.2;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const canvasWrapper = document.createElement('div');
    canvasWrapper.style.width = '100%';
    canvasWrapper.style.height = '100%';
    canvasWrapper.style.position = 'absolute';
    canvasWrapper.style.inset = '0';
    canvasWrapper.style.borderRadius = '9999px';
    canvasWrapper.style.overflow = showTies ? 'visible' : 'hidden';
    canvasWrapper.style.zIndex = '5';
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasWrapper.appendChild(canvas);

    const backmostBox = document.createElement('div');
    backmostBox.style.position = 'absolute';
    backmostBox.style.inset = '0';
    backmostBox.style.borderRadius = '9999px';
    backmostBox.style.backgroundColor = 'rgb(241 245 249)';
    backmostBox.style.pointerEvents = 'none';
    backmostBox.style.zIndex = '0';
    const backLabelsWrapper = document.createElement('div');
    backLabelsWrapper.style.position = 'absolute';
    backLabelsWrapper.style.left = '-80px';
    backLabelsWrapper.style.top = '-80px';
    backLabelsWrapper.style.right = '-80px';
    backLabelsWrapper.style.bottom = '-80px';
    backLabelsWrapper.style.pointerEvents = 'none';
    backLabelsWrapper.style.overflow = 'visible';
    backLabelsWrapper.style.zIndex = '6';
    const frontLabelsWrapper = document.createElement('div');
    frontLabelsWrapper.style.position = 'absolute';
    frontLabelsWrapper.style.left = '-80px';
    frontLabelsWrapper.style.top = '-80px';
    frontLabelsWrapper.style.right = '-80px';
    frontLabelsWrapper.style.bottom = '-80px';
    frontLabelsWrapper.style.pointerEvents = 'none';
    frontLabelsWrapper.style.overflow = 'visible';
    frontLabelsWrapper.style.zIndex = '10';
    container.appendChild(backmostBox);
    container.appendChild(backLabelsWrapper);
    container.appendChild(canvasWrapper);
    container.appendChild(frontLabelsWrapper);

    const globe = new THREE.Group();
    globe.position.y = -0.35;
    const worldPos = new THREE.Vector3();

    // Sphere: translucent navy blue
    const sphereGeom = new THREE.SphereGeometry(1, 32, 24);
    const baseMat = new THREE.MeshPhongMaterial({
      color: NAVY,
      transparent: true,
      opacity: 0.45,
      shininess: 12,
      emissive: 0x0f172a,
      side: THREE.DoubleSide,
    });
    const sphere = new THREE.Mesh(sphereGeom, baseMat);
    globe.add(sphere);

    const wireMat = new THREE.MeshBasicMaterial({
      color: WIRE,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const wireSphere = new THREE.Mesh(sphereGeom.clone(), wireMat);
    globe.add(wireSphere);

    // Hospital nodes: glowy fairy-light style (emissive + soft halo)
    const markerGeom = new THREE.SphereGeometry(0.032, 16, 12);
    const glowGeom = new THREE.SphereGeometry(0.06, 12, 8);
    const markerMat = new THREE.MeshStandardMaterial({
      color: GOLD,
      emissive: GOLD,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.98,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: GOLD,
      transparent: true,
      opacity: 0.35,
    });
    const hospitalMarkers: THREE.Mesh[] = [];
    const labelEntries: { mesh: THREE.Mesh; el: HTMLButtonElement }[] = [];
    const radius = 1.028;

    hospitals.forEach((h) => {
      const pos = latLonToPosition(h.lat, h.lon, radius);
      const marker = new THREE.Mesh(markerGeom.clone(), markerMat.clone());
      marker.position.copy(pos);
      marker.userData = { href: h.href };
      const glow = new THREE.Mesh(glowGeom.clone(), glowMat.clone());
      glow.position.copy(pos);
      globe.add(glow);
      globe.add(marker);
      hospitalMarkers.push(marker);

      const label = document.createElement('button');
      label.type = 'button';
      label.textContent = h.name;
      label.dataset.href = h.href;
      label.style.position = 'absolute';
      label.style.left = '0';
      label.style.top = '0';
      label.style.transform = 'translate(-50%, -50%)';
      label.style.pointerEvents = 'auto';
      label.style.cursor = 'pointer';
      label.style.fontSize = '11px';
      label.style.fontWeight = '500';
      label.style.color = 'rgb(30 41 59)';
      label.style.background = 'rgba(255,255,255,0.95)';
      label.style.border = '1px solid rgba(251,191,36,0.5)';
      label.style.borderRadius = '6px';
      label.style.padding = '3px 8px';
      label.style.whiteSpace = 'nowrap';
      label.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      frontLabelsWrapper.appendChild(label);
      label.addEventListener('click', (e) => {
        e.preventDefault();
        onHospitalClickRef.current(h.href);
      });
      label.addEventListener('mouseenter', () => {
        label.dataset.hovered = 'true';
        const back = label.dataset.back === 'true';
        if (back) {
          label.style.background = 'rgba(30,58,95,0.55)';
          label.style.color = 'rgba(226,232,240,0.95)';
          label.style.borderColor = 'rgba(148,163,184,0.5)';
        } else {
          label.style.background = 'rgba(254,243,199,0.98)';
          label.style.color = 'rgb(30 41 59)';
          label.style.borderColor = 'rgba(251,191,36,0.8)';
        }
      });
      label.addEventListener('mouseleave', () => {
        label.dataset.hovered = 'false';
        const back = label.dataset.back === 'true';
        if (back) {
          label.style.background = 'rgba(30,58,95,0.52)';
          label.style.color = 'rgba(226,232,240,0.95)';
          label.style.borderColor = 'rgba(100,116,139,0.4)';
        } else {
          label.style.background = 'rgba(255,255,255,0.95)';
          label.style.color = 'rgb(30 41 59)';
          label.style.borderColor = 'rgba(251,191,36,0.5)';
        }
      });
      labelEntries.push({ mesh: marker, el: label });
    });

    // Global Model label above globe + ties (no 3D box — label only, so no dark block)
    let globalModelLabelAnchor: THREE.Object3D | null = null;
    let globalModelLabelEl: HTMLDivElement | null = null;
    const globalModelPoint = new THREE.Vector3(0, 1.78, 0);
    const tieEndY = globalModelPoint.y - 0.14;

    if (showTies) {
      const anchor = new THREE.Object3D();
      anchor.position.copy(globalModelPoint);
      globe.add(anchor);
      globalModelLabelAnchor = anchor;

      // HTML label — two lines like sketch: "Global Model V2.3" / "improved --- features"
      globalModelLabelEl = document.createElement('div');
      globalModelLabelEl.style.position = 'absolute';
      globalModelLabelEl.style.left = '0';
      globalModelLabelEl.style.top = '0';
      globalModelLabelEl.style.transform = 'translate(-50%, -50%)';
      globalModelLabelEl.style.pointerEvents = 'none';
      globalModelLabelEl.style.color = 'rgb(30 41 59)';
      globalModelLabelEl.style.background = 'rgba(255, 255, 255, 0.95)';
      globalModelLabelEl.style.border = '1px solid rgba(251, 191, 36, 0.6)';
      globalModelLabelEl.style.borderRadius = '8px';
      globalModelLabelEl.style.padding = '8px 16px';
      globalModelLabelEl.style.textAlign = 'center';
      globalModelLabelEl.style.zIndex = '5';
      const line1 = document.createElement('div');
      line1.textContent = 'Global Model V2.3';
      line1.style.fontSize = '14px';
      line1.style.fontWeight = '700';
      line1.style.lineHeight = '1.3';
      const line2 = document.createElement('div');
      line2.textContent = 'improved --- features';
      line2.style.fontSize = '11px';
      line2.style.fontWeight = '500';
      line2.style.opacity = '0.9';
      line2.style.marginTop = '2px';
      line2.style.paddingLeft = '4px';
      globalModelLabelEl.appendChild(line1);
      globalModelLabelEl.appendChild(line2);
      frontLabelsWrapper.appendChild(globalModelLabelEl);

      // Glowy ties: control point must stay outside the globe so the curve arcs over, not through, the sphere
      const tieColor = GOLD;
      const tieEnd = new THREE.Vector3(0, tieEndY, 0);
      const minControlRadiusDefault = 1.18;
      hospitals.forEach((h) => {
        const start = latLonToPosition(h.lat, h.lon, radius);
        const outward = start.clone().normalize();
        // Lower/southern nodes (e.g. XY) get a more arched curve; upper nodes (XX, Local, Stanford) stay subtler
        const isLower = start.y < 0.2;
        const outwardScale = isLower ? 1.15 : 0.38;
        const minControlRadius = isLower ? 1.52 : minControlRadiusDefault;
        const mid = new THREE.Vector3().addVectors(start, tieEnd).multiplyScalar(0.5);
        mid.add(outward.multiplyScalar(outwardScale));
        if (mid.length() < minControlRadius) {
          mid.normalize().multiplyScalar(minControlRadius);
        }
        const curve = new THREE.QuadraticBezierCurve3(start, mid, tieEnd);
        const tubeGeom = new THREE.TubeGeometry(curve, 24, 0.022, 8, false);
        const tieMat = new THREE.MeshBasicMaterial({
          color: tieColor,
          transparent: true,
          opacity: 0.85,
        });
        const tube = new THREE.Mesh(tubeGeom, tieMat);
        globe.add(tube);
        // Outer glow layer: thicker, soft halo
        const glowTubeGeom = new THREE.TubeGeometry(curve, 24, 0.042, 8, false);
        const glowMat = new THREE.MeshBasicMaterial({
          color: tieColor,
          transparent: true,
          opacity: 0.35,
        });
        const glowTube = new THREE.Mesh(glowTubeGeom, glowMat);
        globe.add(glowTube);
      });
    }

    scene.add(globe);

    scene.add(new THREE.AmbientLight(0x94a3b8, 0.7));
    const key = new THREE.PointLight(0xfef3c7, 0.8, 20);
    key.position.set(3, 2, 5);
    scene.add(key);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onPointerMove(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    function onClick() {
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(hospitalMarkers);
      if (hits.length > 0 && hits[0].object.userData.href) {
        onHospitalClickRef.current(hits[0].object.userData.href as string);
      }
    }
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('click', onClick);
    canvas.style.cursor = 'pointer';

    function onGlobePointerEnter() {
      pausedRef.current = true;
    }
    function onGlobePointerLeave() {
      pausedRef.current = false;
    }
    container.addEventListener('pointerenter', onGlobePointerEnter);
    container.addEventListener('pointerleave', onGlobePointerLeave);

    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      if (!stillRef.current && !pausedRef.current) {
        globe.rotation.y += 0.004;
      }
      renderer.render(scene, camera);

      const rect = container.getBoundingClientRect();
      const cx = rect.width * 0.5;
      const cy = rect.height * 0.5;
      const labelOffsetPx = 18; // push labels outward so they don't cover nodes
      const labelWrapperPadding = 80; // wrappers extend 80px so labels aren't clipped
      labelEntries.forEach(({ mesh, el }) => {
        mesh.getWorldPosition(worldPos);
        const isBack = worldPos.z < 0;
        worldPos.project(camera);
        let x = (worldPos.x * 0.5 + 0.5) * rect.width;
        let y = (worldPos.y * -0.5 + 0.5) * rect.height;
        const dx = x - cx;
        const dy = y - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        x += (dx / len) * labelOffsetPx;
        y += (dy / len) * labelOffsetPx;
        el.style.display = 'block';
        el.style.left = `${x + labelWrapperPadding}px`;
        el.style.top = `${y + labelWrapperPadding}px`;
        el.dataset.back = isBack ? 'true' : 'false';
        const targetWrapper = isBack ? backLabelsWrapper : frontLabelsWrapper;
        if (el.parentNode !== targetWrapper) targetWrapper.appendChild(el);
        if (el.dataset.hovered !== 'true') {
          if (isBack) {
            el.style.background = 'rgba(30,58,95,0.52)';
            el.style.color = 'rgba(226,232,240,0.95)';
            el.style.borderColor = 'rgba(100,116,139,0.4)';
          } else {
            el.style.background = 'rgba(255,255,255,0.95)';
            el.style.color = 'rgb(30 41 59)';
            el.style.borderColor = 'rgba(251,191,36,0.5)';
          }
        }
      });
      if (globalModelLabelAnchor && globalModelLabelEl) {
        globalModelLabelAnchor.getWorldPosition(worldPos);
        const globalModelBack = worldPos.z < 0;
        worldPos.project(camera);
        const gx = (worldPos.x * 0.5 + 0.5) * rect.width;
        const gy = (worldPos.y * -0.5 + 0.5) * rect.height;
        globalModelLabelEl.style.display = globalModelBack ? 'none' : 'block';
        globalModelLabelEl.style.left = `${gx + labelWrapperPadding}px`;
        globalModelLabelEl.style.top = `${gy + labelWrapperPadding}px`;
      }
    }
    animate();

    const resize = () => {
      if (!container) return;
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();
    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(() => resize());
    ro.observe(container);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
      container.removeEventListener('pointerenter', onGlobePointerEnter);
      container.removeEventListener('pointerleave', onGlobePointerLeave);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('click', onClick);
      cancelAnimationFrame(raf);
      labelEntries.forEach(({ el }) => el.remove());
      renderer.dispose();
      if (canvasWrapper.parentNode === container) container.removeChild(canvasWrapper);
      if (backmostBox.parentNode === container) container.removeChild(backmostBox);
      if (backLabelsWrapper.parentNode === container) container.removeChild(backLabelsWrapper);
      if (frontLabelsWrapper.parentNode === container) container.removeChild(frontLabelsWrapper);
    };
  }, [hospitals, showTies, still, size, widthProp, heightProp]);

  return (
    <div
      ref={containerRef}
      className="rounded-full bg-slate-100 shadow-inner relative overflow-visible absolute inset-0 w-full h-full min-w-[280px] min-h-[280px]"
      style={
        widthProp != null && heightProp != null
          ? { width: widthProp, height: heightProp }
          : size != null
            ? { width: size, height: size, aspectRatio: '1' }
            : { aspectRatio: '1' }
      }
    />
  );
}
