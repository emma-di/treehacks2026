'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const WALL_HEIGHT = 1.8;
const WHITE = 0xffffff;
const ROOM_W = 2.6;
const ROOM_D = 2.6;
const DOOR_WIDTH = 0.85;
const CENTER_SIZE = 4;
const HALLWAY_WIDTH = 1.8;

type DoorSide = 'north' | 'south' | 'east' | 'west';

// Layout: center, hallway, rooms numbered sequentially. Room 0 = left of hallway (west).
// Order: West (0,1,2) south→north, North (3,4,5) west→east, East (6,7,8) south→north, South (9,10) west→east, Corners (11–14).
function getRoomLayout(_rows: number, _cols: number, selectedFloor: number) {
  const base = selectedFloor * 100;
  const layout: { roomId: string; x: number; z: number; doorSide: DoorSide; isCorner?: boolean }[] = [];
  const out = CENTER_SIZE / 2 + HALLWAY_WIDTH;
  const roomDepth = ROOM_D;
  const cornerOff = out + roomDepth / 2 + 0.05;
  let idx = 0;
  // West (left of hallway): 0, 1, 2 — south to north
  for (let i = 0; i < 3; i++) {
    layout.push({ roomId: `R${base + idx}`, x: -(out + roomDepth / 2 + 0.05), z: (i - 1) * ROOM_W, doorSide: 'east' });
    idx++;
  }
  // North: 3, 4, 5 — west to east
  for (let i = 0; i < 3; i++) {
    layout.push({ roomId: `R${base + idx}`, x: (i - 1) * ROOM_W, z: out + roomDepth / 2 + 0.05, doorSide: 'south' });
    idx++;
  }
  // East: 6, 7, 8 — south to north
  for (let i = 0; i < 3; i++) {
    layout.push({ roomId: `R${base + idx}`, x: out + roomDepth / 2 + 0.05, z: (i - 1) * ROOM_W, doorSide: 'west' });
    idx++;
  }
  // South (2 rooms, entrance in middle): 9, 10 — west to east
  layout.push({ roomId: `R${base + idx}`, x: -ROOM_W, z: -(out + roomDepth / 2 + 0.05), doorSide: 'north' });
  idx++;
  layout.push({ roomId: `R${base + idx}`, x: ROOM_W, z: -(out + roomDepth / 2 + 0.05), doorSide: 'north' });
  idx++;
  // Corners: 11 NE, 12 NW, 13 SE, 14 SW
  layout.push({ roomId: `R${base + idx}`, x: cornerOff, z: cornerOff, doorSide: 'south', isCorner: true });
  idx++;
  layout.push({ roomId: `R${base + idx}`, x: -cornerOff, z: cornerOff, doorSide: 'south', isCorner: true });
  idx++;
  layout.push({ roomId: `R${base + idx}`, x: cornerOff, z: -cornerOff, doorSide: 'north', isCorner: true });
  idx++;
  layout.push({ roomId: `R${base + idx}`, x: -cornerOff, z: -cornerOff, doorSide: 'north', isCorner: true });
  idx++;
  return layout;
}

