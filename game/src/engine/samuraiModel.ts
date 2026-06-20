import * as THREE from 'three';

export function parseColor(colorStr: string): { r: number; g: number; b: number } {
  let hexStr = colorStr.trim();
  if (hexStr.startsWith('var(')) {
    if (hexStr.includes('pink')) hexStr = 'ff007f';
    else if (hexStr.includes('purple')) hexStr = 'b026ff';
    else hexStr = '00f0ff';
  } else {
    hexStr = hexStr.replace('#', '');
  }
  const hex = parseInt(hexStr, 16) || 0x00f0ff;
  return {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >> 8) & 255) / 255,
    b: (hex & 255) / 255
  };
}

export function createSamuraiCharacter() {
  const group = new THREE.Group();

  // Material definitions
  const armorMaterial = new THREE.MeshStandardMaterial({
    color: 0x0c0c14,
    metalness: 0.8,
    roughness: 0.3
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xff007f, // Neon pink accents
    emissive: 0xff007f,
    emissiveIntensity: 0.5
  });
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    metalness: 0.95,
    roughness: 0.15
  });
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0x050505,
    roughness: 0.5
  });
  const visorMaterial = new THREE.MeshBasicMaterial({
    color: 0x00f0ff // Neon blue visor
  });

  // Torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(5, 3.5, 14, 8), armorMaterial);
  torso.position.y = 12;
  (torso as any).isPlaceholder = true;
  group.add(torso);

  // Torso neon breastplate line
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 4.2), accentMaterial);
  plate.position.set(0, 12, 1);
  (plate as any).isPlaceholder = true;
  group.add(plate);

  // Left & Right Sode (Shoulder Armor)
  const leftSode = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 3.5), armorMaterial);
  leftSode.position.set(-6, 15, 0);
  leftSode.rotation.z = 0.2;
  (leftSode as any).isPlaceholder = true;
  group.add(leftSode);

  const rightSode = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 3.5), armorMaterial);
  rightSode.position.set(6, 15, 0);
  rightSode.rotation.z = -0.2;
  (rightSode as any).isPlaceholder = true;
  group.add(rightSode);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 16), headMaterial);
  head.position.set(0, 21, 0);
  (head as any).isPlaceholder = true;
  group.add(head);

  // Visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.8, 1), visorMaterial);
  visor.position.set(0, 21.2, 2.5);
  (visor as any).isPlaceholder = true;
  group.add(visor);

  // Kabuto Crest (Kuwagata horns)
  const hornLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 5, 8), goldMaterial);
  hornLeft.position.set(-1.5, 24, 2);
  hornLeft.rotation.set(0.2, 0, -0.6);
  (hornLeft as any).isPlaceholder = true;
  group.add(hornLeft);

  const hornRight = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 5, 8), goldMaterial);
  hornRight.position.set(1.5, 24, 2);
  hornRight.rotation.set(0.2, 0, 0.6);
  (hornRight as any).isPlaceholder = true;
  group.add(hornRight);

  // Golden circular crest emblem (maedate)
  const emblem = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.4, 16), goldMaterial);
  emblem.position.set(0, 23, 2.8);
  emblem.rotation.x = Math.PI / 2;
  (emblem as any).isPlaceholder = true;
  group.add(emblem);

  // Sword Hand / Arm Joint (Pivot for rotation)
  const armPivot = new THREE.Group();
  armPivot.position.set(4, 15, 0); // Position at right shoulder
  group.add(armPivot);

  // Right arm forearm pointing forward
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.9, 8, 8), armorMaterial);
  forearm.position.set(0, -4, 2);
  forearm.rotation.x = Math.PI / 3;
  armPivot.add(forearm);

  // Katana Sword (attached to arm pivot)
  const swordGroup = new THREE.Group();
  swordGroup.position.set(0, -7.5, 5.5);
  swordGroup.rotation.x = -Math.PI / 6; // align blade pointing forward/up
  armPivot.add(swordGroup);

  // Tsuka (Hilt)
  const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 8), armorMaterial);
  tsuka.position.y = -3;
  swordGroup.add(tsuka);

  // Golden wrapping accents on hilt
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1, 8), goldMaterial);
  wrap.position.y = -4;
  swordGroup.add(wrap);

  // Tsuba (Guard)
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 16), goldMaterial);
  tsuba.rotation.x = Math.PI / 2;
  swordGroup.add(tsuba);

  // Blade
  const bladeGeo = new THREE.BoxGeometry(0.2, 28, 0.8);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x00f0ff,
    emissiveIntensity: 2.5,
    metalness: 0.1,
    roughness: 0.1
  });
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.y = 14; // extend up from tsuba
  swordGroup.add(blade);

  // White core highlight (for lightsaber look)
  const bladeCore = new THREE.Mesh(new THREE.BoxGeometry(0.08, 27.8, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  bladeCore.position.y = 14;
  swordGroup.add(bladeCore);

  // Holographic shield dome (active when blocking)
  const shieldBarrierGeo = new THREE.SphereGeometry(18, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const shieldBarrierMat = new THREE.MeshStandardMaterial({
    color: 0xb026ff,
    emissive: 0xb026ff,
    emissiveIntensity: 2.0,
    transparent: true,
    opacity: 0.05,
    side: THREE.DoubleSide
  });
  const shieldBarrier = new THREE.Mesh(shieldBarrierGeo, shieldBarrierMat);
  shieldBarrier.position.y = 5;
  shieldBarrier.rotation.x = Math.PI / 2;
  group.add(shieldBarrier);

  return { group, armPivot, bladeMat, blade, shieldBarrier };
}

export function createEnemyMesh(type: string, color: string) {
  const group = new THREE.Group();
  const { r, g, b } = parseColor(color);

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(r, g, b),
    emissive: new THREE.Color(r, g, b),
    emissiveIntensity: 0.6,
    metalness: 0.5,
    roughness: 0.3
  });

  if (type === 'drone') {
    // Hexagonal hovering ship
    const geom = new THREE.CylinderGeometry(4.5, 4.5, 2, 6);
    const mesh = new THREE.Mesh(geom, material);
    group.add(mesh);

    // Add two small rotors on sides
    const rotorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const rotor1 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 0.6), rotorMat);
    rotor1.position.set(-5.5, 1, 0);
    group.add(rotor1);

    const rotor2 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 0.6), rotorMat);
    rotor2.position.set(5.5, 1, 0);
    group.add(rotor2);

    (group as any).rotors = [rotor1, rotor2];
  } 
  else if (type === 'shieldbot') {
    // Heavy defense box
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 7), material);
    group.add(body);

    // Front purple glowing shield barrier
    const shieldGeo = new THREE.BoxGeometry(9, 9, 0.8);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xb026ff,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.85
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(0, 0, 4.2);
    group.add(shield);
  } 
  else if (type === 'cyberninja') {
    // Sleek diamond octahedron
    const geom = new THREE.OctahedronGeometry(5);
    const mesh = new THREE.Mesh(geom, material);
    group.add(mesh);
  } 
  else if (type === 'kamikaze') {
    // Aggressive pointed cone
    const geom = new THREE.ConeGeometry(3.5, 9, 4);
    const mesh = new THREE.Mesh(geom, material);
    mesh.rotation.x = Math.PI / 2; // point forward
    group.add(mesh);
  } 
  else if (type === 'samurai') {
    // Gigantic scarlet boss samurai
    const body = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 5.5, 15, 8), material);
    group.add(body);

    // Horned helmet (Giant golden V horn)
    const crestMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.9 });
    const hornL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 8, 8), crestMat);
    hornL.position.set(-2, 9.5, 2);
    hornL.rotation.set(0.2, 0, -0.8);
    group.add(hornL);

    const hornR = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 8, 8), crestMat);
    hornR.position.set(2, 9.5, 2);
    hornR.rotation.set(0.2, 0, 0.8);
    group.add(hornR);
  }

  return group;
}
