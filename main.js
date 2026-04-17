const canvas = document.querySelector("canvas");
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

if (!navigator.gpu)
    throw new Error("WebGPU not supported");
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error("No GPUAdapter found");
const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

const N = 25000;
const W = canvas.width;
const H = canvas.height;

const computeCode = await (await fetch("compute.wgsl")).text();
const vertexCode = await (await fetch("vertex.wgsl")).text();
const fragmentCode = await (await fetch("fragment.wgsl")).text();

const computeMod = device.createShaderModule({ code: computeCode });
const vertexMod = device.createShaderModule({ code: vertexCode });
const fragmentMod = device.createShaderModule({ code: fragmentCode });

const data = new Float32Array(N * 4);
for (let i = 0; i < N; i++) {
    data[i * 4 + 0] = Math.random() * W;
    data[i * 4 + 1] = Math.random() * H * 0.5;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 0;
}

// Buffers
const bufA = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
const bufB = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(bufA, 0, data);
device.queue.writeBuffer(bufB, 0, data);

const UNIFORM_SIZE = 64;
const uniformBuf = device.createBuffer({ size: UNIFORM_SIZE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

const quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
const quadBuf = device.createBuffer({ size: quad.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(quadBuf, 0, quad);

// Bind group layouts
const computeBGL = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
    { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
    { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
]});

const renderBGL = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
    { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
]});

// Bind groups
const computeBG = [
    device.createBindGroup({ layout: computeBGL, entries: [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: bufA } },
        { binding: 2, resource: { buffer: bufB } },
    ]}),
    device.createBindGroup({ layout: computeBGL, entries: [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: bufB } },
        { binding: 2, resource: { buffer: bufA } },
    ]}),
];

const renderBG = [
    device.createBindGroup({ layout: renderBGL, entries: [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: bufB } },
    ]}),
    device.createBindGroup({ layout: renderBGL, entries: [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: bufA } },
    ]}),
];

// Pipelines
const computePipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [computeBGL] }),
    compute: { module: computeMod, entryPoint: "main" },
});

const renderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [renderBGL] }),
    vertex: {
        module: vertexMod, entryPoint: "main",
        buffers: [{ arrayStride: 8, attributes: [{ format: "float32x2", offset: 0, shaderLocation: 0 }] }],
    },
    fragment: { module: fragmentMod, entryPoint: "main", targets: [{ format }] },
    primitive: { topology: "triangle-strip" },
});

let gravity = 5.0;
let mouseForce = 200.0;
let viscosity = 0.04;
let particleSize = 2.0;

function bindSlider(id, setter) {
    const input = document.getElementById(id);
    const display = document.getElementById(id + "-val");
    input.addEventListener("input", e => {
        const v = parseFloat(e.target.value);
        setter(v);
        display.textContent = v.toFixed(2);
    });
}

bindSlider("gravity", v => gravity = v);
bindSlider("mouseForce", v => mouseForce = v);
bindSlider("viscosity", v => viscosity = v);
bindSlider("particleSize", v => particleSize = v);

let mouseX = 0, mouseY = 0, mouseActive = 0;
canvas.addEventListener("mousedown", e => { mouseActive = 1; mouseX = e.clientX; mouseY = e.clientY; });
canvas.addEventListener("mousemove", e => { mouseX = e.clientX; mouseY = e.clientY; });
canvas.addEventListener("mouseup", () => mouseActive = 0);
canvas.addEventListener("mouseleave",() => mouseActive = 0);

let step = 0;

function frame() {
    device.queue.writeBuffer(uniformBuf, 0, new Float32Array([
        W, H,
        mouseX, mouseY,
        mouseActive,
        gravity,
        mouseForce,
        viscosity,
        particleSize,
        0, 0, 0, 0, 0, 0, 0
    ]));

    const encoder = device.createCommandEncoder();

    // Compute pass
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBG[step % 2]);
    computePass.dispatchWorkgroups(Math.ceil(N / 64));
    computePass.end();

    // Render pass
    const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1 },
            storeOp: "store",
        }]
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setVertexBuffer(0, quadBuf);
    renderPass.setBindGroup(0, renderBG[step % 2]);
    renderPass.draw(4, N);
    renderPass.end();

    device.queue.submit([encoder.finish()]);
    step++;
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);