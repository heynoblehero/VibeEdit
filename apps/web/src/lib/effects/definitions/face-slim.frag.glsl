precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_jawCenter;
uniform vec2 u_leftCheek;
uniform vec2 u_rightCheek;
uniform float u_slimFactor;

varying vec2 v_texCoord;

/**
 * Warp displacement toward face center.
 * Uses smooth cubic falloff for natural-looking distortion.
 */
vec2 slimDisplace(vec2 controlPoint, vec2 faceCenter, vec2 uv,
                  float radius, float strength) {
  vec2 toControl = uv - controlPoint;

  float aspect = u_resolution.x / u_resolution.y;
  vec2 scaled = toControl * vec2(aspect, 1.0);
  float dist = length(scaled);

  if (dist > radius || dist < 0.001) return vec2(0.0);

  // Smooth cubic falloff
  float t = 1.0 - dist / radius;
  float weight = t * t * (3.0 - 2.0 * t);

  // Push inward toward face center
  vec2 inward = normalize(faceCenter - controlPoint);

  return inward * weight * strength;
}

void main() {
  if (u_slimFactor < 0.001) {
    gl_FragColor = texture2D(u_texture, v_texCoord);
    return;
  }

  vec2 faceCenter = (u_jawCenter + u_leftCheek + u_rightCheek) / 3.0;

  // Slightly upward-shifted center for more natural slimming
  vec2 slimCenter = faceCenter + vec2(0.0, -0.02);

  float radius = 0.20;  // slightly larger influence area
  float strength = u_slimFactor * 0.05;

  vec2 offset = vec2(0.0);

  // Jaw: strongest effect (pushes chin inward)
  offset += slimDisplace(u_jawCenter, slimCenter, v_texCoord, radius, strength);

  // Cheeks: moderate effect (narrows face width)
  offset += slimDisplace(u_leftCheek, slimCenter, v_texCoord, radius * 0.9, strength * 0.8);
  offset += slimDisplace(u_rightCheek, slimCenter, v_texCoord, radius * 0.9, strength * 0.8);

  // Jawline edges: add subtle points between jaw and cheeks
  vec2 leftJaw = mix(u_jawCenter, u_leftCheek, 0.5);
  vec2 rightJaw = mix(u_jawCenter, u_rightCheek, 0.5);
  offset += slimDisplace(leftJaw, slimCenter, v_texCoord, radius * 0.7, strength * 0.5);
  offset += slimDisplace(rightJaw, slimCenter, v_texCoord, radius * 0.7, strength * 0.5);

  vec2 warped = clamp(v_texCoord + offset, vec2(0.0), vec2(1.0));

  gl_FragColor = texture2D(u_texture, warped);
}
