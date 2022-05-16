// This is a JavaScript module that is loaded on demand. It can export any number of
// functions, and may import other JavaScript modules if required.




var device
var presentationFormat
var context
var canvas
var renderPipeline
var computePipeline
var computeBindGroupB2A
var computeBindGroupA2B
var vertexBuffer
var colorBuffer
var vertexUniformBindGroup
var positionBufferA
var positionBufferB

const NUM_PARTICLES = 50000;
const PARTICLE_SIZE = 2;

export async function createGpuDevice() {
    if (!navigator.gpu)
        return "WebGPU is not supported. Enable chrome://flags/#enable-unsafe-webgpu flag.";

    //////////////////////////////////////////
    // Set up WebGPU adapter
    //////////////////////////////////////////
    
    const [adapter] = await Promise.all([
        navigator.gpu.requestAdapter()
    ]);
    if (!adapter)
        return "Failed to get GPU adapter. not supported";
    ////////////////////////////////////
    // Set up device and canvas context
    ////////////////////////////////////
    device = await adapter.requestDevice();

    canvas = document.getElementById("webgpucanvas");
    canvas.width = window.innerWidth * 0.8;
    canvas.height = window.innerHeight * 0.8;
    context = canvas.getContext("webgpu");
    presentationFormat = await context.getPreferredFormat(adapter);
    context.configure({
        device,
        format: presentationFormat,
        compositingAlphaMode: "premultiplied"
    });

    return "Success"
}




export async function createComputeBufferParticle(computeBufferDataIn, positionBufferDataIn, velocityBufferDataIn, colorBufferDataIn, csbyte) {
  
    ////////////////////////////////////////////////////////
    // Create buffers for simulation
    // (input/output pair of position and velocity buffers)
    ////////////////////////////////////////////////////////


    positionBufferA = device.createBuffer({
        size: 16 * NUM_PARTICLES,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
        mappedAtCreation: true
    });

    const positionBufferData = new Float32Array(positionBufferA.getMappedRange());
    for (let i = 0; i < positionBufferData.length; i += 4) {
        positionBufferData[i] = positionBufferDataIn[i];
        positionBufferData[i + 1] = positionBufferDataIn[i + 1];
        positionBufferData[i + 2] = positionBufferDataIn[i + 2];
        positionBufferData[i + 3] = positionBufferDataIn[i + 3];
    }
    positionBufferA.unmap();
    
    const velocityBufferA = device.createBuffer({
        size: 16 * NUM_PARTICLES,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
        mappedAtCreation: true
    });
    const velocityBufferData = new Float32Array(velocityBufferA.getMappedRange());
    for (let i = 0, j = 0; i < velocityBufferData.length; i += 4, j += 2) {
        velocityBufferData[i] = velocityBufferDataIn[j];
        velocityBufferData[i + 1] = velocityBufferDataIn[j+1];
        velocityBufferData[i + 2] = 0;
        velocityBufferData[i + 3] = 1;
    }

    velocityBufferA.unmap();

    positionBufferB = device.createBuffer({
        size: 16 * NUM_PARTICLES,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    });

    const velocityBufferB = device.createBuffer({
        size: 16 * NUM_PARTICLES,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    });

    ///////////////////////////////////
    // Create buffers for render pass
    ///////////////////////////////////

    vertexBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
    });
    new Float32Array(vertexBuffer.getMappedRange()).set([
        -1.0, -1.0,
        1.0, -1.0,
        -1.0, 1.0,
        1.0, 1.0
    ]);
    vertexBuffer.unmap();

    colorBuffer = device.createBuffer({
        size: 4 * NUM_PARTICLES,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    });
    const colorBufferData = new Uint8Array(colorBuffer.getMappedRange());

    for (let i = 0; i < colorBufferData.length; i += 4) {
        colorBufferData[i] = colorBufferDataIn[i];
        colorBufferData[i + 1] = colorBufferDataIn[i + 1];
        colorBufferData[i + 2] = colorBufferDataIn[i + 2];
        colorBufferData[i + 3] = colorBufferDataIn[i + 3];
    }

    colorBuffer.unmap();

    //////////////////////////
    // Compute uniform buffer 
    //////////////////////////

    const computeUniformData = Float32Array.from(computeBufferDataIn);

    const computeUniformBuffer = device.createBuffer({
        size: computeUniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(computeUniformBuffer, 0, computeUniformData);

    //////////////////////////////////////////////////////////
    // Compute binding layouts 
    // One for reading from A buffers and writing to B,
    // the other for reading from B buffers and writing to A
    //////////////////////////////////////////////////////////

    const computeBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 20,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage"
                }
            },
            {
                binding: 21,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage"
                }
            },
            {
                binding: 22,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage"
                }
            },
            {
                binding: 23,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage"
                }
            },
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "uniform" //uniform
                }
            }
        ]
    });

    computeBindGroupA2B = device.createBindGroup({
        layout: computeBindGroupLayout,
        entries: [
            {
                binding: 20,
                resource: {
                    buffer: positionBufferA
                }
            },
            {
                binding: 21,
                resource: {
                    buffer: velocityBufferA
                }
            },
            {
                binding: 22,
                resource: {
                    buffer: positionBufferB
                }
            },
            {
                binding: 23,
                resource: {
                    buffer: velocityBufferB
                }
            },
            {
                binding: 0,
                resource: {
                    buffer: computeUniformBuffer
                }
            }
        ]
    });

    computeBindGroupB2A = device.createBindGroup({
        layout: computeBindGroupLayout,
        entries: [
            {
                binding: 20,
                resource: {
                    buffer: positionBufferB
                }
            },
            {
                binding: 21,
                resource: {
                    buffer: velocityBufferB
                }
            },
            {
                binding: 22,
                resource: {
                    buffer: positionBufferA
                }
            },
            {
                binding: 23,
                resource: {
                    buffer: velocityBufferA
                }
            },
            {
                binding: 0,
                resource: {
                    buffer: computeUniformBuffer
                }
            }
        ]
    });

    ///////////////////////////
    // Create compute pipeline
    ///////////////////////////
    
    computePipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
        compute: {
            module: device.createShaderModule({
                code: Uint32Array.from(csbyte)
            }),
            entryPoint: "csParticle"
        }
    });

}