function createRoom(
  roomId: string,
  x: number,
  z: number,
  doorSide: DoorSide,
  selected: boolean,
  floorHitMap: Map<THREE.Mesh, string>
) {
  const w = ROOM_W;
  const d = ROOM_D;
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const wallMat = new THREE.MeshStandardMaterial({ color: WHITE });
  const wallThick = 0.06;
  const gap = DOOR_WIDTH;
  const segW = (w - gap) / 2;
  const segD = (d - gap) / 2;

  // Floor - clickable
  const floorGeom = new THREE.PlaneGeometry(w - 0.02, d - 0.02);
  const floorMat = new THREE.MeshStandardMaterial({
    color: WHITE,
    transparent: true,
    opacity: 0.98,
  });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData = { roomId };
  group.add(floor);
  floorHitMap.set(floor, roomId);

  // Walls — full walls where no door; door wall = two segments
  if (doorSide !== 'south') {
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_HEIGHT, wallThick), wallMat);
    back.position.set(0, WALL_HEIGHT / 2, -d / 2);
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);
  } else {
    const leftSeg = new THREE.Mesh(new THREE.BoxGeometry(segW, WALL_HEIGHT, wallThick), wallMat);
    leftSeg.position.set(-gap / 2 - segW / 2, WALL_HEIGHT / 2, -d / 2);
    leftSeg.castShadow = true;
    leftSeg.receiveShadow = true;
    group.add(leftSeg);
    const rightSeg = new THREE.Mesh(new THREE.BoxGeometry(segW, WALL_HEIGHT, wallThick), wallMat);
    rightSeg.position.set(gap / 2 + segW / 2, WALL_HEIGHT / 2, -d / 2);
    rightSeg.castShadow = true;
    rightSeg.receiveShadow = true;
    group.add(rightSeg);
  }
  if (doorSide !== 'north') {
    const front = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_HEIGHT, wallThick), wallMat);
    front.position.set(0, WALL_HEIGHT / 2, d / 2);
    front.castShadow = true;
    front.receiveShadow = true;
    group.add(front);
  } else {
    const leftSeg = new THREE.Mesh(new THREE.BoxGeometry(segW, WALL_HEIGHT, wallThick), wallMat);
    leftSeg.position.set(-gap / 2 - segW / 2, WALL_HEIGHT / 2, d / 2);
    leftSeg.castShadow = true;
    leftSeg.receiveShadow = true;
    group.add(leftSeg);
    const rightSeg = new THREE.Mesh(new THREE.BoxGeometry(segW, WALL_HEIGHT, wallThick), wallMat);
    rightSeg.position.set(gap / 2 + segW / 2, WALL_HEIGHT / 2, d / 2);
    rightSeg.castShadow = true;
    rightSeg.receiveShadow = true;
    group.add(rightSeg);
  }
  if (doorSide !== 'west') {
    const left = new THREE.Mesh(new THREE.BoxGeometry(wallThick, WALL_HEIGHT, d), wallMat);
    left.position.set(-w / 2, WALL_HEIGHT / 2, 0);
    left.castShadow = true;
    left.receiveShadow = true;
    group.add(left);
  } else {
    const topSeg = new THREE.Mesh(new THREE.BoxGeometry(wallThick, WALL_HEIGHT, segD), wallMat);
    topSeg.position.set(-w / 2, WALL_HEIGHT / 2, gap / 2 + segD / 2);
    topSeg.castShadow = true;
    topSeg.receiveShadow = true;
    group.add(topSeg);
    const botSeg = new THREE.Mesh(new THREE.BoxGeometry(wallThick, WALL_HEIGHT, segD), wallMat);
    botSeg.position.set(-w / 2, WALL_HEIGHT / 2, -gap / 2 - segD / 2);
    botSeg.castShadow = true;
    botSeg.receiveShadow = true;
    group.add(botSeg);
  }
  if (doorSide !== 'east') {
    const right = new THREE.Mesh(new THREE.BoxGeometry(wallThick, WALL_HEIGHT, d), wallMat);
    right.position.set(w / 2, WALL_HEIGHT / 2, 0);
    right.castShadow = true;
    right.receiveShadow = true;
    group.add(right);
  } else {
    const topSeg = new THREE.Mesh(new THREE.BoxGeometry(wallThick, WALL_HEIGHT, segD), wallMat);
    topSeg.position.set(w / 2, WALL_HEIGHT / 2, gap / 2 + segD / 2);
    topSeg.castShadow = true;
    topSeg.receiveShadow = true;
    group.add(topSeg);
    const botSeg = new THREE.Mesh(new THREE.BoxGeometry(wallThick, WALL_HEIGHT, segD), wallMat);
    botSeg.position.set(w / 2, WALL_HEIGHT / 2, -gap / 2 - segD / 2);
    botSeg.castShadow = true;
    botSeg.receiveShadow = true;
    group.add(botSeg);
  }

  // Transparent blue highlight when selected
  const highlightGeom = new THREE.BoxGeometry(w - 0.1, WALL_HEIGHT - 0.05, d - 0.1);
  const highlightMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const highlight = new THREE.Mesh(highlightGeom, highlightMat);
  highlight.position.set(0, WALL_HEIGHT / 2, 0);
  highlight.visible = selected;
  group.add(highlight);
  (group as THREE.Group & { highlightMesh?: THREE.Mesh }).highlightMesh = highlight;

  const mat = new THREE.MeshStandardMaterial({ color: WHITE });
  // Bed: perpendicular to side walls (the walls without the door), against one side wall.
  // Pillow (head) toward back wall. So bed runs along door→back axis, offset to one side.
  const bedW = 0.65;
  const bedL = 1.2;
  const bedMat = new THREE.MeshStandardMaterial({ color: WHITE });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.35, bedL), bedMat);
  bed.castShadow = true;
  bed.receiveShadow = true;
  const sideOffset = w / 2 - bedW / 2 - 0.12;
  if (doorSide === 'south') {
    bed.position.set(-sideOffset, 0.2, d / 2 - bedL / 2 - 0.1);
  } else if (doorSide === 'north') {
    bed.position.set(-sideOffset, 0.2, -d / 2 + bedL / 2 + 0.1);
  } else if (doorSide === 'east') {
    bed.rotation.y = Math.PI / 2;
    bed.position.set(-w / 2 + bedL / 2 + 0.1, 0.2, sideOffset);
  } else {
    bed.rotation.y = Math.PI / 2;
    bed.position.set(w / 2 - bedL / 2 - 0.1, 0.2, sideOffset);
  }
  group.add(bed);

  // Bedside table next to bed (between bed and door side)
  const tableMat = new THREE.MeshStandardMaterial({ color: WHITE });
  const table = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 0.32), tableMat);
  table.castShadow = true;
  table.receiveShadow = true;
  if (doorSide === 'south') {
    table.position.set(-sideOffset + 0.5, 0.23, d / 2 - bedL - 0.15);
  } else if (doorSide === 'north') {
    table.position.set(-sideOffset + 0.5, 0.23, -d / 2 + bedL + 0.15);
  } else if (doorSide === 'east') {
    table.position.set(-w / 2 + bedL + 0.15, 0.23, sideOffset + 0.35);
  } else {
    table.position.set(w / 2 - bedL - 0.15, 0.23, sideOffset + 0.35);
  }
  group.add(table);

  // Monitor stand + screen next to bed
  const standMat = new THREE.MeshStandardMaterial({ color: WHITE });
  const monitorStand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), standMat);
  const screenMat = new THREE.MeshStandardMaterial({ color: WHITE });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.02), screenMat);
  monitorStand.castShadow = true;
  monitorStand.receiveShadow = true;
  screen.castShadow = true;
  screen.receiveShadow = true;
  screen.position.y = 0.4;
  monitorStand.add(screen);
  if (doorSide === 'south') {
    monitorStand.position.set(-sideOffset - 0.42, 0.38, d / 2 - bedL / 2 - 0.15);
  } else if (doorSide === 'north') {
    monitorStand.position.set(-sideOffset - 0.42, 0.38, -d / 2 + bedL / 2 + 0.15);
  } else if (doorSide === 'east') {
    monitorStand.position.set(-w / 2 + bedL / 2 + 0.15, 0.38, sideOffset - 0.42);
  } else {
    monitorStand.position.set(w / 2 - bedL / 2 - 0.15, 0.38, sideOffset - 0.42);
  }
  group.add(monitorStand);

  // IV stand next to bed (other side from monitor)
  const ivPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), mat);
  const ivBag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.06), mat);
  ivBag.position.y = 0.6;
  ivPole.add(ivBag);
  ivPole.castShadow = true;
  ivPole.receiveShadow = true;
  if (doorSide === 'south') {
    ivPole.position.set(-sideOffset + 0.42, 0.55, d / 2 - bedL / 2 - 0.15);
  } else if (doorSide === 'north') {
    ivPole.position.set(-sideOffset + 0.42, 0.55, -d / 2 + bedL / 2 + 0.15);
  } else if (doorSide === 'east') {
    ivPole.position.set(-w / 2 + bedL / 2 + 0.15, 0.55, sideOffset + 0.42);
  } else {
    ivPole.position.set(w / 2 - bedL / 2 - 0.15, 0.55, sideOffset + 0.42);
  }
  group.add(ivPole);

  return group;
}

