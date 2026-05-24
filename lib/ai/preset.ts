/**
 * The single source of truth for what a Kinframe portrait looks like.
 * Every generation — mock, real, bake-off — pulls from here.
 *
 * Locked decisions land here. A/B experiments override individual fields.
 */

export type AiPreset = {
  id: string;
  /** Human-facing label, e.g. "Painterly v1" */
  label: string;
  /**
   * Primary prompt. Describes the *outcome* of the painting, never references
   * AI, never invokes Ghibli or any specific IP, never uses the word "filter".
   */
  prompt: string;
  /** Negative prompt — things we never want in the output. */
  negativePrompt: string;
  /**
   * Strength of the painterly transformation (img2img / kontext models).
   * Higher = more painterly, lower = closer to the original photo.
   * Sweet spot for face-preserving painterly looks: 0.55–0.75.
   */
  strength: number;
  /** Guidance scale (text-prompt adherence). FLUX models: 2.5–4 is typical. */
  guidance: number;
};

export const PAINTERLY_V1: AiPreset = {
  id: "painterly-v1",
  label: "Painterly v1",
  prompt: [
    "Warm hand-illustrated family portrait in the style of a contemporary storybook illustration —",
    "soft painterly brushwork, visible texture, slightly graphic shapes, dreamy and inviting.",
    "Preserve every person's exact facial structure, skin tone, hair, and identifying features",
    "including eyeglasses, jewelry, watches, and distinctive accessories.",
    "Preserve exact clothing colors, garment styles, body positions, gestures, and relative scale.",
    "Keep the original group composition and pose.",
    "Warm golden-hour light raking from the left, soft directional shadows on faces and clothing,",
    "gentle rim light catching hair edges.",
    "Background: simplified painterly interpretation of horizontal wood slat fencing with soft foliage behind,",
    "kept graphic and uncluttered.",
    "Natural relaxed expressions with soft asymmetric smiles, lived-in faces.",
    "Warm ochre, sage, terracotta, and cream palette.",
    "Quality of a fine illustrated keepsake suitable for framed wall art.",
  ].join(" "),
  negativePrompt: [
    "photorealistic, 3D render, CGI, plastic skin, mask-like faces,",
    "frozen symmetrical smiles, dental grin,",
    "anime, manga, Disney character style, chibi, cartoon merchandise look,",
    "missing glasses, missing accessories, identity drift, generic faces,",
    "stock photo aesthetic, flat lighting, uniform diffuse light,",
    "distorted hands, extra fingers, blurry features, oversaturated",
  ].join(" "),
  strength: 0.68,
  guidance: 3.0,
};

/**
 * V2 — tuned for Gemini "nano-banana" (gemini-2.5-flash-image).
 *
 * Diffs vs V1, all driven by side-by-side analysis of a real family photo:
 *   - Removed the hard-coded wood-slat fence + foliage background. Nano-banana's
 *     strength is preserving the input scene painterly-style; we were fighting
 *     the model and teleporting customers out of their own setting.
 *   - Softened the lighting clause from "warm golden-hour light raking from
 *     the left" to "preserve the original lighting direction". Studio shots
 *     already have flattering light; re-lighting introduced identity drift.
 *   - Added an explicit child-identity clause. The first real output gave a
 *     toddler bouncy curls he doesn't have — buy-killer for a parent.
 *   - Added a clothing-detail clause. V1 collapsed a grandmother's embroidered
 *     pleated neckline into a generic polo collar.
 *   - Added an explicit "do not de-age elders" clause — common AI failure mode
 *     that's emotionally wrong for a heirloom gift.
 */
