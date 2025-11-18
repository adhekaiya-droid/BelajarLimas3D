const canvas = document.getElementById("canvas");

// === SCENE SETUP ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f5f5);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(4, 4, 4);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// === MATERIALS ===
const matBase = new THREE.MeshStandardMaterial({
  color: 0x00bcd4, // alas biru muda
  side: THREE.DoubleSide,
});

const matSide = new THREE.MeshStandardMaterial({
  color: 0xffeb3b, // sisi kuning
  side: THREE.DoubleSide,
});

const matHighlight = new THREE.MeshStandardMaterial({
  color: 0x00ff00,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.8,
});

const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000 });

// === PARAM GLOBAL LIMAS MODEL ===
let currentN = 4; // default segiempat
const modelRadius = 1.5;
const modelHeight = 2;
const centerBase = new THREE.Vector3(0, 0, 0);
let apexPoint = new THREE.Vector3(0, modelHeight, 0);

let verticesBase = [];
let baseMesh = null;
let sideMeshes = [];
let allFaces = [];

// Group untuk limas & rusuk
const limasGroup = new THREE.Group();
scene.add(limasGroup);

const edgesGroup = new THREE.Group();
scene.add(edgesGroup);

// === GARIS TINGGI ===
const heightGeo = new THREE.BufferGeometry().setFromPoints([
  apexPoint,
  centerBase,
]);
const heightMat = new THREE.LineBasicMaterial({ color: 0x0000ff });
const heightLine = new THREE.Line(heightGeo, heightMat);
heightLine.visible = false;
scene.add(heightLine);

const dot = new THREE.Mesh(
  new THREE.SphereGeometry(0.05, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0x0000ff })
);
dot.position.copy(centerBase);
dot.visible = false;
scene.add(dot);

// === LABEL DOM ===
const baseLabelElems = [
  document.getElementById("labelA"),
  document.getElementById("labelB"),
  document.getElementById("labelC"),
  document.getElementById("labelD"),
  document.getElementById("labelE"),
  document.getElementById("labelF"),
];
const labelP = document.getElementById("labelP");
let showLabels = false;
let labelPoints = [];

function updateLabel(labelEl, point3D) {
  const v = point3D.clone().project(camera);
  labelEl.style.left = ((v.x + 1) / 2) * window.innerWidth + "px";
  labelEl.style.top = ((-v.y + 1) / 2) * window.innerHeight + "px";
}

// === ANIMASI JARING (MORPH) ===
let openTarget = 0; // 0 tertutup, 1 jaring full
let openT = 0;
const openSpeed = 0.08;