const ENTRANCE_WIDTH = 1.4;

function addCenterAndHallway(scene: THREE.Scene) {
  const wallMat = new THREE.MeshStandardMaterial({ color: WHITE });
  const floorMat = new THREE.MeshStandardMaterial({ color: WHITE });
  const c = CENTER_SIZE / 2;
  const h = HALLWAY_WIDTH;
  const wallThick = 0.06;
  const wallH = WALL_HEIGHT;

  // Center (nurse station) floor
  const centerFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(CENTER_SIZE, CENTER_SIZE),
    floorMat
  );
  centerFloor.rotation.x = -Math.PI / 2;
  centerFloor.receiveShadow = true;
  scene.add(centerFloor);

  // North hallway floor
  const northHall = new THREE.Mesh(
    new THREE.PlaneGeometry(CENTER_SIZE + 2 * h, h),
    floorMat
  );
  northHall.rotation.x = -Math.PI / 2;
  northHall.position.set(0, 0, c + h / 2);
  northHall.receiveShadow = true;
  scene.add(northHall);
  const southHall = new THREE.Mesh(
    new THREE.PlaneGeometry(CENTER_SIZE + 2 * h, h),
    floorMat
  );
  southHall.rotation.x = -Math.PI / 2;
  southHall.position.set(0, 0, -(c + h / 2));
  southHall.receiveShadow = true;
  scene.add(southHall);
  const eastHall = new THREE.Mesh(
    new THREE.PlaneGeometry(h, CENTER_SIZE),
    floorMat
  );
  eastHall.rotation.x = -Math.PI / 2;
  eastHall.position.set(c + h / 2, 0, 0);
  eastHall.receiveShadow = true;
  scene.add(eastHall);
  const westHall = new THREE.Mesh(
    new THREE.PlaneGeometry(h, CENTER_SIZE),
    floorMat
  );
  westHall.rotation.x = -Math.PI / 2;
  westHall.position.set(-(c + h / 2), 0, 0);
  westHall.receiveShadow = true;
  scene.add(westHall);

  // Center walls — south has entrance (two segments)
  const northCenterWall = new THREE.Mesh(new THREE.BoxGeometry(CENTER_SIZE, wallH, wallThick), wallMat);
  northCenterWall.position.set(0, wallH / 2, c);
  northCenterWall.castShadow = true;
  northCenterWall.receiveShadow = true;
  scene.add(northCenterWall);
  const segW = (CENTER_SIZE - ENTRANCE_WIDTH) / 2;
  const southLeft = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallThick), wallMat);
  southLeft.position.set(-ENTRANCE_WIDTH / 2 - segW / 2, wallH / 2, -c);
  southLeft.castShadow = true;
  southLeft.receiveShadow = true;
  scene.add(southLeft);
  const southRight = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallThick), wallMat);
  southRight.position.set(ENTRANCE_WIDTH / 2 + segW / 2, wallH / 2, -c);
  southRight.castShadow = true;
  southRight.receiveShadow = true;
  scene.add(southRight);
  const eastCenterWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, CENTER_SIZE), wallMat);
  eastCenterWall.position.set(c, wallH / 2, 0);
  eastCenterWall.castShadow = true;
  eastCenterWall.receiveShadow = true;
  scene.add(eastCenterWall);
  const westCenterWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, CENTER_SIZE), wallMat);
  westCenterWall.position.set(-c, wallH / 2, 0);
  westCenterWall.castShadow = true;
  westCenterWall.receiveShadow = true;
  scene.add(westCenterWall);

  // Central room furniture: desks, chairs, monitors
  const deskMat = new THREE.MeshStandardMaterial({ color: WHITE });
  const desk1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.6), deskMat);
  desk1.position.set(-0.8, 0.2, 0.5);
  desk1.castShadow = true;
  desk1.receiveShadow = true;
  scene.add(desk1);
  const desk2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.6), deskMat);
  desk2.position.set(0.8, 0.2, 0.5);
  desk2.castShadow = true;
  desk2.receiveShadow = true;
  scene.add(desk2);
  const desk3 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), deskMat);
  desk3.position.set(0, 0.2, -0.4);
  desk3.castShadow = true;
  desk3.receiveShadow = true;
  scene.add(desk3);
  const chairMat = new THREE.MeshStandardMaterial({ color: WHITE });
  const chair1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.35), chairMat);
  chair1.position.set(-0.8, 0.25, 0.15);
  chair1.castShadow = true;
  chair1.receiveShadow = true;
  scene.add(chair1);
  const chair2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.35), chairMat);
  chair2.position.set(0.8, 0.25, 0.15);
  chair2.castShadow = true;
  chair2.receiveShadow = true;
  scene.add(chair2);
  const chair3 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.35), chairMat);
  chair3.position.set(0, 0.25, -0.65);
  chair3.castShadow = true;
  chair3.receiveShadow = true;
  scene.add(chair3);
  const monMat = new THREE.MeshStandardMaterial({ color: WHITE });
  const monStand1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.05), monMat);
  const monScreen1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.02), monMat);
  monScreen1.position.y = 0.2;
  monStand1.add(monScreen1);
  monStand1.position.set(-0.8, 0.18, 0.8);
  monStand1.castShadow = true;
  monStand1.receiveShadow = true;
  scene.add(monStand1);
  const monStand2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.05), monMat);
  const monScreen2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.02), monMat);
  monScreen2.position.y = 0.2;
  monStand2.add(monScreen2);
  monStand2.position.set(0.8, 0.18, 0.8);
  monStand2.castShadow = true;
  monStand2.receiveShadow = true;
  scene.add(monStand2);
  const monStand3 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), monMat);
  const monScreen3 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.02), monMat);
  monScreen3.position.y = 0.22;
  monStand3.add(monScreen3);
  monStand3.position.set(0, 0.2, -0.15);
  monStand3.castShadow = true;
  monStand3.receiveShadow = true;
  scene.add(monStand3);
}

