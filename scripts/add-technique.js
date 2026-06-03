#!/usr/bin/env node
/*
 * Adds a `technique` field to each entry in exercise-image-overrides.json.
 * Each technique has: { setup[], execution[], mistakes[], tips[] }.
 *
 * Content is compact and rooted in mainstream training science (Schoenfeld,
 * Helms, Nuckols, Nippard). Variants (e.g. "Tempo Back Squat") inherit their
 * parent's technique at runtime — see lookupTechnique() in app.js — so the
 * data here is keyed by the canonical movement name.
 *
 * Run: `node scripts/add-technique.js`
 */
const fs = require('fs');
const path = require('path');

const t = (setup, execution, mistakes, tips) => ({ setup, execution, mistakes, tips });

// === Lower body ===
const techniques = {
  'Back Squat': t(
    ['Bar on upper traps (high-bar) or rear delts (low-bar)', 'Feet shoulder-width, toes 10–20° out, screw heels in'],
    ['Brace — big breath into belly, lock core', 'Break hips and knees together; descend to at least parallel, drive mid-foot up'],
    ['Knees caving inward — shove knees out over toes', 'Heels lifting or chest collapsing forward'],
    ['Heels-elevated stance helps depth for taller lifters or quad emphasis']
  ),
  'Front Squat': t(
    ['Bar across front delts, elbows high', 'Either clean grip or crossed-arm grip'],
    ['Stay upright — torso vertical throughout', 'Drive elbows up out of the hole'],
    ['Elbows dropping (cue: "elbows to ceiling")', 'Caving forward = quad burn lost, low-back strained'],
    ['More quad-dominant than back squat; pairs well with low-bar work']
  ),
  'Deadlift': t(
    ['Bar over mid-foot, shins ~1 inch from bar', 'Hinge to grip — chest tall, lats tucked, slight knee bend'],
    ['Pull slack out of bar, then push the floor away with legs', 'Lock hips at top, don\'t hyperextend; control the descent'],
    ['Bar drifting forward — keep bar against shins', 'Lower back rounding under load'],
    ['Mixed grip or straps above ~80% 1RM; chalk for grip']
  ),
  'Romanian Deadlift': t(
    ['Stand tall with bar at hip crease, slight knee bend (≈15°)', 'Lats engaged, shoulders over bar'],
    ['Push hips back (hinge) — keep bar against thighs', 'Descend until you feel hamstring stretch (~mid-shin), drive hips forward'],
    ['Squatting instead of hinging — knees stay nearly static', 'Rounding the lower back at bottom'],
    ['Stop where flexibility ends; don\'t chase floor depth']
  ),
  'Barbell Hip Thrust': t(
    ['Upper back on bench, bar over hip crease with pad', 'Feet planted shin-vertical at top, knees ~90°'],
    ['Tuck chin and ribs down; only the hips move', 'Drive through heels, lock glutes at top — pause briefly'],
    ['Lower back arching (cue: posterior pelvic tilt at top)', 'Heels lifting or feet too far forward (becomes a back lift)'],
    ['Single-leg variant balances side-to-side strength']
  ),
  'Dumbbell Walking Lunge': t(
    ['Dumbbells at sides, neutral grip; chest up, core braced', 'Step length: knee tracks over middle of front foot'],
    ['Step forward into a stride, knee just shy of the floor', 'Drive through front heel to next step — minimize push-off from rear leg'],
    ['Knee tracking inside the foot', 'Stepping too short (becomes a quad burn instead of glute stretch)'],
    ['Slower descent (~2s) emphasizes the loaded stretch for glute growth']
  ),
  'Leg Extension': t(
    ['Knees aligned with the machine\'s pivot axis', 'Back flat against pad, hands relaxed on handles'],
    ['Extend slowly; squeeze quads hard at lockout', 'Controlled negative (~2-3s); don\'t let weight crash down'],
    ['Slamming into lockout (joint stress) or partial reps', 'Lifting hips off pad to cheat the weight up'],
    ['Toes-out emphasizes vastus medialis (teardrop); pointed straight is balanced']
  ),
  'Seated Leg Curl': t(
    ['Knee axis aligned with machine pivot', 'Thigh pad locked snug; back against pad'],
    ['Curl heels under glutes; squeeze hamstrings at bottom', 'Slow eccentric (~2s); don\'t let stack hit'],
    ['Letting hips lift off pad', 'Bouncing the weight to start the rep'],
    ['Pointing toes back (dorsiflexion) reduces calf involvement, isolates hams more']
  ),
  'Lying Leg Curl': t(
    ['Knees just past edge of pad, hips pressed down', 'Pad sits on Achilles, not calves'],
    ['Curl heels to glutes; brief squeeze at top', 'Control the descent (~2s)'],
    ['Lifting hips off pad — defeats hamstring isolation', 'Half-range reps (only top or bottom)'],
    ['Single-leg variant evens out side-to-side imbalances']
  ),
  'Standing Calf Raise': t(
    ['Ball of foot on edge of platform, knees fully extended', 'Toes pointed straight forward'],
    ['Press up through big toe — full plantarflexion', 'Slow drop into deep stretch (~3s); pause briefly at bottom'],
    ['Bouncing out of the stretch (steals tendon energy)', 'Cutting the range — only mid-range counts least'],
    ['Stretched-position emphasis (lower) drives more calf growth than top-only reps']
  ),
  'Cable Pull Through': t(
    ['Rope between legs, face away from cable', 'Stagger or hip-width stance, slight knee bend'],
    ['Hinge at hips — push butt back, rope traces inner thighs', 'Squeeze glutes hard at top to stand up'],
    ['Squatting the rep — turn it into a hinge', 'Hyperextending at top (back, not glutes, finishes)'],
    ['Anterior tilt eccentric, posterior tilt concentric — sequence the pelvis']
  ),
  'Single-Leg Leg Press': t(
    ['Foot high on platform; opposite foot off plate', 'Hips and back firm against pad'],
    ['Lower until knee approaches chest (deep ROM)', 'Press through heel — slow eccentric (~2s)'],
    ['Knee caving inward under load', 'Lifting hips off seat (lower-back rounding)'],
    ['Higher foot = more hip/glute; lower foot = more quad']
  ),
  'Goblet Squat': t(
    ['Hold dumbbell at chest, elbows tucked in', 'Stance slightly wider than shoulder-width, toes out'],
    ['Sit down between the heels; chest up', 'Drive knees out, stand tall'],
    ['Letting elbows drift forward (counterweight lost)', 'Heels coming up'],
    ['Pause 2-3s at bottom for mobility + control']
  ),
  'Round-Back Dumbbell 45° Hyperextension': t(
    ['Upper back deliberately rounded (yes — for glute focus)', 'Dumbbell held at chest; pad just above hip crease'],
    ['Drive hips into pad like a hip thrust; flex spine at top', 'Slow descent into a deep glute stretch'],
    ['Treating it like a back extension (long lever, lower back loaded)', 'Going to vertical too fast — kill the bottom stretch'],
    ['Different from "stiff back" hypers — this one is glute-biased']
  ),
  'Lateral Band Walk': t(
    ['Band just above knees or around ankles', 'Quarter-squat: knees soft, hips back'],
    ['Step sideways with the leading leg — band stays tense', 'Trailing leg follows; never relaxed band'],
    ['Standing too upright (kills glute medius tension)', 'Knees collapsing inward as you step'],
    ['Use as a glute med activation primer before squat/deadlift']
  ),

  // === Push ===
  'Barbell Bench Press': t(
    ['Eyes under bar; shoulder blades retracted + depressed, slight arch', 'Grip ~1.5× shoulder width, feet planted, light leg drive'],
    ['Lower under control to lower chest, elbows ~45°', 'Press up and slightly back, lockout over shoulders'],
    ['Elbows flaring to 90° (shoulder strain)', 'Bouncing the bar off chest or losing scapular set'],
    ['1s pause on chest builds bottom-end strength and protects shoulders']
  ),
  'Close-Grip Bench Press': t(
    ['Grip shoulder-width; elbows tucked tight to sides', 'Same scapular set as flat bench'],
    ['Lower to lower sternum, elbows brushing ribs', 'Press up keeping elbows in — triceps drive the rep'],
    ['Going too narrow — wrist pain, no extra triceps recruitment', 'Flaring elbows (defeats the variation)'],
    ['Pin press or floor press variants overload top-half lockout']
  ),
  'Dumbbell Seated Shoulder Press': t(
    ['Back firmly against pad; bench upright', 'Dumbbells at shoulder height, palms forward, elbows ~45°'],
    ['Press up overhead — bells nearly touch at top', 'Lower with control to ear level (deep stretch)'],
    ['Stopping short (top half only)', 'Arching the lower back to cheat the press'],
    ['Bench at ~75° (slight incline) is friendlier on shoulders than fully vertical']
  ),
  'Arnold Press': t(
    ['Start: dumbbells in front, palms toward face, elbows tucked', 'Seated, back supported'],
    ['Rotate palms out as you press up — finish overhead', 'Reverse the rotation on the way down'],
    ['Rotating before pressing (loses tension)', 'Lowering only to shoulder height (missing stretch)'],
    ['Adds front-delt + rotator cuff activation vs straight DB press']
  ),
  'Military Press': t(
    ['Bar in front rack, hands just outside shoulders', 'Glutes squeezed, ribs down, tight core'],
    ['Press up — push your head through the bar at lockout', 'Lock out over mid-foot, not in front'],
    ['Excessive lower-back arch (lumbar hyperextension)', 'Pushing the bar forward instead of up'],
    ['Slight push-press for top sets allows heavier overload through sticking point']
  ),
  'Dumbbell Incline Press': t(
    ['Bench at 30° (sweet spot for upper-chest emphasis)', 'Scapulae retracted, dumbbells over lower chest'],
    ['Lower with elbows ~45° to side of upper chest', 'Press up; bells meet over upper chest at top'],
    ['Bench too steep (>45°) — becomes shoulder press', 'Pressing in (clanking bells) loses pec tension'],
    ['30° outperforms flat bench for upper-chest growth (Chaves et al. 2020)']
  ),
  'Weighted Dip': t(
    ['Bars about shoulder-width; lean torso forward 15–20° (chest emphasis)', 'Scapulae retracted and depressed throughout'],
    ['Lower until shoulders just below elbows or chest deep stretch', 'Drive up — keep lean, don\'t pop upright'],
    ['Going too deep with shoulders rolling forward (anterior strain)', 'Vertical torso turns it into a triceps-only movement (fine if intended)'],
    ['Use a dip belt; band-assisted dips for sub-bodyweight progression']
  ),
  'Low-to-High Cable Flye': t(
    ['Set pulleys at hip height; one cable each hand', 'Slight forward lean; arms slightly bent and locked'],
    ['Sweep hands up and toward each other in an arc', 'Pause and squeeze at top (hands meet at upper chest level)'],
    ['Bending the elbow more during the rep (becomes a press)', 'Letting cables pull arms behind body line on stretch'],
    ['Pec deck is a great regression with the same upper-chest bias']
  ),
  'Pec Deck': t(
    ['Back firm against pad; forearms on pads (or grip handles)', 'Slight elbow bend, shoulders down'],
    ['Squeeze elbows together in front of chest', 'Slow open (~2s) into a deep stretch'],
    ['Shrugging shoulders forward to help close', 'Bouncing out of the stretch'],
    ['Stretched-position partials at end of set drive extra pec growth']
  ),
  'Dumbbell Lateral Raise': t(
    ['Slight torso lean forward (~10°); soft elbow bend (15°)', 'Dumbbells in front of thighs'],
    ['Raise out and slightly forward to shoulder height', 'Pinky slightly up at top (cue: "pour a pitcher")'],
    ['Going above shoulder height (traps take over)', 'Using momentum/swing instead of strict raise'],
    ['Hold a small pause at the top; cable variant for constant tension']
  ),
  'Dumbbell Isolateral Skull Crusher': t(
    ['Flat bench; one dumbbell in each hand, neutral grip', 'Upper arms vertical, slight angle back toward head'],
    ['Lower bells past ears (deep triceps stretch)', 'Extend elbows back to lockout — only elbow joint moves'],
    ['Upper arms drifting forward (shifts work off triceps)', 'Flaring elbows out to the sides'],
    ['Slight angle (vs perfectly vertical) keeps tension on triceps throughout']
  ),
  'Cable Triceps Kickback': t(
    ['Cable set low; lean forward, upper arm parallel to torso', 'Pin elbow tight against side throughout'],
    ['Extend forearm back; lock out + squeeze 1s', 'Slow return — never let elbow drift forward'],
    ['Letting elbow swing — only the forearm should move', 'Using too much weight (loses isolation)'],
    ['Cable beats dumbbell version — constant tension all the way through ROM']
  ),
  'Triceps V-Bar Pressdown': t(
    ['Stand close to stack; elbows pinned at sides', 'Slight forward lean; engage core'],
    ['Press down to full extension; squeeze 1s', 'Control return to ~90° at elbow'],
    ['Elbows flaring out or drifting forward', 'Leaning over the bar (using body weight = cheat)'],
    ['Rope attachment + separating hands at lockout = extra long-head emphasis']
  ),
  'Rope Overhead Triceps Extension': t(
    ['Face away from cable; rope behind head', 'Upper arms close to head, elbows pointing forward'],
    ['Extend rope up and out at lockout', 'Slow stretch back behind head — feel the long head'],
    ['Letting elbows flare to the sides', 'Stopping short of full stretch (the whole point of overhead)'],
    ['Long head of triceps gets best growth stimulus from stretched positions']
  ),
  'Ab Wheel Rollout': t(
    ['Kneel with wheel under shoulders; arms straight', 'Posteriorly tilt pelvis (squeeze glutes) — locked'],
    ['Roll out as far as you can hold neutral spine', 'Pull back via abs (not arms)'],
    ['Lower back sagging at extension (cut range short instead)', 'Pulling with shoulders/arms instead of abs'],
    ['Build to standing rollouts only after months of solid kneeling reps']
  ),
  'Bicycle Crunch': t(
    ['Lie supine; hands lightly behind head (don\'t pull)', 'Lower back pressed into floor'],
    ['Bring opposite elbow to knee; rotate from torso', 'Slow and controlled — quality > speed'],
    ['Yanking on the neck', 'Going fast (becomes momentum, not abs)'],
    ['Pause briefly at full rotation for max oblique recruitment']
  ),
  'Hanging Leg Raise': t(
    ['Hang from bar with full grip; slight shoulder engagement', 'Posteriorly tilt pelvis to start (this is the cue)'],
    ['Curl knees (regression) or straight legs (full) up to bar height', 'Lower slowly — don\'t just drop'],
    ['Swinging — uses momentum, not abs', 'Leg raise only (no pelvic tilt) — that\'s hip flexor work, not abs'],
    ['Toes-to-bar is the full version; knee tucks first if straight legs too hard']
  ),
  'Plank': t(
    ['Forearms shoulder-width; elbows under shoulders', 'Body in straight line: head, hips, heels aligned'],
    ['Squeeze glutes + quads to lock pelvis neutral', 'Hold while breathing — don\'t hold breath'],
    ['Hips sagging (lower back stressed) or hips piking up', 'Holding longer past form failure'],
    ['30-60s of tight plank beats 3-minutes of sloppy hold; weighted variants for progression']
  ),

  // === Pull ===
  'Pull-up': t(
    ['Dead hang with hands ~shoulder-width, palms forward', 'Engage scapula down + back before pulling'],
    ['Pull chest to bar; chin clears it', 'Lower under control to full hang'],
    ['Kipping or swinging — turns it into a CrossFit move', 'Stopping at chin (half rep)'],
    ['Add band assistance for deficits; weighted belt once 10+ bodyweight reps clean']
  ),
  'Pendlay Row': t(
    ['Bar over mid-foot; torso parallel to floor', 'Overhand grip just outside knees'],
    ['Explosively row bar to lower chest/upper abs', 'Reset bar on floor between every rep — dead-stop reps'],
    ['Torso rising during the row (becomes a lat-less power lift)', 'Pulling to belly button (recruits less upper back)'],
    ['Classic strict version is brutal upper-back size builder']
  ),
  'Dumbbell One-Arm Row': t(
    ['Knee + opposite hand on bench; back flat', 'Dumbbell hangs straight down, weak-side foot grounded'],
    ['Row elbow up and back along ribs', 'Squeeze lat at top; slow descent into full stretch'],
    ['Torso rotation to cheat the weight up', 'Pulling with the arm instead of leading with the elbow'],
    ['Slight stretch at bottom (let dumbbell pull shoulder forward) drives lat growth']
  ),
  'Chest-Supported T-Bar Row w/ Band': t(
    ['Chest pad firmly supported; feet planted', 'Neutral grip (or wide); band attached for extra tension top'],
    ['Row toward upper abs; squeeze upper back at top', 'Slow eccentric — fight the band on the way down'],
    ['Lifting chest off the pad (loses isolation)', 'Pulling with hands instead of driving elbows back'],
    ['Band adds end-range overload — most rows have least tension at peak']
  ),
  'Neutral-Grip Pulldown': t(
    ['Knees locked under pad; lean ~10° back', 'Neutral handle; grip just outside shoulder width'],
    ['Pull handle to upper chest; elbows drive down + back', 'Squeeze lats at bottom; slow stretch at top'],
    ['Excessive lean-back (becomes a row)', 'Pulling with biceps instead of leading with elbows'],
    ['Neutral grip is most shoulder-friendly and great for lat thickness']
  ),
  'Cable Seated Row': t(
    ['Tall seated, knees slightly bent, chest tall', 'Lats engaged before you pull (depress shoulders)'],
    ['Pull handle to lower sternum; elbows tuck along ribs', 'Squeeze 1s; slow return to full lat stretch'],
    ['Rocking the torso forward/back (lower-back swing)', 'Letting shoulders round forward at stretch'],
    ['Wide grip + elbows out hits rear delts/upper back; close + tucked hits lats']
  ),
  'Kneeling Straight-Arm Cable Pull-Over': t(
    ['Cable high; kneel facing the machine', 'Torso lean forward ~30-45°; arms locked'],
    ['Pull rope/bar down to thighs in an arc', 'Squeeze lats hard; slow return overhead'],
    ['Bending elbows mid-rep — turns it into pressdown', 'Pulling with traps/biceps instead of lats'],
    ['Best lat-isolation move there is; perfect lat finisher']
  ),
  'Snatch Grip Barbell Shrug': t(
    ['Grip ~1.5× shoulder width, bar at hip', 'Brace core, slight knee bend'],
    ['Shrug up and slightly back — drive traps to ears', 'Pause 1s top; slow descent'],
    ['Rolling shoulders (no traps benefit, just shoulder strain)', 'Using too much weight + short range'],
    ['Wider grip hits upper traps more than standard shrug grip']
  ),
  'Seated Face Pull': t(
    ['Cable at face height; rope attachment', 'Seated, arms straight, chest tall'],
    ['Pull rope to face — elbows lead, ends of rope split to sides of head', 'External rotation: thumbs back at end position'],
    ['Pulling to chest (loses rear delt + rotator cuff focus)', 'Letting shoulders shrug up'],
    ['Best single exercise for shoulder health + posture; do them often']
  ),
  'Cable Reverse Flye': t(
    ['Cables crossed in front; opposite-side handle each hand', 'Slight forward lean; soft elbow bend'],
    ['Sweep arms out and back; squeeze rear delts hard', 'Slow return — don\'t let cables drag arms forward'],
    ['Using too much weight (back muscles take over)', 'Bending elbows mid-rep (becomes a row)'],
    ['Light weight, high reps (15-20+) works best for rear delts']
  ),
  'Rope Upright Row': t(
    ['Cable low; rope attachment, hands shoulder-width', 'Stand close to machine; tall posture'],
    ['Pull rope up and out — elbows lead, hands flare apart', 'Stop at chest height (no higher) — squeeze top'],
    ['Going above chest height (shoulder impingement risk)', 'Pulling with biceps instead of side delts'],
    ['Wide grip + low pull = side delt/upper trap focus; safer than barbell variant']
  ),
  '1 Arm Lat Pull-in': t(
    ['Cable high, side stance, one arm reaches up to handle', 'Free hand on hip or stabilizer; soft elbow lock'],
    ['Pull arm down to side, laterally flex torso into the pull', 'Squeeze lat at bottom; slow stretch to top'],
    ['Bending elbow (turns into row)', 'Using shoulder rotation instead of lat'],
    ['Light isolation warm-up — primes lats for heavier work']
  ),
  'Dumbbell Preacher Curl': t(
    ['Arms over pad, armpits against top edge', 'Dumbbells with supinated grip; full extension at bottom'],
    ['Curl up — squeeze biceps hard at top', 'Slow descent (~3s); short of full elbow lock at bottom'],
    ['Coming off the pad to cheat', 'Letting elbow extend fully under load (biceps tendon stress)'],
    ['Single-arm preacher allows full focus on one side per set']
  ),
  'Reverse Grip EZ Bar Curl': t(
    ['EZ bar, pronated grip (palms down); shoulder-width', 'Elbows pinned at sides'],
    ['Curl up — squeeze forearms + brachialis at top', 'Slow eccentric — don\'t lose wrist position'],
    ['Wrist bending under load (use straight wrists)', 'Using momentum/body english'],
    ['Hits brachialis hard — drives upper-arm thickness more than biceps width']
  ),
  'Supinated EZ Bar Curl': t(
    ['EZ bar, supinated grip (palms up); shoulder-width', 'Elbows tucked tight to sides'],
    ['Curl up to top — biceps squeeze', 'Slow descent; full elbow extension at bottom'],
    ['Swinging body to start the rep', 'Lifting elbows forward (front delts take over)'],
    ['EZ bar is more wrist-friendly than straight bar with similar gains']
  ),
  'Hammer Curl': t(
    ['Dumbbells neutral grip (thumbs up), arms at sides', 'Elbows pinned'],
    ['Curl up keeping wrists neutral throughout', 'Slow eccentric to full stretch'],
    ['Rotating wrists during rep', 'Swinging or using torso momentum'],
    ['Hits brachialis + brachioradialis — adds arm thickness traditional curls miss']
  ),
  'Single-Arm Cable Curl': t(
    ['Stand sideways to machine, cable low', 'Elbow behind torso for full peak contraction'],
    ['Curl with strict elbow position', 'Squeeze top 1s; slow descent'],
    ['Letting elbow drift forward as you curl', 'Lifting shoulder to cheat the weight'],
    ['Constant tension makes cable curls great for short-head biceps peak']
  ),
  'Spider Curl': t(
    ['Lie chest-down on incline bench (~45°)', 'Arms hang straight; supinated grip on bar or DBs'],
    ['Curl up — only the forearm moves (elbows perpendicular to floor)', 'Squeeze hard at top; slow eccentric to full stretch'],
    ['Letting elbows swing back to cheat', 'Coming off the bench'],
    ['Eliminates body english — pure biceps stimulus']
  ),
};

// === merge into overrides file ===
const ovrPath = path.resolve(__dirname, '..', 'exercise-image-overrides.json');
const ovr = JSON.parse(fs.readFileSync(ovrPath, 'utf8'));

let added = 0, skipped = 0;
for (const [name, tech] of Object.entries(techniques)) {
  if (!ovr[name]) {
    console.warn(`  ! no override entry for "${name}" — skipping`);
    skipped++;
    continue;
  }
  ovr[name].technique = tech;
  added++;
}

fs.writeFileSync(ovrPath, JSON.stringify(ovr, null, 2) + '\n');
console.log(`Wrote ${added} technique entries (${skipped} skipped) into ${ovrPath}`);
console.log(`Total override entries: ${Object.keys(ovr).length}`);
console.log(`With technique: ${Object.values(ovr).filter(v => v && typeof v === 'object' && v.technique).length}`);