function updateMorph(mesh, t) {
  const closed = mesh.userData.closed;
  const open = mesh.userData.open;
  const posAttr = mesh.geometry.getAttribute("position");
  for (let i = 0; i < closed.length; i++) {
    posAttr.array[i] = closed[i] * (1 - t) + open[i] * t;
  }
  posAttr.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

// === TRANSPARANSI ===
let transparentMode = false;
function applyTransparency() {
  allFaces.forEach((mesh) => {
    const mat = mesh.material;
    if (mesh.material === matHighlight) {
      mat.transparent = true;
      mat.opacity = transparentMode ? 0.4 : 0.8;
    } else {
      mat.transparent = transparentMode;
      mat.opacity = transparentMode ? 0.4 : 1.0;
    }
  });
}

// === BUILD LIMAS BERDASARKAN N ===
function buildLimas(n) {
  currentN = n;
  apexPoint = new THREE.Vector3(0, modelHeight, 0);

  verticesBase = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2; // mulai dari atas
    const x = modelRadius * Math.cos(angle);
    const z = modelRadius * Math.sin(angle);
    verticesBase.push(new THREE.Vector3(x, 0, z));
  }

  // kosongkan group
  while (limasGroup.children.length) limasGroup.remove(limasGroup.children[0]);
  while (edgesGroup.children.length) edgesGroup.remove(edgesGroup.children[0]);

  allFaces = [];
  sideMeshes = [];

  // === alas: triangulasi kipas dari pusat ===
  const baseVerts = [];
  for (let i = 0; i < n; i++) {
    const v1 = verticesBase[i];
    const v2 = verticesBase[(i + 1) % n];
    baseVerts.push(
      centerBase.x,
      centerBase.y,
      centerBase.z,
      v1.x,
      v1.y,
      v1.z,
      v2.x,
      v2.y,
      v2.z
    );
  }
  const baseGeo = new THREE.BufferGeometry();
  baseGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(baseVerts), 3)
  );
  baseGeo.computeVertexNormals();
  baseMesh = new THREE.Mesh(baseGeo, matBase);
  baseMesh.userData.defaultMaterial = matBase;
  limasGroup.add(baseMesh);
  allFaces.push(baseMesh);

  // === sisi-sisi segitiga (morph) ===
  for (let i = 0; i < n; i++) {
    const v1 = verticesBase[i];
    const v2 = verticesBase[(i + 1) % n];

    const mid = v1.clone().add(v2).multiplyScalar(0.5);
    const dir = mid.clone().normalize();
    const tipOpen = mid.clone().add(dir.multiplyScalar(modelRadius));

    const closed = [
      v1.x,
      v1.y,
      v1.z,
      v2.x,
      v2.y,
      v2.z,
      apexPoint.x,
      apexPoint.y,
      apexPoint.z,
    ];
    const open = [
      v1.x,
      0,
      v1.z,
      v2.x,
      0,
      v2.z,
      tipOpen.x,
      0,
      tipOpen.z,
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(closed), 3)
    );
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, matSide);
    mesh.userData.closed = closed;
    mesh.userData.open = open;
    mesh.userData.defaultMaterial = matSide;
    limasGroup.add(mesh);
    sideMeshes.push(mesh);
    allFaces.push(mesh);

    // rusuk alas
    let edgeGeo = new THREE.BufferGeometry().setFromPoints([v1, v2]);
    edgesGroup.add(new THREE.Line(edgeGeo, edgeMat));
    // rusuk sisi
    edgeGeo = new THREE.BufferGeometry().setFromPoints([v1, apexPoint]);
    edgesGroup.add(new THREE.Line(edgeGeo, edgeMat));
  }

  // garis tinggi update
  heightGeo.setFromPoints([apexPoint, centerBase]);
  heightGeo.attributes.position.needsUpdate = true;

  // titik label
  labelPoints = verticesBase.slice();

  // reset anim
  openT = 0;
  if (openTarget === 1) openTarget = 1; // biar kalau mode jaring, dia buka lagi pelan

  // terapkan transparansi saat ini
  applyTransparency();
}

// === LIGHTING ===
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

// === HIGHLIGHT ===
let highlightMode = false;
let isHighlighted = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener("mousemove", (e) => {
  if (!highlightMode) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(allFaces);

  if (hits.length > 0) {
    if (!isHighlighted) {
      allFaces.forEach((m) => (m.material = matHighlight));
      applyTransparency();
      isHighlighted = true;
    }
  } else {
    if (isHighlighted) {
      allFaces.forEach((m) => (m.material = m.userData.defaultMaterial));
      applyTransparency();
      isHighlighted = false;
    }
  }
});

// === PANEL MATERI & KALKULATOR ===
const panel = document.getElementById("panel");
const judulLimas = document.getElementById("judulLimas");
const materiText = document.getElementById("materiText");
const rumusText = document.getElementById("rumusText");
const selectJenis = document.getElementById("selectJenis");

function updateMateri(n) {
  let nama = "";
  if (n === 3) nama = "Limas Segitiga";
  else if (n === 4) nama = "Limas Segiempat";
  else if (n === 5) nama = "Limas Segilima";
  else if (n === 6) nama = "Limas Segienam";

  judulLimas.textContent = nama;

  materiText.innerHTML =
    `${nama} adalah bangun ruang yang alasnya berupa ` +
    `${n}-sisi beraturan dan satu titik puncak di atas alas. ` +
    `Setiap rusuk alas terhubung ke titik puncak membentuk sisi tegak berbentuk segitiga.`;

  rumusText.innerHTML =
    `<b>Rumus umum:</b><br>` +
    `&bull; Volume: <i>V = 1/3 &times; L<sub>alas</sub> &times; t</i><br>` +
    `&bull; Luas permukaan: <i>L = L<sub>alas</sub> + L<sub>selimut</sub></i><br>` +
    `Untuk alas beraturan: <i>L<sub>alas</sub> = (n &times; s²) / (4 tan(π/n))</i>`;
}