export async function createVsFsBufferParticle(vsHLSL, fsHLSL) {
    ///////////////////////////////////////////////
    // Rendering uniform buffer and binding layout 
    ///////////////////////////////////////////////

    const vertexUniformBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(vertexUniformBuffer, 0, new Float32Array([
        canvas.width, canvas.height, PARTICLE_SIZE
    ]));

    const vertexUniformBindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {
                type: "uniform"
            }
        }]
    });

    vertexUniformBindGroup = device.createBindGroup({
        layout: vertexUniformBindGroupLayout,
        entries: [{
            binding: 0,
            resource: {
                buffer: vertexUniformBuffer
            }
        }]
    });

    ///////////////////////////
    // Create render pipeline
    ///////////////////////////

    renderPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [vertexUniformBindGroupLayout] }),
        vertex: {
            module: device.createShaderModule({
                code: Uint32Array.from(vsHLSL)
            }),
            entryPoint: "vsParticle",
            buffers: [
                {
                    arrayStride: 8,
                    attributes: [{
                        shaderLocation: 0,
                        format: "float32x2",
                        offset: 0
                    }]
                },
                {
                    arrayStride: 4,
                    stepMode: "instance",
                    attributes: [{
                        shaderLocation: 1,
                        format: "unorm8x4",
                        offset: 0
                    }]
                },
                {
                    arrayStride: 16,
                    stepMode: "instance",
                    attributes: [{
                        shaderLocation: 2,
                        format: "float32x4",
                        offset: 0
                    }]
                }
            ]
        },
        fragment: {
            module: device.createShaderModule({
                code: Uint32Array.from(fsHLSL)
            }),
            entryPoint: "fsParticle",
            targets: [{
                format: presentationFormat,
                colorBlend: {
                    srcFactor: "one",
                    dstFactor: "one-minus-src-alpha"
                },
                alphaBlend: {
                    srcFactor: "one",
                    dstFactor: "one-minus-src-alpha"
                }
            }]
        },
        primitive: {
            topology: "triangle-strip",
            stripIndexFormat: "uint32"
        }
    });
}

export async function plotParticle() {

    ///////////////////////////
    // Render pass description
    ///////////////////////////

    const renderPassDescriptor = {
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: [0, 0, 0, 1],
            loadOp: "clear",
            storeOp: "store",
        }]
    };
    let currentPositionBuffer = positionBufferB;

    requestAnimationFrame(function draw() {
        ////////////////////////////////
        // Swap compute buffer bindings
        ////////////////////////////////

        const currentComputeBindGroup = currentPositionBuffer === positionBufferA ? computeBindGroupB2A : computeBindGroupA2B;

        /////////////////////////
        // Set up command buffer
        /////////////////////////

        const commandEncoder = device.createCommandEncoder();

        ///////////////////////
        // Encode compute pass
        ///////////////////////

        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(computePipeline);

        // First argument here refers to array index
        // in computePipeline layout.bindGroupLayouts
        computePass.setBindGroup(0, currentComputeBindGroup);

        computePass.dispatch(NUM_PARTICLES);
        computePass.end();

        ////////////////////
        // Swap framebuffer
        ////////////////////

        renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();

        ///////////////////////
        // Encode render pass
        ///////////////////////

        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(renderPipeline);

        // First argument here refers to array index
        // in renderPipeline vertexState.vertexBuffers
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setVertexBuffer(1, colorBuffer);
        renderPass.setVertexBuffer(2, currentPositionBuffer);

        // First argument here refers to array index
        // in renderPipeline layout.bindGroupLayouts
        renderPass.setBindGroup(0, vertexUniformBindGroup);

        renderPass.draw(4, NUM_PARTICLES, 0, 0);
        renderPass.end();

        //////////////////////////
        // Submit command buffer
        //////////////////////////

        device.queue.submit([commandEncoder.finish()]);

        /////////////////
        // Swap buffers
        /////////////////

        currentPositionBuffer = currentPositionBuffer === positionBufferA ? positionBufferB : positionBufferA;

        requestAnimationFrame(draw);
    });

}