export const PAINTERLY_V2: AiPreset = {
  id: "painterly-v2",
  label: "Painterly v2",
  prompt: [
    "Warm hand-illustrated family portrait in the style of a contemporary storybook illustration —",
    "soft painterly brushwork, visible texture, slightly graphic shapes, dreamy and inviting.",
    "Preserve every person's exact facial structure, skin tone, hair, and identifying features",
    "including eyeglasses, jewelry, watches, and distinctive accessories.",
    "Preserve each child's exact hair texture (straight vs curly vs wavy), face shape, and apparent age —",
    "do not idealize, smooth, or stylize children's features into generic toddler/child archetypes.",
    "Preserve every elder's wrinkles, age lines, and facial character — do not de-age or smooth elderly faces.",
    "Preserve exact clothing colors, garment styles, body positions, gestures, and relative scale.",
    "Preserve clothing details exactly as in the original: embroidery, pleating, prints, textures,",
    "necklines, collars, buttons, and any decorative stitching.",
    "Keep the original group composition and pose.",
    "Preserve the original scene and background — render whatever is actually behind the people",
    "(studio backdrop, room, outdoor setting, curtains, furniture) in the same painterly style,",
    "kept soft and uncluttered so the family remains the focus.",
    "Preserve the original lighting direction and quality, rendered painterly with soft directional shadows.",
    "Natural relaxed expressions with soft asymmetric smiles, lived-in faces.",
    "Warm ochre, sage, terracotta, and cream palette overlay — warm but not oversaturated.",
    "Quality of a fine illustrated keepsake suitable for framed wall art.",
  ].join(" "),
  negativePrompt: [
    "photorealistic, 3D render, CGI, plastic skin, mask-like faces,",
    "frozen symmetrical smiles, dental grin,",
    "anime, manga, Disney character style, chibi, cartoon merchandise look,",
    "missing glasses, missing accessories, identity drift, generic faces,",
    "generic toddler face, idealized child features, smoothed children,",
    "de-aged elders, removed wrinkles, youthified grandparents,",
    "replaced background, teleported scene, added foliage, added fencing,",
    "stock photo aesthetic, flat lighting, uniform diffuse light, relit scene,",
    "distorted hands, extra fingers, blurry features, oversaturated",
  ].join(" "),
  strength: 0.6,
  guidance: 3.0,
};

/**
 * V3 — fixes V2's "no style applied" failure mode.
 *
 * V2 was structured as "painterly description + 7 preservation clauses". With
 * nano-banana's default toward minimal edits, the cumulative weight of all the
 * "preserve X" instructions overwhelmed the transformation directive and the
 * model returned what was effectively the original photo with a light tint.
 *
 * V3 changes the rhetorical structure:
 *   - LEADS with strong transformation verbs ("repaint", "transform into")
 *   - States the output type explicitly: "the result is an illustration, not a photo"
 *   - Consolidates preservation into a single "while keeping" block rather than
 *     seven separate clauses
 *   - Adds anti-photorealism language to the negative prompt
 */
export const PAINTERLY_V3: AiPreset = {
  id: "painterly-v3",
  label: "Painterly v3",
  prompt: [
    // Lead with the transformation. Strong verbs, explicit output type.
    "Repaint this photograph as a warm hand-illustrated family portrait —",
    "a fully painted artwork in the style of a contemporary storybook illustration.",
    "The output must look unmistakably like a painting, not a photograph:",
    "visible painterly brushwork, soft hand-drawn edges, slightly graphic shapes,",
    "matte painted texture across faces, skin, hair, clothing, and background.",
    "Warm ochre, sage, terracotta, and cream painted palette.",
    "Dreamy, inviting, suitable for a framed canvas keepsake.",
    // Preservation block — phrased as constraints on the painting, not as the goal.
    "While repainting, keep each person recognizable:",
    "preserve facial structure, skin tone, hair color and texture (straight vs curly vs wavy),",
    "apparent age, eyeglasses, jewelry, watches, and distinctive accessories.",
    "Do not idealize children or de-age elders — keep wrinkles, age lines, and individual character.",
    "Keep clothing colors, garment styles, embroidery, prints, and decorative details,",
    "rendered in painted style.",
    "Keep the group composition, poses, gestures, and the original scene/background,",
    "all repainted in the same storybook style.",
    "Keep the original lighting direction.",
    // Expression / mood guidance.
    "Natural relaxed expressions with soft asymmetric smiles, lived-in painted faces.",
  ].join(" "),
  negativePrompt: [
    "photograph, photographic, photorealistic, unedited photo, photo retouching, photo filter,",
    "3D render, CGI, plastic skin, mask-like faces,",
    "frozen symmetrical smiles, dental grin,",
    "anime, manga, Disney character style, chibi, cartoon merchandise look,",
    "missing glasses, missing accessories, identity drift, generic faces,",
    "generic toddler face, idealized child features, smoothed children,",
    "de-aged elders, removed wrinkles, youthified grandparents,",
    "replaced background, teleported scene, added foliage, added fencing,",
    "stock photo aesthetic, flat lighting, uniform diffuse light, relit scene,",
    "distorted hands, extra fingers, blurry features, oversaturated",
  ].join(" "),
  strength: 0.75,
  guidance: 3.5,
};

/**
 * V4 — pivots from "storybook illustration" to "oil painting on canvas".
 *
 * Why the pivot: V1–V3 outputs read as "photo with a soft filter" across most
 * inputs. A customer paying $89–129 needs to see something they'd recognize as
 * a hand-painted artwork, not a stylized photo. Oil painting has unambiguous
 * visual signatures — visible brushwork, impasto, canvas texture, edge
 * softness — that the model either delivers or doesn't (no half-measures).
 *
 * Stylistic anchors live in brand/references/style/. Make sure those are
 * regenerated to match the oil-painting direction (re-run pnpm gen-refs).
 */