selectJenis.addEventListener("change", () => {
  const n = parseInt(selectJenis.value, 10);
  buildLimas(n);
  updateMateri(n);
});

// Kalkulator
const inputSisi = document.getElementById("inputSisi");
const inputTinggi = document.getElementById("inputTinggi");
const resLuasAlas = document.getElementById("resLuasAlas");
const resLuasSelimut = document.getElementById("resLuasSelimut");
const resLuasTotal = document.getElementById("resLuasTotal");
const resVolume = document.getElementById("resVolume");

document.getElementById("btnHitung").addEventListener("click", () => {
  const n = currentN;
  const sUser = parseFloat(inputSisi.value);
  const tUser = parseFloat(inputTinggi.value);
  if (!sUser || !tUser || sUser <= 0 || tUser <= 0) return;

  // luas alas n-gon beraturan
  const luasAlas = (n * sUser * sUser) / (4 * Math.tan(Math.PI / n));
  // jarak pusat ke tengah sisi (apotema alas)
  const r = sUser / (2 * Math.tan(Math.PI / n));
  const tinggiSegitigaSelimut = Math.sqrt(tUser * tUser + r * r);
  const luasSelimut = n * 0.5 * sUser * tinggiSegitigaSelimut;
  const luasTotal = luasAlas + luasSelimut;
  const volume = (1 / 3) * luasAlas * tUser;

  resLuasAlas.textContent = luasAlas.toFixed(2);
  resLuasSelimut.textContent = luasSelimut.toFixed(2);
  resLuasTotal.textContent = luasTotal.toFixed(2);
  resVolume.textContent = volume.toFixed(2);
});

// === BUTTON HANDLERS KIRI ===
document.getElementById("btnJaring").onclick = () => {
  openTarget = 1;
};

document.getElementById("btnNormal").onclick = () => {
  openTarget = 0;
};

document.getElementById("btnLabelTitik").onclick = () => {
  showLabels = !showLabels;
};

document.getElementById("btnTinggi").onclick = () => {
  const vis = !heightLine.visible;
  heightLine.visible = vis;
  dot.visible = vis;
};

document.getElementById("btnHighlight").onclick = () => {
  highlightMode = !highlightMode;
  if (!highlightMode && isHighlighted) {
    allFaces.forEach((m) => (m.material = m.userData.defaultMaterial));
    applyTransparency();
    isHighlighted = false;
  }
};

document.getElementById("btnTransparan").onclick = () => {
  transparentMode = !transparentMode;
  applyTransparency();
};

let showPanel = false;
document.getElementById("btnCalcMateri").onclick = () => {
  showPanel = !showPanel;
  panel.style.display = showPanel ? "block" : "none";
};

// === MAIN LOOP ===
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // animasi jaring
  openT += (openTarget - openT) * openSpeed;
  sideMeshes.forEach((m) => updateMorph(m, openT));

  // label
  if (showLabels) {
    for (let i = 0; i < baseLabelElems.length; i++) {
      if (i < labelPoints.length) {
        baseLabelElems[i].style.display = "block";
        updateLabel(baseLabelElems[i], labelPoints[i]);
      } else {
        baseLabelElems[i].style.display = "none";
      }
    }
    labelP.style.display = "block";
    updateLabel(labelP, apexPoint);
  } else {
    baseLabelElems.forEach((l) => (l.style.display = "none"));
    labelP.style.display = "none";
  }

  renderer.render(scene, camera);
}
animate();

// === RESIZE ===
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === INISIALISASI AWAL ===
buildLimas(currentN);
updateMateri(currentN);
applyTransparency();
