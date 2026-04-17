@fragment
fn main(@location(0) uv: vec2f, @location(1) speed: f32) -> @location(0) vec4f {
    if (length(uv) > 1.0) {
        discard;
    }

    // Gradient inspired by Sebastian Lague
    // https://youtu.be/rSKMYc1CQHE?t=1758
    let t = clamp(speed / 800.0, 0.0, 1.0);
    var color: vec3f;

    if (t < 0.33) {
        color = mix(vec3f(0.1, 0.2, 0.9), vec3f(0.0, 0.8, 0.6), t / 0.33);
    } else if (t < 0.66) {
        color = mix(vec3f(0.0, 0.8, 0.6), vec3f(1.0, 0.85, 0.0), (t - 0.33) / 0.33);
    } else {
        color = mix(vec3f(1.0, 0.85, 0.0), vec3f(0.9, 0.2, 0.0), (t - 0.66) / 0.34);
    }

    return vec4f(color, 1.0);
}