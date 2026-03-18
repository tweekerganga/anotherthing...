let scene, camera, renderer, world, pubnub;
let peers = {}, balls = [], keys = {};
const myID = "pete_" + Math.random().toString(36).substr(2, 4);
let yaw = 0, pitch = 0;

function initGmod() {
    document.getElementById('join-screen').style.display = 'none';
    const container = document.getElementById('gmod-void');

    // 1. SCENE SETUP
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);

    // 2. CAMERA (The Player)
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    // SPAWN FROM HEIGHT: Start at Y=20 (in the sky)
    camera.position.set(0, 20, 5); 

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // 3. PHYSICS (CANNON)
    world = new CANNON.World();
    world.gravity.set(0, -18, 0); // Crunchy gravity

    // THE SOLID FLOOR (Collision)
    const floorBody = new CANNON.Body({ mass: 0 });
    floorBody.addShape(new CANNON.Plane());
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(floorBody);

    // THE VISUAL FLOOR
    const grid = new THREE.GridHelper(1000, 100, 0xff0055, 0x222222);
    scene.add(grid);
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0x050505 }));
    floorMesh.rotation.x = -Math.PI / 2;
    scene.add(floorMesh);

    // 4. THE GUN (Stick within a stick)
    const gun = new THREE.Group();
    const part1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6), new THREE.MeshStandardMaterial({color: 0x333333}));
    part1.rotation.x = Math.PI / 2;
    const part2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), new THREE.MeshStandardMaterial({color: 0x666666}));
    part2.position.z = -0.3;
    part2.rotation.x = Math.PI / 2;
    gun.add(part1, part2);
    gun.position.set(0.4, -0.3, -0.5);
    camera.add(gun);
    scene.add(camera);

    // 5. LIGHTING
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const pLight = new THREE.PointLight(0xffaa00, 2, 50);
    pLight.position.set(0, 10, 0);
    scene.add(pLight);

    // 6. MULTIPLAYER (PubNub)
    pubnub = new PubNub({ publishKey: 'pub-c-4627d355-6b60-466d-965a-0d924d6274e1', subscribeKey: 'sub-c-5727932c-352b-11eb-a63e-f23023e981f3', uuid: myID });
    pubnub.subscribe({ channels: ['pete_void_v6'] });
    pubnub.addListener({ message: (m) => { if (m.publisher !== myID) updatePeer(m.publisher, m.message); } });

    // 7. INPUT HANDLING
    container.addEventListener('click', () => { container.requestPointerLock(); spawnBall(); });
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === container) {
            yaw -= e.movementX * 0.002;
            pitch -= e.movementY * 0.002;
            pitch = Math.max(-1.5, Math.min(1.5, pitch));
        }
    });
    window.onkeydown = (e) => keys[e.key.toLowerCase()] = true;
    window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;

    animate();
}

function createStickman() {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2), m); head.position.y = 1.7;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8), m); body.position.y = 1.1;
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6), m); armL.position.set(0.3, 1.3, 0); armL.rotation.z = 1;
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6), m); armR.position.set(-0.3, 1.3, 0); armR.rotation.z = -1;
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8), m); legL.position.set(0.15, 0.4, 0);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8), m); legR.position.set(-0.15, 0.4, 0);
    g.add(head, body, armL, armR, legL, legR);
    return g;
}

function spawnBall() {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshStandardMaterial({color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.5}));
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 5, shape: new CANNON.Sphere(0.3) });
    body.position.copy(camera.position);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    body.velocity.set(dir.x * 25, dir.y * 25, dir.z * 25);
    world.addBody(body);
    balls.push({ mesh, body });
}

function updatePeer(id, data) {
    if (!peers[id]) {
        peers[id] = createStickman();
        scene.add(peers[id]);
    }
    peers[id].position.set(data.x, data.y - 1.6, data.z); // Adjust height so feet touch ground
    peers[id].rotation.y = data.ry;
    document.getElementById('peer-count').innerText = Object.keys(peers).length + 1;
}

function animate() {
    requestAnimationFrame(animate);
    world.step(1/60);

    if (camera) {
        // Falling Physics (Gravity simulation for player)
        if (camera.position.y > 1.6) camera.position.y -= 0.15; // Simple gravity drop
        else camera.position.y = 1.6; // Floor level

        const s = 0.18;
        if (keys['w']) { camera.position.x -= Math.sin(yaw) * s; camera.position.z -= Math.cos(yaw) * s; }
        if (keys['s']) { camera.position.x += Math.sin(yaw) * s; camera.position.z += Math.cos(yaw) * s; }
        if (keys['a']) { camera.position.x -= Math.cos(yaw) * s; camera.position.z += Math.sin(yaw) * s; }
        if (keys['d']) { camera.position.x += Math.cos(yaw) * s; camera.position.z -= Math.sin(yaw) * s; }
        camera.rotation.set(pitch, yaw, 0, 'YXZ');
        
        if (Date.now() % 10 === 0) {
            pubnub.publish({ channel: 'pete_void_v6', message: { x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: yaw } });
        }
    }

    balls.forEach(b => { b.mesh.position.copy(b.body.position); b.mesh.quaternion.copy(b.body.quaternion); });
    renderer.render(scene, camera);
}