export const PAINTERLY_V4: AiPreset = {
  id: "painterly-v4",
  label: "Oil Portrait v4",
  prompt: [
    // Lead with the medium. Be specific. Repeat for emphasis.
    "Repaint this photograph as a fine-art OIL PAINTING on canvas — a hand-painted family portrait",
    "in the warm classical European portrait tradition.",
    "The output is a PAINTING, not a photo. It must show unmistakable hallmarks of oil paint:",
    "visible brushwork across faces, skin, hair, clothing, and background;",
    "thick impasto highlights catching light on cheekbones, foreheads, knuckles, and fabric folds;",
    "softened edges where a brush has blended adjacent tones;",
    "subtle canvas weave texture visible through thinner paint layers in the background;",
    "rich glazed shadows and warm underpainting showing through.",
    "Warm classical palette: burnt sienna, ochre, raw umber, cream, sage, terracotta, ivory black.",
    "Soft directional warm light, painted shadows, gentle chiaroscuro modeling on faces.",
    "Quality and finish of a fine commissioned family oil portrait suitable for framed wall display.",
    // Preservation as constraint on the painting, not the goal.
    "While painting, keep each person recognizable as themselves:",
    "preserve facial structure, skin tone, hair color and texture, apparent age,",
    "eyeglasses, jewelry, watches, and distinctive accessories, all rendered in oil paint.",
    "Do not idealize children or de-age elders — paint wrinkles, age lines, and individual character honestly.",
    "Keep clothing colors, garment styles, embroidery, prints, and decorative details,",
    "interpreted in oil-paint brushwork.",
    "Keep the group composition, poses, gestures, and original scene/background,",
    "all repainted as part of the same oil painting.",
    "Keep the original lighting direction, painted with classical chiaroscuro.",
    "Natural relaxed expressions with soft asymmetric smiles, lived-in painted faces.",
  ].join(" "),
  negativePrompt: [
    "photograph, photographic, photorealistic, unedited photo, photo retouching, photo filter,",
    "soft focus, gaussian blur, smartphone HDR, beauty filter, skin smoothing,",
    "3D render, CGI, digital painting that looks airbrushed,",
    "plastic skin, mask-like faces, frozen symmetrical smiles, dental grin,",
    "anime, manga, Disney character style, chibi, Pixar style, cartoon merchandise look,",
    "missing glasses, missing accessories, identity drift, generic faces,",
    "generic toddler face, idealized child features, smoothed children,",
    "de-aged elders, removed wrinkles, youthified grandparents,",
    "replaced background, teleported scene,",
    "flat lighting, uniform diffuse light, relit scene,",
    "distorted hands, extra fingers, blurry features, oversaturated, neon, fluorescent",
  ].join(" "),
  strength: 0.85,
  guidance: 4.0,
};

/**
 * V5 — dials the V4 oil-painting direction back from Old Masters to
 * "warm contemporary family portrait commission".
 *
 * Why: V4 + FLUX Kontext solved both the architectural problems (identity
 * preservation + true oil-paint medium), but the aesthetic was 17th-century
 * museum-piece — dramatic chiaroscuro, ivory black shadows, somber gravity.
 * Wrong emotional register for a Mother's Day / anniversary keepsake.
 *
 * V5 keeps the medium (visible oil-paint brushwork) but rephrases everything
 * else toward: bright, warm, soft, inviting, modern. The kind of painting
 * you'd commission today, not one hanging in the Prado.
 */
