struct Uniforms {
    res: vec2f,
    mouse: vec2f,
    mouseActive: f32,
    gravity: f32,
    mouseForce: f32,
    viscosity: f32,
    particleSize: f32,
    padding: vec3f,
}

struct Particle {
    pos: vec2f,
    vel: vec2f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage> pIn: array<Particle>;
@group(0) @binding(2) var<storage, read_write> pOut: array<Particle>;

const N: u32 = 25000u;
const RADIUS: f32 = 10.0;
const ATTRACT_RADIUS:f32 = 15.0;
const MOUSE_RADIUS: f32 = 120.0;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (i >= N) {
        return;
    }

    var pos = pIn[i].pos;
    var vel = pIn[i].vel;

    for (var j = 0u; j < N; j++) {
        if (j == i) {
            continue;
        }

        // Vector from j to i
        let diff = pos - pIn[j].pos;
        let dist = length(diff);

        // Repulsion
        // Pushes particles apart when overlapping
        // Scaled by how much they overlap
        if (dist < RADIUS && dist > 0.001) {
            let overlap = (RADIUS - dist) / RADIUS;
            vel += normalize(diff) * overlap * 150.0;
        }

        // Attraction
        // Pulls particles together
        // t = 0 at RADIUS, t = 1 at ATTRACT_RADIUS
        if (dist >= RADIUS && dist < ATTRACT_RADIUS) {
            let t = (dist - RADIUS) / (ATTRACT_RADIUS - RADIUS);
            vel -= normalize(diff) * t * 3.0;
        }

        // Viscosity
        // Nudge particle i's velocity towards neighbors' average
        if (dist < ATTRACT_RADIUS) {
            let w = 1.0 - dist / ATTRACT_RADIUS;
            vel += (pIn[j].vel - vel) * w * u.viscosity;
        }
    }

    // Mouse repulsion
    // Same logic as repulsion above just scaled by mouseForce
    if (u.mouseActive > 0.5) {
        // Vector from pos to mouse
        let toMouse = u.mouse - pos;
        let dist = length(toMouse);

        if (dist < MOUSE_RADIUS && dist > 0.001) {
            let overlap = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
            vel -= normalize(toMouse) * overlap * u.mouseForce;
        }
    }

    // Gravity and dampening
    vel.y += u.gravity;
    vel *= 0.99;
    pos += vel * (1.0 / 60.0);

    // Keep particles from leaving
    if (pos.x < 0.0) {
        pos.x = 0.0;
        vel.x = abs(vel.x);
    }
    
    if (pos.x > u.res.x) {
        pos.x = u.res.x;
        vel.x = -abs(vel.x);
    }
    
    if (pos.y < 0.0) {
        pos.y = 0.0;
        vel.y = abs(vel.y);
    }
    
    if (pos.y > u.res.y) {
        pos.y = u.res.y;
        vel.y = -abs(vel.y);
    }

    pOut[i] = Particle(pos, vel);
}