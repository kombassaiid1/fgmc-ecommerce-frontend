import type { AgentThemeId } from "../../../lib/agent-theme";

export const IMAGE_MOTION_THEMES = {
  photon: 0, quantum: 1, plasma: 2, fusion: 3, proton: 4, pulsar: 5, quasar: 6,
} as const satisfies Record<AgentThemeId, number>;

export const IMAGE_VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_position.x * .5 + .5, .5 - a_position.y * .5);
  gl_Position = vec4(a_position, 0., 1.);
}`;

// Physics-inspired art direction, not a physical simulation. See docs/agent-motion-physics.md.
// Only the existing image and its alpha are sampled; no decorative geometry is added.
export const IMAGE_FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_image;
uniform float u_time;
uniform float u_theme;
uniform float u_intensity;
varying vec2 v_uv;

mat2 rotate(float a) {
  return mat2(cos(a), -sin(a), sin(a), cos(a));
}
float region(vec2 p, vec2 center, float radius) {
  vec2 d = (p - center) / radius;
  return exp(-dot(d, d) * 2.);
}
vec4 source(vec2 uv) {
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return vec4(0.);
  return texture2D(u_image, uv);
}
// Crossfading texture samples in premultiplied space avoids dark alpha fringes.
vec4 blendColors(vec4 ca, vec4 cb, float weight) {
  float alpha = mix(cb.a, ca.a, weight);
  vec3 rgb = mix(cb.rgb * cb.a, ca.rgb * ca.a, weight);
  return vec4(rgb / max(alpha, .0001), alpha);
}
vec4 blendSource(vec2 a, vec2 b, float weight) {
  return blendColors(source(a), source(b), weight);
}
void main() {
  // Leave room for the full diagonal pulsar beam at every rotation angle.
  float fit = (u_theme > 4.5 && u_theme < 5.5) ? .71 : .93;
  vec2 p = (v_uv - .5) / fit + .5;
  vec2 q = p;
  vec2 d = p - .5;
  float r = length(d);
  // Increased motion speed; keep the approved pulsar sweep unchanged.
  float t = u_time * ((u_theme > 4.5 && u_theme < 5.5) ? 1. : 1.5);
  float strength = u_intensity;
  float light = 1.;

  if (u_theme < .5) {
    // Photon: propagation along the existing rays, without rotating the source.
    // Packets are an artistic representation of light, not photon trajectories.
    float angle = atan(d.y, d.x);
    float ray = smoothstep(.10, .25, r);
    float phase = r * 24. - t * 2.4;
    float packet = pow(.5 + .5 * cos(phase), 4.);
    float lanes = .7 + .3 * sin(angle * 5. + .6);
    q -= normalize(d + vec2(.0001)) * .012 * sin(phase) * ray * strength;
    // Transverse field displacement remains much smaller than outward transport.
    q += vec2(-d.y, d.x) * .006 * sin(phase) * ray;
    light += (.16 * packet - .035) * ray * lanes;
  } else if (u_theme < 1.5) {
    // Quantum: stationary centers, correlated local states and standing fringes.
    // No traveling signal between the pair is used to depict entanglement.
    vec2 left = vec2(.21, .44);
    vec2 right = vec2(.80, .59);
    vec2 dl = p - left;
    vec2 dr = p - right;
    float coherent = sin(t * .95);
    // Keep each center and silhouette anchored; animate the internal texture.
    float wl = smoothstep(.025, .055, length(dl)) * (1. - smoothstep(.12, .18, length(dl)));
    float wr = smoothstep(.025, .055, length(dr)) * (1. - smoothstep(.12, .18, length(dr)));
    float phase = (.24 * coherent + .055 * sin(t * 1.43)) * strength;
    q += (rotate(phase) * dl - dl) * wl;
    q += (rotate(-phase) * dr - dr) * wr;
    vec2 axis = normalize(right - left);
    float along = dot(p - left, axis);
    float across = dot(p - left, vec2(-axis.y, axis.x));
    float bridge = exp(-across * across * 400.) * region(p, vec2(.505, .515), .33);
    float standing = cos(along * 37.) * coherent;
    q += vec2(-axis.y, axis.x) * .009 * standing * bridge * strength;
    light += .12 * standing * bridge + .045 * coherent * (wl - wr);
  } else if (u_theme < 2.5) {
    // Plasma-ball source: the electrode and glass boundary remain fixed.
    // Only the conducting filaments bend and redistribute inside the sphere.
    float angle = atan(d.y, d.x);
    float channel = smoothstep(.07, .18, r) * (1. - smoothstep(.35, .47, r));
    float turbulence = sin(r * 25. - t * 1.5) + .45 * sin(angle * 5. + t * .73) + .2 * sin(angle * 9. - t * 1.1);
    q = .5 + rotate(.065 * turbulence * channel * strength) * d;
    q += normalize(d + vec2(.0001)) * .009 * sin(angle * 7. + t) * channel;
    light += .06 * sin(angle * 4. + r * 14. - t) * channel;
  } else if (u_theme < 3.5) {
    // Fusion: continuously supplied fuel flows inward; emission travels outward.
    // Two offset flow phases recycle the texture without reversing a fused pair.
    vec2 left = vec2(.32, .51);
    vec2 right = vec2(.68, .51);
    float wl = region(p, left, .27);
    float wr = region(p, right, .27);
    float phaseA = fract(t / 6.);
    float phaseB = fract(t / 6. + .5);
    float weight = 1. - abs(2. * phaseA - 1.);
    vec2 inflow = vec2(.10 * (wr - wl), 0.);
    vec2 field = vec2(-d.y, d.x) * .14 * (wl - wr);
    vec2 qa = p + (inflow + field) * phaseA * strength;
    vec2 qb = p + (inflow + field) * phaseB * strength;
    // In inverse texture mapping, sampling farther out moves the fuel inward.
    vec4 fused = blendSource(qa, qb, weight);
    float core = region(p, vec2(.5, .52), .14);
    float emission = pow(.5 + .5 * cos(r * 25. - t * 1.7), 3.);
    float gain = 1. + .08 * core + .10 * emission * (1. - core);
    gl_FragColor = vec4(fused.rgb * gain, fused.a);
    return;
  } else if (u_theme < 4.5) {
    // Proton: confined, non-circular fluctuations, with zero net displacement.
    // The three visible objects represent the uud valence content, not the full QCD state.
    vec2 a = vec2(.34, .41);
    vec2 b = vec2(.64, .41);
    vec2 c = vec2(.50, .70);
    vec2 da = vec2(sin(t * .83) + .25 * sin(t * 1.77), cos(t * 1.17) - .3 * cos(t * .53));
    vec2 db = vec2(sin(t * 1.13 + 2.1), cos(t * .79 + 2.1) + .2 * sin(t * 1.61));
    vec2 dc = vec2(sin(t * .97 + 4.2), cos(t * 1.07 + 4.2) - .2 * sin(t * 1.39));
    vec2 mean = (da + db + dc) / 3.;
    da = (da - mean) * .022 * strength;
    db = (db - mean) * .022 * strength;
    dc = (dc - mean) * .022 * strength;
    // A flat mask translates each quark and its label as one piece, avoiding
    // the rubber-like deformation caused by a Gaussian across the whole quark.
    float wa = 1. - smoothstep(.105, .175, length(p - a - da));
    float wb = 1. - smoothstep(.105, .175, length(p - b - db));
    float wc = 1. - smoothstep(.105, .175, length(p - c - dc));
    q -= da * wa + db * wb + dc * wc;
    float binding = region(p, vec2(.5, .52), .24) * (1. - max(wa, max(wb, wc)));
    q += .003 * vec2(sin(p.y * 23. + t), sin(p.x * 21. - t * .8)) * binding;
  } else if (u_theme < 5.5) {
    // Pulsar: a constant-period lighthouse sweep, not radial expansion of the star.
    vec2 center = vec2(.5, .51);
    vec2 offset = p - center;
    float turn = t * .65;
    float field = smoothstep(.06, .13, length(offset));
    q = center + rotate(turn * field) * offset;
    // Observer-alignment emphasis is gentle and confined to the beam/outer field.
    float alignment = pow(.5 + .5 * cos(turn * 2.), 4.);
    light += .12 * alignment * field;
  } else {
    // Quasar: differential accretion rotation, faster inside, with inward drift.
    // Jet pixels are excluded from disk rotation and retain their original axis.
    vec2 center = vec2(.46, .56);
    vec2 offset = p - center;
    vec2 axis = normalize(vec2(.55, -.83));
    vec2 major = vec2(-axis.y, axis.x);
    float along = dot(offset, axis);
    float across = dot(offset, major);
    float jetCorridor = 1. - smoothstep(.045, .14, abs(across));
    float jet = jetCorridor * smoothstep(.09, .20, abs(along));
    vec2 disk = vec2(across, along / .55);
    float radius = length(disk);
    float coreLock = smoothstep(.035, .10, length(offset));
    float diskMask = (1. - smoothstep(.40, .72, radius)) * (1. - jetCorridor) * coreLock;
    float phaseA = fract(t / 10.);
    float phaseB = fract(t / 10. + .5);
    float weight = 1. - abs(2. * phaseA - 1.);
    float differential = .55 / (.35 + radius);
    vec2 da = rotate(differential * phaseA * diskMask * strength) * disk;
    vec2 db = rotate(differential * phaseB * diskMask * strength) * disk;
    da *= 1. + .08 * phaseA * diskMask;
    db *= 1. + .08 * phaseB * diskMask;
    vec2 qa = center + major * da.x + axis * da.y * .55;
    vec2 qb = center + major * db.x + axis * db.y * .55;
    vec4 base = source(p);
    vec4 ca = source(qa);
    vec4 cb = source(qb);
    // Also protect blue jet pixels at their source coordinates: transporting them
    // into the disk would create a second, bent jet beside the original one.
    float protectA = max(jetCorridor, smoothstep(.01, .12, ca.b - ca.r));
    float protectB = max(jetCorridor, smoothstep(.01, .12, cb.b - cb.r));
    ca = blendColors(base, ca, protectA);
    cb = blendColors(base, cb, protectB);
    vec4 accretion = blendColors(ca, cb, weight);
    // The two jets carry outward disturbances in opposite directions.
    float ejecta = pow(.5 + .5 * cos(abs(along) * 35. - t * 1.7), 3.);
    float gain = 1. + .13 * ejecta * jet;
    gl_FragColor = vec4(accretion.rgb * gain, accretion.a);
    return;
  }
  vec4 color = source(q);
  gl_FragColor = vec4(color.rgb * light, color.a);
}`;