export const PAINTERLY_V5: AiPreset = {
  id: "painterly-v5",
  label: "Warm Oil Portrait v5",
  prompt: [
    // Medium specificity — kept, because that's what's working.
    "Repaint this photograph as a warm, contemporary commissioned oil painting on canvas —",
    "a family portrait by a modern portrait painter, not an Old Masters museum piece.",
    "The output must be a PAINTING, not a photograph. Visible oil-paint brushwork across",
    "faces, skin, hair, clothing, and background. Softened edges where the brush blended",
    "adjacent tones. Subtle canvas texture in flat areas.",
    // Aesthetic dial-back — away from classical drama, toward warm contemporary keepsake.
    "Aesthetic: warm, soft, inviting, gift-feeling, suitable for a beloved family member's wall.",
    "Bright but painted — NOT dark, NOT dramatic, NOT moody, NOT museum-piece somber.",
    "Even gentle warm light, soft painted shadows. NO heavy chiaroscuro. NO ivory black shadows.",
    "NO Old Masters gravity.",
    // Lighter palette guidance.
    "Warm modern palette: cream, soft sage, peach, warm ochre, dusty terracotta, light browns.",
    "Lighter overall key than a classical portrait — closer to a sunlit room than to candlelight.",
    // Preservation as constraint on the painting, not the goal.
    "While painting, keep each person recognizable as themselves:",
    "preserve facial structure, skin tone, hair color and texture, apparent age,",
    "eyeglasses, jewelry, watches, and distinctive accessories, all rendered in oil paint.",
    "Do not idealize children or de-age elders — paint wrinkles and individual character honestly,",
    "but kindly and warmly, not somberly.",
    "Keep clothing colors, garment styles, embroidery, prints, and decorative details,",
    "interpreted in soft painted brushwork.",
    "Keep the group composition, poses, gestures, and original scene/background,",
    "all repainted as part of the same warm contemporary oil painting.",
    "Keep the original lighting direction, but rendered softly — not dramatically.",
    "Natural relaxed expressions with soft asymmetric smiles, lived-in painted faces, warm and kind.",
    "Quality of a beloved commissioned family portrait — the kind a customer gives as a Mother's Day",
    "or anniversary gift and that the recipient hangs proudly on a living-room wall.",
  ].join(" "),
  negativePrompt: [
    // Anti-photo signals.
    "photograph, photographic, photorealistic, unedited photo, photo retouching, photo filter,",
    "soft focus, gaussian blur, smartphone HDR, beauty filter, skin smoothing,",
    "3D render, CGI, digital painting that looks airbrushed,",
    // Anti-museum-piece signals — the new V5 additions.
    "Old Masters, Rembrandt, Velazquez, Caravaggio, baroque chiaroscuro,",
    "dark moody portrait, somber, gloomy, brooding, 17th century, Renaissance painting,",
    "ivory black, deep shadows, heavy chiaroscuro, candlelit, dramatic single-source lighting,",
    "dark background, black background, sepia toned, muddy umber tones,",
    // Anti-identity-drift signals.
    "plastic skin, mask-like faces, frozen symmetrical smiles, dental grin,",
    "anime, manga, Disney character style, chibi, Pixar style, cartoon merchandise look,",
    "missing glasses, missing accessories, identity drift, generic faces,",
    "generic toddler face, idealized child features, smoothed children,",
    "de-aged elders, removed wrinkles, youthified grandparents,",
    "replaced background, teleported scene,",
    "distorted hands, extra fingers, blurry features, oversaturated, neon, fluorescent",
  ].join(" "),
  strength: 0.7,
  guidance: 3.5,
};

/**
 * V6 — fixes the three failure modes visible in the 2026-05-24 bake-off:
 *
 *   1. Ethnicity drift. V5's "preserve facial structure" was too soft. Non-white
 *      subjects (Asian dad in pexels-21zere; Black parents in pexels-kindelmedia)
 *      came back with Europeanized features. This is a buy-killer — a parent
 *      will not pay for a portrait that doesn't depict their actual family.
 *      Fix: lead with explicit ethnicity preservation, name the failure mode.
 *
 *   2. Dark studio backdrops stay dark. V5 said "not dark, not moody" but also
 *      "preserve the original scene/background" — those instructions conflict
 *      when the original IS a black studio backdrop. The model resolved the
 *      conflict by preserving the dark backdrop (pexels-21zere came back with
 *      a near-black background, contradicting the V5 aesthetic goal).
 *      Fix: add an explicit "if dark/studio, lift to warm cream wash" override.
 *
 *   3. Flat illustration look. pexels-askar-abayev came back as flat vector-y
 *      shading, not oil paint — no brushwork, no impasto, no canvas texture.
 *      Fix: name specific brushwork signatures the output must contain.
 */
