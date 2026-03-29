precision mediump float;

uniform sampler2D u_texture;
uniform sampler2D u_mask;
uniform vec2 u_resolution;
uniform float u_mode;
uniform vec3 u_bgColor;
uniform float u_blurAmount;

varying vec2 v_texCoord;

// Simple box blur for background blur mode
vec4 blurSample(vec2 uv, vec2 texelSize) {
  vec4 color = vec4(0.0);
  float total = 0.0;
  float radius = u_blurAmount * 15.0;

  for (int x = -10; x <= 10; x++) {
    for (int y = -10; y <= 10; y++) {
      float fx = float(x);
      float fy = float(y);
      if (abs(fx) > radius || abs(fy) > radius) continue;
      float weight = exp(-(fx * fx + fy * fy) / (2.0 * radius * radius + 0.001));
      vec2 offset = vec2(fx, fy) * texelSize;
      color += texture2D(u_texture, uv + offset) * weight;
      total += weight;
    }
  }

  return color / max(total, 0.001);
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 original = texture2D(u_texture, v_texCoord);
  float mask = texture2D(u_mask, v_texCoord).r;

  // mask: 1.0 = foreground (person), 0.0 = background
  // Soft edge blending via the mask value itself (segmentation masks are often soft)

  vec4 bgColor;

  // mode 0: remove (transparent background)
  // mode 1: blur background
  // mode 2: replace with solid color
  if (u_mode < 0.5) {
    bgColor = vec4(0.0, 0.0, 0.0, 0.0);
  } else if (u_mode < 1.5) {
    bgColor = blurSample(v_texCoord, texelSize);
  } else {
    bgColor = vec4(u_bgColor, 1.0);
  }

  gl_FragColor = mix(bgColor, original, mask);
}
