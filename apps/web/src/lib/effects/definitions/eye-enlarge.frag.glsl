precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_leftEyeCenter;
uniform vec2 u_rightEyeCenter;
uniform float u_eyeRadius;
uniform float u_enlargeFactor;

varying vec2 v_texCoord;

/**
 * Applies a radial spherize/magnification effect around an eye center.
 * Pixels within the eye radius are mapped to a smaller source area,
 * creating an enlargement effect with smooth falloff at the boundary.
 *
 * Returns the displaced UV coordinate (or the original if outside range).
 */
vec2 enlargeEye(vec2 eyeCenter, vec2 uv, float radius, float factor) {
  // Correct for aspect ratio so the influence region is circular
  float aspect = u_resolution.x / u_resolution.y;
  vec2 diff = uv - eyeCenter;
  vec2 scaled = diff * vec2(aspect, 1.0);
  float dist = length(scaled);

  if (dist > radius || dist < 0.0001) return uv;

  // Normalized distance within the influence circle (0 at center, 1 at edge)
  float normalizedDist = dist / radius;

  // Power curve: maps the normalized distance to a smaller value,
  // so pixels sample from closer to center = magnification.
  // The exponent controls magnification strength.
  float exponent = 1.0 + factor; // factor 0-1 → exponent 1-2
  float remapped = pow(normalizedDist, exponent);

  // Smooth falloff at the boundary to avoid hard edges
  // Blend between remapped and original based on proximity to edge
  float blend = smoothstep(0.8, 1.0, normalizedDist);
  float finalDist = mix(remapped, normalizedDist, blend);

  // Scale the difference vector by the ratio of new/old distances
  float scale = (dist > 0.0001) ? (finalDist / normalizedDist) : 1.0;

  return eyeCenter + diff * scale;
}

void main() {
  if (u_enlargeFactor < 0.001) {
    gl_FragColor = texture2D(u_texture, v_texCoord);
    return;
  }

  // Apply enlargement to both eyes
  vec2 uv = v_texCoord;
  uv = enlargeEye(u_leftEyeCenter,  uv, u_eyeRadius, u_enlargeFactor);
  uv = enlargeEye(u_rightEyeCenter, uv, u_eyeRadius, u_enlargeFactor);

  // Clamp to valid UV range
  uv = clamp(uv, vec2(0.0), vec2(1.0));

  gl_FragColor = texture2D(u_texture, uv);
}
