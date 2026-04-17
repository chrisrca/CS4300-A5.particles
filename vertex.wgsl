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
@group(0) @binding(1) var<storage> particles: array<Particle>;

struct VOut {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
    @location(1) speed: f32,
}

@vertex
fn main(@location(0) corner: vec2f, @builtin(instance_index) i: u32) -> VOut {
    let p = particles[i];
    let screen = p.pos + corner * u.particleSize;
    let clip = vec2f(
        screen.x / u.res.x * 2.0 - 1.0,
        screen.y / u.res.y * -2.0 + 1.0
    );
    return VOut(vec4f(clip, 0.0, 1.0), corner, length(p.vel));
}