export const PAINTERLY_V6: AiPreset = {
  id: "painterly-v6",
  label: "Warm Oil Portrait v6",
  prompt: [
    // Medium — kept from V5, sharpened on brushwork specificity.
    "Repaint this photograph as a warm, contemporary commissioned oil painting on canvas —",
    "a family portrait by a modern portrait painter, not an Old Masters museum piece.",
    "The output must be a PAINTING, not a photograph and not a photo with a filter.",
    "Specific oil-paint signatures that MUST be visible in the output:",
    "directional brush strokes that follow the form of cheeks, jaw, hair, and fabric folds;",
    "broken-color edges where adjacent tones meet (not crisp photographic edges);",
    "thicker impasto highlights on cheekbones, the bridge of the nose, knuckles, and fabric ridges;",
    "softer scumbled blending in mid-tones and shadows;",
    "subtle canvas weave texture visible in flat background areas.",
    "If any of these signatures are missing the output is wrong.",
    // Aesthetic — contemporary warm keepsake, not classical drama.
    "Aesthetic: warm, soft, inviting, gift-feeling, suitable for a living-room wall.",
    "Bright but painted — NOT dark, NOT dramatic, NOT moody, NOT museum-piece somber.",
    "Even gentle warm light, soft painted shadows. NO heavy chiaroscuro. NO ivory black shadows.",
    "Warm modern palette: cream, soft sage, peach, warm ochre, dusty terracotta, light browns.",
    "Lighter overall key than a classical portrait — closer to a sunlit room than to candlelight.",
    // IDENTITY — strongest clause in the prompt, names the failure mode explicitly.
    "IDENTITY (non-negotiable): every person in the painting must be unmistakably the SAME individual",
    "as in the reference photo, including their ETHNICITY and ethnic facial features.",
    "Preserve ethnic features exactly as they appear in the photo:",
    "eye shape and epicanthic folds, nose shape and bridge width, lip shape and thickness,",
    "cheekbone structure, jawline width, brow shape, forehead shape, skin tone.",
    "Do NOT Europeanize, Westernize, Asianize, or shift any person's features toward a different ethnicity.",
    "Do NOT idealize children or de-age elders — paint wrinkles, age lines, and individual character honestly,",
    "warmly but truthfully.",
    "Preserve eyeglasses on the exact same person, jewelry, watches, facial hair, hair color and length,",
    "and any distinctive accessories, all rendered in oil paint.",
    "Preserve clothing colors, garment styles, embroidery, prints, and decorative details,",
    "interpreted in soft painted brushwork.",
    "Preserve group composition, poses, gestures, and who stands where.",
    // BACKGROUND — explicit dark-backdrop rescue.
    "Background: repaint the original scene in the same warm contemporary oil style,",
    "kept soft and uncluttered so the family remains the focus.",
    "EXCEPTION: if the original background is a black, near-black, or dark studio backdrop,",
    "do NOT paint it black. Replace it with a warm soft painted wash — gentle cream, warm taupe,",
    "or muted sage — like a contemporary portrait studio wall, so the painting reads bright and inviting.",
    "Keep the original lighting direction, but rendered softly — not dramatically.",
    // Expression / closing.
    "Natural relaxed expressions with soft asymmetric smiles, lived-in painted faces, warm and kind.",
    "Quality of a beloved commissioned family portrait — the kind a customer gives as a Mother's Day",
    "or anniversary gift and that the recipient hangs proudly on a living-room wall.",
  ].join(" "),
  negativePrompt: [
    // Anti-photo signals.
    "photograph, photographic, photorealistic, unedited photo, photo retouching, photo filter,",
    "soft focus, gaussian blur, smartphone HDR, beauty filter, skin smoothing,",
    "3D render, CGI, digital painting that looks airbrushed,",
    // Anti-flat-illustration signals — new in V6.
    "flat vector illustration, flat shading, cel shading, posterized, cartoon, comic book,",
    "smooth gradients without brushwork, airbrushed surfaces, missing brush strokes,",
    // Anti-museum-piece signals.
    "Old Masters, Rembrandt, Velazquez, Caravaggio, baroque chiaroscuro,",
    "dark moody portrait, somber, gloomy, brooding, 17th century, Renaissance painting,",
    "ivory black, deep shadows, heavy chiaroscuro, candlelit, dramatic single-source lighting,",
    "dark background, black background, black studio backdrop, sepia toned, muddy umber tones,",
    // Anti-ethnicity-drift signals — new in V6.
    "Europeanized features, Westernized features, changed ethnicity, generic Caucasian face,",
    "lightened skin, altered eye shape, altered nose shape, altered lip shape, altered jaw,",
    // Anti-identity-drift signals.
    "plastic skin, mask-like faces, frozen symmetrical smiles, dental grin,",
    "anime, manga, Disney character style, chibi, Pixar style, cartoon merchandise look,",
    "missing glasses, missing accessories, identity drift, generic faces,",
    "generic toddler face, idealized child features, smoothed children,",
    "de-aged elders, removed wrinkles, youthified grandparents,",
    "replaced scene, teleported family,",
    "distorted hands, extra fingers, blurry features, oversaturated, neon, fluorescent",
  ].join(" "),
  strength: 0.75,
  guidance: 3.5,
};

export const ACTIVE_PRESET = PAINTERLY_V6;
