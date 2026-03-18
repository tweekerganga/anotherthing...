let scene, camera, renderer, world, pubnub;
let peers = {}, balls = [], keys = {};
const myID = "pete_" + Math.random().toString(36).substr(2, 4);
let yaw = 0, pitch = 0;

function initGmod() {
    document.getElementById('join-screen').style.display = 'none';
    const container = document.getElementById('gmod-void');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);

    camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 30, 10); // HIGH SKY SPAWN

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // --- PHYSICS ENGINE ---
    world = new CANNON.World();
    world.gravity.set(0, -20, 0); 

    // THE INGENIOUS FLOOR: A 10-unit thick slab so balls CANNOT pass through it
    const floorShape = new CANNON.Box(new CANNON.Vec3(500, 5, 500)); 
    const floorBody = new CANNON.Body({ mass: 0 }); 
    floorBody.addShape(floorShape);
    floorBody.position.set(0, -5, 0); // Top of the box is at Y=0
    world.addBody(floorBody);

    // VISUAL FLOOR
    const grid = new THREE.GridHelper(1000, 100, 0xff0055, 0x222222);
    scene.add(grid);

    // GUN (Double Stick)
    const gun = new THREE.Group();
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), new THREE.MeshStandardMaterial({color: 0x333333}));
    b1.rotation.x = Math.PI/2;
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), new THREE.MeshStandardMaterial({color: 0x666666}));
    b2.position.z = -0.3; b2.rotation.x = Math.PI/2;
    gun.add(b1, b2); gun.position.set(0.4, -0.3, -0.5);
    camera.add(gun); scene.add(camera);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // MULTIPLAYER SYNC
    pubnub = new PubNub({ 
        publishKey: 'pub-c-4627d355-6b60-466d-965a-0d924d6274e1', 
        subscribeKey: 'sub-c-5727932c-352b-11eb-a63e-f23023e981f3', 
        uuid: myID,
        ssl: true 
    });
    pubnub.subscribe({ channels: ['pete_void_v10'] });
    pubnub.addListener({ message: (m) => { if (m.publisher !== myID) updatePeer(m.publisher, m.message); } });

    container.addEventListener('click', () => { container.requestPointerLock(); spawnBall(); });
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === container) {
            yaw -= e.movementX * 0.002; pitch -= e.movementY * 0.002;
            pitch = Math.max(-1.5, Math.min(1.5, pitch));
        }
    });
    window.onkeydown = (e) => keys[e.key.toLowerCase()] = true;
    window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;

    animate();
}

function spawnBall() {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshStandardMaterial({color: 0x00ff00, emissive: 0x00ff00}));
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 5, shape: new CANNON.Sphere(0.3) });
    body.position.copy(camera.position);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    body.velocity.set(dir.x * 30, dir.y * 30, dir.z * 30);
    world.addBody(body);
    balls.push({ mesh, body });
}

function updatePeer(id, data) {
    if (!peers[id]) {
        const g = new THREE.Group();
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({color: 0xffffff})); head.position.y = 1.7;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), new THREE.MeshBasicMaterial({color: 0xffffff})); body.position.y = 1.1;
        const armL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), new THREE.MeshBasicMaterial({color: 0xffffff})); armL.position.set(0.3, 1.3, 0); armL.rotation.z = 1;
        const armR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), new THREE.MeshBasicMaterial({color: 0xffffff})); armR.position.set(-0.3, 1.3, 0); armR.rotation.z = -1;
        g.add(head, body, armL, armR);
        peers[id] = g; scene.add(g);
    }
    peers[id].position.set(data.x, data.y - 1.6, data.z);
    peers[id].rotation.y = data.ry;
    document.getElementById('peer-count').innerText = Object.keys(peers).length + 1;
}

function animate() {
    requestAnimationFrame(animate);
    world.step(1/60);
    if (camera) {
        // PLAYER GRAVITY
        if (camera.position.y > 1.65) camera.position.y -= 0.2; 
        else camera.position.y = 1.65;

        const s = 0.2;
        if (keys['w']) { camera.position.x -= Math.sin(yaw) * s; camera.position.z -= Math.cos(yaw) * s; }
        if (keys['s']) { camera.position.x += Math.sin(yaw) * s; camera.position.z += Math.cos(yaw) * s; }
        if (keys['a']) { camera.position.x -= Math.cos(yaw) * s; camera.position.z += Math.sin(yaw) * s; }
        if (keys['d']) { camera.position.x += Math.cos(yaw) * s; camera.position.z -= Math.sin(yaw) * s; }
        camera.rotation.set(pitch, yaw, 0, 'YXZ');
        if (Date.now() % 5 === 0) pubnub.publish({ channel: 'pete_void_v10', message: { x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: yaw } });
    }
    balls.forEach(b => { b.mesh.position.copy(b.body.position); b.mesh.quaternion.copy(b.body.quaternion); });
    renderer.render(scene, camera);
}
