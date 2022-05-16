using Microsoft.JSInterop;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Numerics;

namespace BlazorWebGpuHlslParticle
{
    public class WebGpuInterop : IAsyncDisposable
    {
        private readonly Lazy<Task<IJSObjectReference>> moduleTask;

        public WebGpuInterop(IJSRuntime jsRuntime)
        {
            moduleTask = new(() => jsRuntime.InvokeAsync<IJSObjectReference>(
               "import", "./WebGpuInterop.js").AsTask());
        }

        public async ValueTask<string> CreateGpuDevice()
        {
            var module = await moduleTask.Value;
            return await module.InvokeAsync<string>("createGpuDevice");
        }

        public async ValueTask CreateComputeBufferParticle(Vector4[] computeBufferData, Vector4[] positionBufferData, Vector2[] velocityBufferData, Vector4[] colorBufferData, byte[] csBinary)
        {
            var module = await moduleTask.Value;
            var computeBufferArray = computeBufferData.SelectMany(x => new float[] { x.X, x.Y, x.Z, x.W }).ToArray();
            var positionBufferArray = positionBufferData.SelectMany(x => new float[] { x.X, x.Y, x.Z, x.W }).ToArray();
            var velocityBufferArray = velocityBufferData.SelectMany(x => new float[] { x.X, x.Y}).ToArray();
            var colorBufferArray = colorBufferData.SelectMany(x => new UInt16[] { (UInt16)(x.X), (UInt16)(x.Y), (UInt16)(x.Z), (UInt16)(x.W) }).ToArray();
            var csDecoded = Enumerable.Range(0, csBinary.Length / 4)
                          .Select(i => BitConverter.ToUInt32(csBinary, i * 4))
                          .ToArray();        
            await module.InvokeVoidAsync("createComputeBufferParticle", computeBufferArray, positionBufferArray, velocityBufferArray, colorBufferArray, csDecoded);
        }

        public async ValueTask CreateVsPsBufferParticle(byte[] vsBinary, byte[] psBinary)
        {
            var module = await moduleTask.Value;
            var vsDecoded = Enumerable.Range(0, vsBinary.Length / 4)
                              .Select(i => BitConverter.ToUInt32(vsBinary, i * 4))
                              .ToArray();
            var psDecoded = Enumerable.Range(0, psBinary.Length / 4)
                              .Select(i => BitConverter.ToUInt32(psBinary, i * 4))
                              .ToArray();
            await module.InvokeVoidAsync("createVsFsBufferParticle", vsDecoded, psDecoded);
        }

        public async ValueTask PlotParticle()
        {
            var module = await moduleTask.Value;
            await module.InvokeVoidAsync("plotParticle");
        }


        public async ValueTask initWebGPU()
        {
            var module = await moduleTask.Value;
            await module.InvokeVoidAsync("initWebGPU");
        }

        public async ValueTask DisposeAsync()
        {
            if (moduleTask.IsValueCreated)
            {
                var module = await moduleTask.Value;
                await module.DisposeAsync();
            }
        }


    }
}
