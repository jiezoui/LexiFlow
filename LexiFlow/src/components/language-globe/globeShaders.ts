/**
 * GLSL Shaders for the Monochrome Particle Language Globe
 * Anti-aliased & stable rendering without subpixel flickering or shimmering.
 */

export const surfaceVertexShader = `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3 uLightDir;
  uniform vec2 uGlobeCenter;
  
  attribute float aSize;
  attribute float aAlpha;
  attribute float aNoise;
  
  varying float vAlpha;
  varying float vLuminance;
  
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;
    
    // Normal in world space
    vec3 normal = normalize(mat3(modelMatrix) * normalize(position));
    vec3 lightDir = normalize(uLightDir);
    
    // 1. Directional diffuse illumination
    float NdotL = max(0.0, dot(normal, lightDir));
    
    // 2. Fresnel grazing rim
    float fresnel = 1.0 - abs(normal.z);
    
    // 3. 2D upper-right directional factor
    vec2 lightDir2D = normalize(lightDir.xy);
    float upperRight = max(0.0, dot(normal.xy, lightDir2D));
    
    // Grazing rim enhancement on upper right
    float rim = pow(fresnel, 2.0) * pow(upperRight, 1.3);
    
    // Smooth combined illumination
    float illum = pow(NdotL, 1.2) * 1.5 + rim * 2.0;
    
    // Shadow falloff towards bottom-left
    float shadow = smoothstep(-0.4, 0.6, dot(normal, lightDir));
    
    // Circular, feathered quiet zone centered behind the headline
    vec2 textOffset = (worldPos.xy - uGlobeCenter) - vec2(51.0, 9.0);
    float textMask = 1.0 - smoothstep(110.0, 210.0, length(textOffset));
    float textSuppression = 1.0 - 0.96 * textMask * smoothstep(-0.2, 0.45, normal.z);
    
    // Stable baseline visibility without stark cutoffs
    float basePresence = 0.16;
    
    float alpha = aAlpha * (basePresence + (1.0 - basePresence) * shadow) * textSuppression * (0.35 + 0.65 * illum);
    alpha += 0.7 * rim;
    vAlpha = clamp(alpha, 0.05, 0.95);
    
    // High-key luminance on rim and lit crest
    vLuminance = min(1.0, 0.85 + 0.35 * illum);
    
    // Point size with anti-aliasing margin (never drops below 1.6px to prevent flickering)
    float rimSize = 1.0 + 0.25 * rim;
    gl_PointSize = max(1.6, aSize * uPixelRatio * rimSize);
  }
`;

export const surfaceFragmentShader = `
  varying float vAlpha;
  varying float vLuminance;
  
  void main() {
    // Soft circular particle with anti-aliasing feather
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    // Smooth falloff to eliminate harsh subpixel aliasing
    float edgeAlpha = smoothstep(0.5, 0.12, dist);
    float core = smoothstep(0.25, 0.0, dist) * 0.3;
    
    float finalLum = min(1.0, vLuminance + core);
    float finalAlpha = edgeAlpha * vAlpha;
    
    gl_FragColor = vec4(vec3(finalLum), finalAlpha);
  }
`;

export const rimVertexShader = `
  uniform float uPixelRatio;
  uniform vec3 uLightDir;
  
  attribute float aSize;
  attribute float aAlpha;
  
  varying float vAlpha;
  
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
    
    vec3 normal = normalize(mat3(modelMatrix) * normalize(position));
    vec2 lightDir2D = normalize(uLightDir.xy);
    
    float upperRight = max(0.0, dot(normal.xy, lightDir2D));
    float edgeGrazing = 1.0 - abs(normal.z);
    float crescentFactor = pow(upperRight, 1.2) * pow(edgeGrazing, 1.5);
    
    vAlpha = aAlpha * crescentFactor;
    gl_PointSize = max(1.6, aSize * uPixelRatio);
  }
`;

export const rimFragmentShader = `
  varying float vAlpha;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    float edgeAlpha = smoothstep(0.5, 0.1, dist);
    gl_FragColor = vec4(1.0, 1.0, 1.0, edgeAlpha * vAlpha);
  }
`;

export const innerVertexShader = `
  uniform float uPixelRatio;
  uniform vec2 uGlobeCenter;
  
  attribute float aSize;
  attribute float aAlpha;
  
  varying float vAlpha;
  
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;
    
    gl_PointSize = max(1.4, aSize * uPixelRatio);
    
    vec2 textOffset = (worldPos.xy - uGlobeCenter) - vec2(51.0, 9.0);
    float textMask = 1.0 - smoothstep(105.0, 205.0, length(textOffset));
    float textSuppression = 1.0 - 0.96 * textMask;
    
    vAlpha = aAlpha * textSuppression;
  }
`;

export const innerFragmentShader = `
  varying float vAlpha;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    float edgeAlpha = smoothstep(0.5, 0.12, dist);
    gl_FragColor = vec4(vec3(0.78), edgeAlpha * vAlpha);
  }
`;

export const dustVertexShader = `
  uniform float uTime;
  uniform float uPixelRatio;
  
  attribute float aSize;
  attribute float aAlpha;
  
  varying float vAlpha;
  
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = max(1.2, aSize * uPixelRatio);
    vAlpha = aAlpha * 0.7;
  }
`;

export const dustFragmentShader = `
  varying float vAlpha;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    float edgeAlpha = smoothstep(0.5, 0.15, dist);
    gl_FragColor = vec4(vec3(0.85), edgeAlpha * vAlpha);
  }
`;