export function HospitalMap3D({
  rows,
  cols,
  selectedFloor,
  selectedRoom,
  onRoomSelect,
}: {
  rows: number;
  cols: number;
  selectedFloor: number;
  selectedRoom: string | null;
  onRoomSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const roomsGroupRef = useRef<THREE.Group | null>(null);
  const floorHitMapRef = useRef<Map<THREE.Mesh, string>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const onRoomSelectRef = useRef(onRoomSelect);
  onRoomSelectRef.current = onRoomSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeeeeee);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 18, 16);
    camera.lookAt(0, 0, -2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xeeeeee, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.minDistance = 8;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;

    const ambient = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight.position.set(10, 14, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.bias = -0.0001;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-8, 10, -6);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.35);
    backLight.position.set(0, 8, -10);
  scene.add(backLight);

    addCenterAndHallway(scene);

    const roomsGroup = new THREE.Group();
    scene.add(roomsGroup);
    roomsGroupRef.current = roomsGroup;

    const floorHitMap = new Map<THREE.Mesh, string>();
    floorHitMapRef.current = floorHitMap;

    function buildRooms() {
      roomsGroup.clear();
      floorHitMap.clear();
      const layout = getRoomLayout(rows, cols, selectedFloor);
      layout.forEach(({ roomId, x, z, doorSide }) => {
        const room = createRoom(
          roomId,
          x,
          z,
          doorSide,
          selectedRoom === roomId,
          floorHitMap
        );
        roomsGroup.add(room);
      });
      roomsGroup.children.forEach((group) => {
        const g = group as THREE.Group & { highlightMesh?: THREE.Mesh };
        const floor = g.children[0] as THREE.Mesh;
        const roomId = (floor.userData as { roomId: string }).roomId;
        if (g.highlightMesh) g.highlightMesh.visible = selectedRoom === roomId;
      });
    }

    buildRooms();

    function onClick(e: MouseEvent) {
      const canvas = renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const floorMeshes = Array.from(floorHitMapRef.current.keys());
      const hits = raycasterRef.current.intersectObjects(floorMeshes);
      if (hits.length > 0 && hits[0].object) {
        const roomId = floorHitMapRef.current.get(hits[0].object as THREE.Mesh);
        if (roomId) {
          e.preventDefault();
          e.stopPropagation();
          const id = roomId;
          setTimeout(() => {
            onRoomSelectRef.current(id);
          }, 0);
        }
      }
    }

    const canvas = renderer.domElement;
    canvas.addEventListener('click', onClick);

    function resize() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let frame = 0;
    function animate() {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      canvas.removeEventListener('click', onClick);
      container.removeChild(renderer.domElement);
      renderer.dispose();
      sceneRef.current = null;
      roomsGroupRef.current = null;
      floorHitMapRef.current = new Map();
    };
  }, [rows, cols, selectedFloor]);

  // Update room selection highlight when selectedRoom changes (no full rebuild)
  useEffect(() => {
    const roomsGroup = roomsGroupRef.current;
    if (!roomsGroup) return;
    roomsGroup.children.forEach((group) => {
      const g = group as THREE.Group & { highlightMesh?: THREE.Mesh };
      const floor = g.children[0] as THREE.Mesh;
      const roomId = (floor.userData as { roomId: string }).roomId;
      if (g.highlightMesh) g.highlightMesh.visible = selectedRoom === roomId;
    });
  }, [selectedRoom]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[420px] rounded-lg overflow-hidden bg-[#eeeeee]"
      style={{ cursor: 'pointer' }}
    />
  );
}
