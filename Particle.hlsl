RWStructuredBuffer<float4> PositionsIn : register(u0);
RWStructuredBuffer<float4> VelocityIn : register(u1);
RWStructuredBuffer<float4> PositionsOut : register(u2);
RWStructuredBuffer<float4> VelocityOut : register(u3);

cbuffer Mass : register(b0)
{
    float4 mass1Position : packoffset(c0);
    float4 mass2Position : packoffset(c1);
    float4 mass3Position : packoffset(c2);
    float mass1Factor : packoffset(c3);
    float mass2Factor : packoffset(c3.y);
    float mass3Factor : packoffset(c3.z);
	
};

[numthreads(64, 1, 1)]
void csParticle(uint3 ID : SV_DispatchThreadID)
{   
    uint index = ID.x;
	float3 position = PositionsIn.Load(index).xyz;
    float3 velocity = VelocityIn.Load(index).xyz;
    float3 massVec = mass1Position.xyz - position;
    float massDist2 = max(0.01f, dot(massVec, massVec));
    float3 acceleration = (normalize(massVec) * mass1Factor) / massDist2.xxx;
    massVec = mass2Position.xyz - position;
    massDist2 = max(0.01f, dot(massVec, massVec));
    acceleration += ((normalize(massVec) * mass2Factor) / massDist2.xxx);
    massVec = mass3Position.xyz - position;
    massDist2 = max(0.01f, dot(massVec, massVec));
    acceleration += ((normalize(massVec) * mass3Factor) / massDist2.xxx);
    velocity += acceleration;
    velocity *= 0.9999f;
	PositionsOut[index] = float4(position + velocity, 1.0f);
	VelocityOut[index] = float4(velocity, 0.0f);
}

cbuffer VertexUniforms : register(b0)
{
    float2 screenDimensions : packoffset(c0);
    float particleSize : packoffset(c0.z);
};

struct VsInput
{
    float2 vertexPosition : TEXCOORD0;
    float4 color : TEXCOORD1;
    float3 position : TEXCOORD2;
};

struct VsOutput
{
    float4 vColor : TEXCOORD0;
    float4 gl_Position : SV_Position;
};

VsOutput vsParticle(VsInput stage_input)
{
    float4 color = stage_input.color;
    float2 vertexPosition = stage_input.vertexPosition;
    float3 position = stage_input.position;
    float4 vColor = color;
    float4 gl_Position = float4(((vertexPosition * particleSize) / screenDimensions) + position.xy, position.z, 1.0f);
    VsOutput stage_output;
    stage_output.gl_Position = gl_Position;
    stage_output.vColor = vColor;
    return stage_output;
}

struct FsInput
{
    float4 vColor : TEXCOORD0;
};

struct FsOutput
{
    float4 fragColor : SV_Target0;
};

FsOutput fsParticle(FsInput stage_input)
{
    FsOutput stage_output;
    stage_output.fragColor = stage_input.vColor;
    return stage_output;
}