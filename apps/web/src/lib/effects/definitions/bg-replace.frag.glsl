precision mediump float;

uniform sampler2D u_texture;      // original video frame
uniform sampler2D u_mask;         // person segmentation mask (white = person)
uniform sampler2D u_background;   // replacement background texture
uniform vec2 u_resolution;
uniform float u_edgeSmooth;       // edge feathering amount (0.0 - 0.5)

varying vec2 v_texCoord;

// Morphological edge cleanup: sample neighborhood to smooth mask edges
// This reduces hair fringing and jagged boundaries
float cleanMask(vec2 uv, vec2 texelSize) {
  float center = texture2D(u_mask, uv).r;

  // 3x3 neighborhood average for edge cleanup
  float sum = center;
  float count = 1.0;

  for (int dx = -1; dx <= 1; dx++) {
    for (int dy = -1; dy <= 1; dy++) {
      if (dx == 0 && dy == 0) continue;
      vec2 offset = vec2(float(dx), float(dy)) * texelSize * 1.5;
      sum += texture2D(u_mask, uv + offset).r;
      count += 1.0;
    }
  }

  float averaged = sum / count;

  // Blend: use averaged in edge regions, original in solid regions
  float edgeness = 1.0 - abs(center * 2.0 - 1.0); // high at mask boundary
  return mix(center, averaged, edgeness * 0.7);
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 original = texture2D(u_texture, v_texCoord);
  vec4 bg = texture2D(u_background, v_texCoord);

  // Clean up mask edges (reduces hair fringing)
  float mask = cleanMask(v_texCoord, texelSize);

  // Apply edge smoothing
  float lo = 0.5 - u_edgeSmooth;
  float hi = 0.5 + u_edgeSmooth;
  float smoothMask = smoothstep(lo, hi, mask);

  // Edge-aware color spill suppression:
  // At mask boundaries, slightly desaturate to reduce color bleeding
  float edgeRegion = smoothstep(0.0, 0.3, smoothMask) * smoothstep(1.0, 0.7, smoothMask);
  vec4 despilled = mix(original, vec4(dot(original.rgb, vec3(0.299, 0.587, 0.114)), dot(original.rgb, vec3(0.299, 0.587, 0.114)), dot(original.rgb, vec3(0.299, 0.587, 0.114)), original.a), edgeRegion * 0.15);

  // Composite
  gl_FragColor = mix(bg, despilled, smoothMask);
}
